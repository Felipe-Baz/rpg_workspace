// Validação manual do Gemini (change 04, tarefa 6.4). Uso:
//   GOOGLE_API_KEY=... node scripts/validar-gemini.ts [caminho/referencia.png]
//   (ou: node --env-file=.env.local scripts/validar-gemini.ts ...  com GOOGLE_API_KEY no arquivo)
// Opcional: GEMINI_MODELO=outro-modelo ; SO=muro,canteiro (só esses sprites) ; SEM_LLM=1 (cor-chave só por heurística)
// Saída em validacao-gemini-saida/: <nome>.bruto.png, <nome>.recorte.png, <nome>.preview.png
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { RemovedorFundoChroma, detectarCorFundo } from "../src/lib/mapas-ia/fundo.ts";
import { escolherCorChaveParaAsset, trechoFundo } from "../src/lib/mapas-ia/corChave.ts";
import { googleLlm } from "../src/lib/mapas-ia/provedores/google-llm.ts";
import { googleImagem } from "../src/lib/mapas-ia/provedores/google-imagem.ts";
import type { ImagemBase64 } from "../src/lib/mapas-ia/tipos.ts";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("Defina GOOGLE_API_KEY.");
const ctx = { config: { apiKey, ...(process.env.GEMINI_MODELO ? { modelo: process.env.GEMINI_MODELO } : {}) }, http: fetch };
const OUT = "validacao-gemini-saida";
mkdirSync(OUT, { recursive: true });

const refPath = process.argv[2];
const referencias: ImagemBase64[] = refPath ? [{ mime: "image/png", base64: readFileSync(refPath).toString("base64") }] : [];
const estilo = refPath ? " Match the art style, palette and line work of the reference image." : " Top-down RPG tabletop art, hand-painted style.";

const sprites = [
  ["barril", "A wooden barrel with iron bands, seen from above."],
  ["bau", "A closed treasure chest, seen from above."],
  ["mesa", "A rustic round wooden table with two mugs, seen from above."],
  ["arvore", "A leafy oak tree canopy, seen from above."],
  ["tocha", "A standing iron brazier with fire, seen from above."],
  ["arvore-flores", "A leafy oak tree canopy seen from above, with clusters of pink and purple blossoms scattered through the middle of the canopy."],
  ["muro", "A short section of an old stone wall, seen from above."],
  ["canteiro", "A garden flower bed with colorful flowers (pink, red, yellow, purple), seen from above."],
];
const filtro = process.env.SO?.split(",");
const texturas = [
  ["piso-pedra", "Seamless tileable top-down dungeon stone floor texture, flat lighting."],
  ["grama", "Seamless tileable top-down grass texture, flat lighting."],
];

async function paraRgba(b64: string) {
  const { data, info } = await sharp(Buffer.from(b64, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

async function sprite(nome: string, desc: string) {
  // A cor de fundo é escolhida pelo conteúdo do asset (LLM -> paleta -> cor mais distante).
  const escolha = await escolherCorChaveParaAsset(desc, process.env.SEM_LLM ? undefined : { provedor: googleLlm, ctx });
  console.log(`${nome}: fundo pedido=${escolha.chave.nome} (${escolha.origem}) paleta=${escolha.paleta.map((c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("")).join(",")}${escolha.aviso ? " AVISO: " + escolha.aviso : ""}`);
  const r = await googleImagem.gerar(ctx, { prompt: desc + trechoFundo(escolha.chave) + estilo, referencias });
  writeFileSync(`${OUT}/${nome}.bruto.png`, Buffer.from(r.base64, "base64"));
  const px = await paraRgba(r.base64);
  const chave = detectarCorFundo(px); // cor real do fundo, medida nas bordas
  const rec = RemovedorFundoChroma.remover(px, { corChave: chave });
  const png = await sharp(Buffer.from(rec.data), { raw: { width: rec.width, height: rec.height, channels: 4 } }).png().toBuffer();
  writeFileSync(`${OUT}/${nome}.recorte.png`, png);
  // preview: recorte sobre fundo claro e escuro, lado a lado (halo aparece nas bordas)
  const lado = (cor: string) => sharp({ create: { width: rec.width, height: rec.height, channels: 3, background: cor } }).composite([{ input: png }]).png().toBuffer();
  const [claro, escuro] = await Promise.all([lado("#f2f2f2"), lado("#202020")]);
  const prev = await sharp({ create: { width: rec.width * 2, height: rec.height, channels: 3, background: "#000" } })
    .composite([{ input: claro, left: 0, top: 0 }, { input: escuro, left: rec.width, top: 0 }])
    .png()
    .toBuffer();
  writeFileSync(`${OUT}/${nome}.preview.png`, prev);
  const total = rec.width * rec.height;
  let transp = 0;
  for (let i = 3; i < rec.data.length; i += 4) if (rec.data[i] === 0) transp++;
  console.log(`${nome}: chave=${JSON.stringify(chave)} transparente=${((transp / total) * 100).toFixed(0)}%`);
}

await googleImagem.testar(ctx);
console.log("Conexão ok. Referência:", refPath ?? "(nenhuma)");
for (const [n, d] of sprites.filter(([n]) => !filtro || filtro.includes(n))) await sprite(n, d).catch((e) => console.error(n, "FALHOU:", (e as Error).message));
for (const [n, d] of filtro ? [] : texturas) {
  try {
    const r = await googleImagem.gerar(ctx, { prompt: d + estilo, referencias });
    writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.base64, "base64"));
    console.log(`${n}: ok`);
  } catch (e) {
    console.error(n, "FALHOU:", (e as Error).message);
  }
}
console.log(`Pronto. Abra ${OUT}/ e preencha docs/planejamento/validacao-gemini.md.`);
