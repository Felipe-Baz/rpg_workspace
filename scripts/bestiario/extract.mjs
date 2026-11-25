// Etapa 1: PDF -> pages2.json (linhas com runs estilizados + imagens com bbox) e imagens brutas em raw/
import * as mupdf from "mupdf";
import fs from "node:fs";
import crypto from "node:crypto";
const doc = mupdf.Document.openDocument(fs.readFileSync("C:/Users/felip/Documents/camu/rpg_workspace/docs/referencias/dnd_bestiario.pdf"), "application/pdf");
fs.mkdirSync("raw", { recursive: true });
const N = doc.countPages(); const A=Number(process.argv[2]), B=Math.min(N,Number(process.argv[3]));
const styleOf = (name) => ({ bold: /bold/i.test(name), italic: /Ital|Obli|BoldI$/i.test(name) });
const pages = [];
const hashCount = {};
for (let p = A; p < B; p++) {
  const page = doc.loadPage(p);
  let st; try { st = page.toStructuredText("preserve-whitespace"); } catch (e) { console.log("ERRTXT", p, String(e).slice(0,100)); pages.push({p, lines:[], images:[]}); continue; }
  const lines = []; let blk = -1, cur = null;
  st.walk({
    beginTextBlock() { blk++; },
    beginLine(bbox) { cur = { blk, x: bbox[0], y: bbox[1], x1: bbox[2], y1: bbox[3], runs: [], size: 0, font: "" }; },
    onChar(c, origin, font, size) {
      const name = font.getName(); const s = styleOf(name);
      const r = cur.runs[cur.runs.length - 1];
      if (r && r.b === s.bold && r.i === s.italic) r.t += c; else cur.runs.push({ t: c, b: s.bold, i: s.italic, f: name.replace(/^[A-Z]{6}\+/, ""), s: Math.round(size) });
    },
    endLine() { if (cur.runs.some(r => r.t.trim())) { const first = cur.runs.find(r => r.t.trim()); cur.font = first.f; cur.size = first.s; lines.push(cur); } cur = null; },
  });
  const images = [];
  const dev = new mupdf.Device({
    fillImage(img, ctm) {
      const [a, b, c, d, e, f] = ctm; const w = Math.hypot(a, b), h = Math.hypot(c, d);
      const x = e + Math.min(0, a, c), y = f + Math.min(0, b, d);
      if (h < 50 || w < 50 || w / h > 3.5 || h / w > 8) return;
      let png; try { const pm = img.toPixmap(); png = pm.asPNG(); pm.destroy(); } catch (e) { console.log("ERRIMG", p, String(e).slice(0,100)); return; }
      const hash = crypto.createHash("md5").update(png).digest("hex").slice(0, 12);
      hashCount[hash] = (hashCount[hash] || 0) + 1;
      if (!fs.existsSync(`raw/${hash}.png`)) fs.writeFileSync(`raw/${hash}.png`, png);
      images.push({ hash, x, y, w, h, px: [img.getWidth(), img.getHeight()] });
    },
  });
  try { page.run(dev, mupdf.Matrix.identity); } catch (e) { console.log("ERRPAGE", p, String(e).slice(0,100)); }
  pages.push({ p, lines, images }); try{st.destroy();}catch{} try{page.destroy();}catch{}
  if (p % 50 === 0) console.log("pagina", p);
}
fs.writeFileSync(`pages_${A}.json`, JSON.stringify({ pages }));
console.log("ok", pages.reduce((a, x) => a + x.images.length, 0), "imagens;", Object.keys(hashCount).length, "unicas");
