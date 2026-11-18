// Reaplica o chroma key aos *.bruto.png de validacao-gemini-saida/ sem chamar a API.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { RemovedorFundoChroma, detectarCorFundo } from "../src/lib/mapas-ia/fundo.ts";

const OUT = "validacao-gemini-saida";
const tol = Number(process.argv[2] ?? 90);
for (const f of readdirSync(OUT).filter((f) => f.endsWith(".bruto.png"))) {
  const nome = f.replace(".bruto.png", "");
  const { data, info } = await sharp(readFileSync(`${OUT}/${f}`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
  const chave = detectarCorFundo(px);
  const rec = RemovedorFundoChroma.remover(px, { corChave: chave, tolerancia: tol });
  const png = await sharp(Buffer.from(rec.data), { raw: { width: rec.width, height: rec.height, channels: 4 } }).png().toBuffer();
  writeFileSync(`${OUT}/${nome}.recorte.png`, png);
  const lado = (c: string) => sharp({ create: { width: rec.width, height: rec.height, channels: 3, background: c } }).composite([{ input: png }]).png().toBuffer();
  const [a, b] = await Promise.all([lado("#f2f2f2"), lado("#202020")]);
  writeFileSync(`${OUT}/${nome}.preview.png`, await sharp({ create: { width: rec.width * 2, height: rec.height, channels: 3, background: "#000" } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: rec.width, top: 0 }]).png().toBuffer());
  let t = 0, p = 0;
  for (let i = 3; i < rec.data.length; i += 4) { if (rec.data[i] === 0) t++; else if (rec.data[i] < 255) p++; }
  const n = rec.width * rec.height;
  console.log(`${nome}: chave=${JSON.stringify(chave)} transparente=${((t / n) * 100).toFixed(1)}% parcial=${((p / n) * 100).toFixed(2)}%`);
}
