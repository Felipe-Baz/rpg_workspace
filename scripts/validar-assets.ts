// Validação manual da change 06 (tarefa 5.4): gera 10 assets do MESMO tema com o pipeline real
// (compositor de prompt + âncora de estilo + remoção de fundo + recorte + normalização + verificação).
//   node --env-file=.env scripts/validar-assets.ts [caminho/ancora.png]   (SO=mancha,barril gera só esses)
// Saída em validacao-assets-saida/: <nome>.png (final), <nome>.preview.png (claro | escuro) e resumo.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { escolherCorChaveParaAsset } from "../src/lib/mapas-ia/corChave.ts";
import { googleImagem } from "../src/lib/mapas-ia/provedores/google-imagem.ts";
import { googleLlm } from "../src/lib/mapas-ia/provedores/google-llm.ts";
import { obterPerspectiva } from "../src/lib/mapas-ia/perspectivas/registro.ts";
import { executarPipeline, removerFundoNecessario } from "../src/lib/mapas-ia/assets/pipeline.ts";
import { comporPrompt, precisaAlfa } from "../src/lib/mapas-ia/assets/prompt.ts";
import { planejarGeracao } from "../src/lib/mapas-ia/orquestrador.ts";
import type { TipoAsset } from "../src/lib/cena/tipos.ts";
import type { PixelsRgba } from "../src/lib/mapas-ia/fundo.ts";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("Defina GOOGLE_API_KEY.");
const ctx = { config: { apiKey, ...(process.env.GEMINI_MODELO ? { modelo: process.env.GEMINI_MODELO } : {}) }, http: fetch };
const OUT = "validacao-assets-saida";
mkdirSync(OUT, { recursive: true });

const ancoraPath = process.argv[2] ?? "validacao-gemini-saida/arvore.recorte.png";
const jpg = await sharp(readFileSync(ancoraPath)).flatten({ background: "#ffffff" }).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
const ancora = { mime: "image/jpeg", base64: jpg.toString("base64") };

const tema = {
  descricao: "Pintura à mão para mapas de RPG de fantasia sombria, contorno escuro fino, textura de pincel visível, cores terrosas e dessaturadas.",
  paleta: ["#3b3a2f", "#6b5b3e", "#8a7a56", "#4a5a3a", "#2a2a2a"],
  regras: ["contorno escuro fino", "iluminação suave vinda do canto superior esquerdo", "textura de pincel visível"],
  proibidos: ["neon", "cores saturadas", "estilo cartoon"],
};
const perspectiva = obterPerspectiva("topdown");
const cap = googleImagem.capacidades;

const itens: [string, TipoAsset, string][] = [
  ["barril", "sprite", "barril de madeira com aros de ferro"],
  ["bau", "sprite", "baú de tesouro fechado"],
  ["mesa", "sprite", "mesa redonda rústica de madeira com duas canecas"],
  ["tocha", "sprite", "braseiro de ferro em pé com fogo"],
  ["muro", "sprite", "trecho curto de muro de pedra antigo"],
  ["canteiro", "sprite", "canteiro de jardim com flores coloridas (rosa, vermelho, amarelo, roxo)"],
  ["arbusto", "sprite", "arbusto baixo de folhas verdes"],
  ["mancha", "decal", "mancha de lama e folhas secas no chão"],
  ["piso-pedra", "textura", "piso de pedra de masmorra"],
  ["trilha", "pincel", "trilha de terra batida com pedrinhas"],
];

const resumo: Record<string, unknown>[] = [];
const filtro = process.env.SO?.split(",");
for (const [nome, tipo, descricao] of itens.filter(([n]) => !filtro || filtro.includes(n))) {
  try {
    const plano = planejarGeracao(cap, { precisaAlfa: precisaAlfa(tipo), referencias: [ancora] });
    const escolha = removerFundoNecessario(cap, tipo) ? await escolherCorChaveParaAsset(descricao, process.env.SEM_LLM ? undefined : { provedor: googleLlm, ctx }) : undefined;
    const prompt = comporPrompt({ tipo, descricao, tema, perspectiva, corChave: escolha?.chave, comReferencias: plano.referencias.length > 0 });
    const r = await executarPipeline(
      { tipo, capacidades: cap },
      {
        gerar: () => googleImagem.gerar(ctx, { prompt, referencias: plano.referencias }),
        decodificar: async (img): Promise<PixelsRgba> => {
          const { data, info } = await sharp(Buffer.from(img.base64, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
        },
        codificar: async (px) => ({
          mime: "image/png",
          base64: (await sharp(Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength), { raw: { width: px.width, height: px.height, channels: 4 } }).png().toBuffer()).toString("base64"),
        }),
      },
    );
    const png = Buffer.from(r.png.base64, "base64");
    writeFileSync(`${OUT}/${nome}.png`, png);
    const lado = (cor: string) => sharp({ create: { width: r.largura, height: r.altura, channels: 3, background: cor } }).composite([{ input: png }]).png().toBuffer();
    const [claro, escuro] = await Promise.all([lado("#f2f2f2"), lado("#202020")]);
    writeFileSync(
      `${OUT}/${nome}.preview.png`,
      await sharp({ create: { width: r.largura * 2, height: r.altura, channels: 3, background: "#000" } }).composite([{ input: claro, left: 0, top: 0 }, { input: escuro, left: r.largura, top: 0 }]).png().toBuffer(),
    );
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transp = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transp++;
    const linha = { nome, tipo, chave: escolha?.chave.nome, origemChave: escolha?.origem, tamanho: `${r.largura}x${r.altura}`, transparente: `${((transp / (data.length / 4)) * 100).toFixed(0)}%`, etapas: r.etapas.join(">"), naoRepetivel: r.naoRepetivel, avisos: r.avisos };
    resumo.push(linha);
    console.log(JSON.stringify(linha));
  } catch (e) {
    resumo.push({ nome, erro: (e as Error).message });
    console.error(nome, "FALHOU:", (e as Error).message);
  }
}
if (!filtro) writeFileSync(`${OUT}/resumo.json`, JSON.stringify(resumo, null, 2));
console.log(`Pronto. Abra ${OUT}/ e registre os achados em docs/validacao-gemini.md.`);
