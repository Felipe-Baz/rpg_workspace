// Validação manual da change 08 (tarefa 1.2): confirma se o Gemini serve como segmentador (máscaras por visão)
// e como removedor de objeto no fundo (inpainting por instrução), com o mesmo núcleo usado pelo servidor.
//   node --env-file=.env scripts/validar-conversao.ts caminho/mapa.jpg [maxObjetos]
// Saída em validacao-conversao-saida/: mascaras.png (contornos sobre o mapa), fundo.png (reconstruído),
// objeto-N.png (sprites) e resumo.json. Gasta 1 chamada de LLM + 1 de imagem a cada 4 objetos.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { LADO_TRABALHO, converterMapa, prepararRevisao, mascaraDe, type DepsConversao } from "../src/lib/mapas-ia/conversao/conversao.ts";
import { mascaraDoSegmento } from "../src/lib/mapas-ia/conversao/mascaras.ts";
import { googleImagem } from "../src/lib/mapas-ia/provedores/google-imagem.ts";
import { googleSegmentacao } from "../src/lib/mapas-ia/provedores/google-segmentacao.ts";
import type { PixelsRgba } from "../src/lib/mapas-ia/fundo.ts";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("Defina GOOGLE_API_KEY.");
const arquivo = process.argv[2];
if (!arquivo) throw new Error("Informe a imagem do mapa.");
const max = Number(process.argv[3] ?? 6);
const ctxLlm = { config: { apiKey, ...(process.env.GEMINI_LLM ? { modelo: process.env.GEMINI_LLM } : {}) }, http: fetch };
const ctxImg = { config: { apiKey, ...(process.env.GEMINI_MODELO ? { modelo: process.env.GEMINI_MODELO } : {}) }, http: fetch };
const OUT = "validacao-conversao-saida";
mkdirSync(OUT, { recursive: true });

const raw = async (s: ReturnType<typeof sharp>): Promise<PixelsRgba> => {
  const { data, info } = await s.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
};
const png = (px: PixelsRgba) => sharp(Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength), { raw: { width: px.width, height: px.height, channels: 4 } }).png().toBuffer();
const jpgB64 = async (px: PixelsRgba, lado: number) =>
  (await sharp(await png(px)).resize(lado, lado, { fit: "inside" }).flatten({ background: "#000" }).jpeg({ quality: 92 }).toBuffer()).toString("base64");

const buf = readFileSync(arquivo);
const original = await raw(sharp(buf).rotate().resize(4096, 4096, { fit: "inside", withoutEnlargement: true }));
const trabalho = await raw(sharp(buf).rotate().resize(LADO_TRABALHO, LADO_TRABALHO, { fit: "inside", withoutEnlargement: true }));

let t0 = Date.now();
const brutos = await googleSegmentacao.segmentar(ctxLlm, { imagem: { mime: "image/jpeg", base64: await jpgB64(trabalho, LADO_TRABALHO) }, maxObjetos: 20 });
const tSeg = Date.now() - t0;
let id = 0;
const comMascara = await Promise.all(
  brutos.map(async (b) => ({
    rotulo: b.rotulo,
    mascara: mascaraDoSegmento(trabalho.width, trabalho.height, b.caixa, b.mascara ? await raw(sharp(Buffer.from(b.mascara.base64, "base64"))).catch(() => undefined) : undefined),
  })),
);
const rev = prepararRevisao(trabalho.width, trabalho.height, comMascara, () => `s${id++}`, max);
console.log(`segmentação: ${brutos.length} brutos, ${rev.segmentos.length} válidos (${tSeg} ms); com máscara: ${brutos.filter((b) => b.mascara).length}`);

// Contornos coloridos sobre o mapa de trabalho.
const vis = { ...trabalho, data: new Uint8ClampedArray(trabalho.data) };
rev.segmentos.forEach((s, k) => {
  const m = mascaraDe(rev, s);
  const cor = [[255, 60, 60], [60, 200, 255], [255, 220, 0], [120, 255, 120], [255, 120, 255], [255, 160, 60]][k % 6];
  for (let p = 0; p < m.bits.length; p++) if (m.bits[p]) for (let c = 0; c < 3; c++) vis.data[p * 4 + c] = vis.data[p * 4 + c] * 0.5 + cor[c] * 0.5;
});
writeFileSync(`${OUT}/mascaras.png`, await png(vis));

const aceitos = rev.segmentos.filter((s) => s.aceito);
const arquivos: string[] = [];
let n = 0;
t0 = Date.now();
const deps: DepsConversao = {
  editar: async (img, prompt) => {
    const r = await googleImagem.editar!(ctxImg, { prompt, imagem: { mime: "image/jpeg", base64: await jpgB64(img, 1536) } });
    return raw(sharp(Buffer.from(r.base64, "base64")).resize(img.width, img.height, { fit: "fill" }));
  },
  registrarUso: async () => {},
  salvarImagem: async (px, uso) => {
    const nome = uso === "fundo" ? "fundo.png" : `objeto-${++n}.png`;
    writeFileSync(`${OUT}/${nome}`, await png(px));
    arquivos.push(nome);
    return { url: nome, caminho: nome };
  },
  copiarImagemDoMapa: async () => ({ url: arquivo }),
  apagarArquivo: async () => {},
  gravarAsset: async () => {},
  apagarAsset: async () => {},
  gravarCena: async () => {},
  apagarCena: async () => {},
  copiarPinos: async () => {},
  apagarPinos: async () => {},
  gravarMapa: async () => {},
  aoProgredir: (etapa, pct) => console.log(`  ${pct}% ${etapa}`),
  novoId: () => `id${id++}`,
};
let erro: string | undefined;
let resultado;
try {
  resultado = await converterMapa(
    { mapa: { id: "validacao", nome: "validação" }, original, pedido: { mapaId: "validacao", colecao: "mapas", largura: rev.largura, altura: rev.altura, objetos: aceitos.map((s) => ({ nome: s.nome, rle: s.rle, incompleto: s.incompleto })) } },
    deps,
  );
} catch (e) {
  erro = (e as Error).message;
}
const resumo = {
  imagem: arquivo,
  tamanho: `${original.width}x${original.height}`,
  segmentos: rev.segmentos.map((s) => ({ nome: s.nome, aceito: s.aceito, incompleto: s.incompleto })),
  tempoSegmentacaoMs: tSeg,
  tempoConversaoMs: Date.now() - t0,
  arquivos,
  avisos: resultado?.avisos,
  erro,
};
writeFileSync(`${OUT}/resumo.json`, JSON.stringify(resumo, null, 2));
console.log(erro ? `FALHOU: ${erro}` : `ok: ${arquivos.length} arquivos em ${OUT}/`);
