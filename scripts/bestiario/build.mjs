// Etapa 3: eventos -> markdowns por criatura + imagens .webp + index.json + README
import fs from "node:fs";
import path from "node:path";
import { loadPages } from "./load.mjs";
import { buildEvents, norm } from "./events.mjs";
import { parseToc } from "./toc.mjs";

// Uso (na pasta de trabalho onde o extract.mjs gravou pages_*.json e raw/): node <repo>/scripts/bestiario/build.mjs [saida]
import { fileURLToPath } from "node:url";
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = process.argv[2] ?? path.join(RAIZ, "docs/referencias/bestiario");
const { default: sharp } = await import("sharp");

const pages = loadPages();
const toc = parseToc(pages).map((t) => ({ ...t, nome: t.nome.replace("Génios", "Gênios") }));
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

let ev = buildEvents(pages, 4, 349);

// --- posiciona imagens no fluxo (antes do primeiro evento da página abaixo do topo da imagem) ---
const imgs = ev.filter((e) => e.k === "img");
ev = ev.filter((e) => e.k !== "img");
const placed = new Map(); // indice no fluxo -> imagens antes dele ("antes": number)
const after = new Map(); // indice -> imagens depois dele
for (const im of imgs) {
  let idx = ev.findIndex((e) => e.page === im.page && e.y >= im.y - 1);
  if (idx >= 0) {
    if (ev[idx].k === "h") { (after.get(idx) ?? after.set(idx, []).get(idx)).push(im); } else (placed.get(idx) ?? placed.set(idx, []).get(idx)).push(im);
  } else {
    let last = -1; ev.forEach((e, i) => { if (e.page === im.page) last = i; });
    if (last < 0) last = ev.findIndex((e) => e.page > im.page) - 1;
    (after.get(last) ?? after.set(last, []).get(last)).push(im);
  }
}
const flow = [];
ev.forEach((e, i) => {
  for (const im of placed.get(i) ?? []) flow.push({ ...im, page: im.page });
  flow.push(e);
  for (const im of after.get(i) ?? []) flow.push(im);
});

// --- segmentação por entrada do sumário ---
const main = toc.filter((t) => t.pag >= 12 && t.pag < 317);
const starts = [];
let used = new Set();
for (const t of main) {
  const nn = norm(t.nome);
  const cand = flow.map((e, i) => ({ e, i })).filter(({ e, i }) => e.k === "h" && e.lvl === 2 && e.page === t.pag && !used.has(i));
  let pick = cand.find(({ e }) => norm(e.text) === nn) ?? cand.find(({ e }) => nn.includes(norm(e.text)) || norm(e.text).includes(nn)) ?? cand[0];
  if (!pick) {
    // entrada que começa direto pelo bloco de estatísticas (o texto vem na página seguinte)
    const sbs = flow.map((e, i) => ({ e, i })).filter(({ e, i }) => e.k === "sb" && e.page === t.pag && !used.has(i));
    const sb = sbs.find(({ e }) => nn.startsWith(norm(e.name)) || norm(e.name).startsWith(nn)) ?? sbs[0];
    let i = sb.i; while (i > 0 && flow[i - 1].k === "img" && flow[i - 1].page === t.pag) i--;
    pick = { i }; console.log("começa no bloco:", t.nome, t.pag);
  }
  else if (norm(pick.e.text) !== nn) console.log("heading difere:", t.nome, "=>", pick.e.text);
  used.add(pick.i);
  // bloco de estatísticas na coluna esquerda e texto na direita: o bloco vem antes do título no fluxo
  const prefixo = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };
  const parece = (nome) => { const n2 = norm(nome); return nn.startsWith(n2) || n2.startsWith(nn) || prefixo(nn, n2) >= Math.min(6, nn.length); };
  const sbPagina = flow.map((e, i) => ({ e, i })).filter(({ e, i }) => e.k === "sb" && e.page === t.pag && i < pick.i && !used.has(i));
  if (sbPagina.length && !sbPagina.some(({ e }) => parece(e.name))) console.log("bloco antes do título, sem casar:", t.nome, "<-", sbPagina.map(({ e }) => e.name).join(", "));
  const sbAntes = sbPagina.filter(({ e }) => parece(e.name));
  let startIdx = pick.i;
  if (sbAntes.length) { startIdx = sbAntes[0].i; while (startIdx > 0 && flow[startIdx - 1].k === "img" && flow[startIdx - 1].page === t.pag) startIdx--; }
  starts.push({ t, i: startIdx });
}
starts.sort((a, b) => a.i - b.i);
const idxApA = flow.findIndex((e) => e.page >= 317);
const idxApB = flow.findIndex((e) => e.page >= 341);
const idxIntro = flow.findIndex((e) => e.page >= 4);

const rel = (idx) => idx;
const entries = [];
starts.forEach((s, n) => { entries.push({ nome: s.t.nome, pag: s.t.pag, cat: "monstros", from: s.i, to: (starts[n + 1]?.i ?? idxApA) }); });
// o que vem antes do primeiro monstro = Introdução
const intro = { nome: "Introdução", pag: 4, cat: "intro", from: idxIntro, to: starts[0].i };
// apêndices: um arquivo por bloco de estatísticas
function apendice(cat, from, to) {
  const sbs = []; for (let i = from; i < to; i++) if (flow[i].k === "sb") sbs.push(i);
  const out = [];
  const back = (i) => { while (i > from && flow[i - 1].k === "img") i--; return i; };
  const starts2 = sbs.map(back);
  out.push({ nome: cat.startsWith("apendice-a") ? "Apêndice A: Criaturas Diversas" : "Apêndice B: Personagens do Mestre", pag: flow[from].page, cat, from, to: starts2[0], apendice: true, intro: true });
  sbs.forEach((i, n) => out.push({ nome: flow[i].name, pag: flow[i].page, cat, from: starts2[n], to: starts2[n + 1] ?? to, apendice: true }));
  return out;
}
entries.push(...apendice("apendice-a-criaturas-diversas", idxApA, idxApB));
entries.push(...apendice("apendice-b-personagens-do-mestre", idxApB, flow.length));

// --- renderização ---
const imageFiles = new Map(); // hash -> nome de arquivo
const slugCount = {};
function uniqueSlug(base) { slugCount[base] = (slugCount[base] ?? 0) + 1; return slugCount[base] === 1 ? base : `${base}-${slugCount[base]}`; }

function tabela(rows) {
  const n = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(n - r.length).fill("")];
  const esc = (c) => c.replace(/\*\*(?!\*)/g, "").replace(/\|/g, "\\|");
  return [`| ${pad(rows[0]).map(esc).join(" | ")} |`, `|${" --- |".repeat(n)}`, ...rows.slice(1).map((r) => `| ${pad(r).map(esc).join(" | ")} |`)].join("\n");
}

function render(entry, fileSlug, isMain) {
  const out = []; const sbIndex = [];
  let n = 0, firstH = true, imgN = 0;
  const evs = flow.slice(entry.from, entry.to);
  let rows = [], side = [], propBuf = [];
  const flushRows = () => { if (!rows.length) return; if (rows.length >= 2) out.push(tabela(rows)); else out.push(rows[0].join(" — ")); rows = []; };
  const flushSide = () => { if (side.length) { out.push(side.join("\n>\n")); side = []; } };
  const flushProps = () => { if (propBuf.length) { out.push(propBuf.join("  \n")); propBuf = []; } };
  const flushAll = () => { flushRows(); flushSide(); flushProps(); };
  let cur = null; // bloco de estatisticas em construcao
  for (const e of evs) {
    if (e.k === "row") { flushSide(); flushProps(); if (rows.length && rows[0].length !== e.cells.length) flushRows(); rows.push(e.cells); continue; } else flushRows();
    if (e.k === "img") {
      flushAll();
      const hashFile = imageFiles.get(e.hash) ?? (() => { imgN++; const f = `${fileSlug}-${imgN}.webp`; imageFiles.set(e.hash, f); return f; })();
      out.push(`![${entry.nome}](${entry.cat === "intro" ? "" : "../"}imagens/${hashFile})`); continue;
    }
    if (e.k === "h") {
      flushAll();
      if (firstH && e.lvl === 2 && e.page === entry.pag && isMain) { firstH = false; continue; } // título já escrito no topo
      out.push(`${"#".repeat(e.lvl)} ${e.text}`); continue;
    }
    if (e.k === "sb") {
      flushAll(); cur = { nome: e.name, pagina: e.page, tipo: "", ca: "", pv: "", nd: "", xp: "" };
      sbIndex.push(cur); out.push(`## Bloco de estatísticas: ${e.name}`); continue;
    }
    if (e.k === "sec") { flushAll(); out.push(`### ${e.text}`); continue; }
    if (e.k === "abil") {
      flushAll(); const k = ["FOR", "DES", "CON", "INT", "SAB", "CAR"];
      out.push(`| ${k.join(" | ")} |\n|${" :---: |".repeat(6)}\n| ${k.map((x) => e.vals[x] ?? "").join(" | ")} |`); continue;
    }
    if (e.k === "p") {
      if (e.mode === "sidetitle") { flushProps(); flushSide(); side.push(`> **${e.md}**`); continue; }
      if (e.mode === "side") { flushProps(); side.push(`> ${e.md}`); continue; }
      flushSide();
      if (e.mode === "stat") {
        if (cur) {
          if (!cur.tipo && /^\*[^*]+\*$/.test(e.md)) cur.tipo = e.md.slice(1, -1);
          let m;
          if ((m = e.md.match(/^\*\*Classe de Armadura\*\*\s*(.+)$/))) cur.ca = m[1];
          if ((m = e.md.match(/^\*\*Pontos de Vida\*\*\s*(.+)$/))) cur.pv = m[1];
          if ((m = e.md.match(/^\*\*Nível de Desafio\*\*\s*([^\s(]+)\s*(?:\(([\d.,\s]+)\s*XP\))?/))) { cur.nd = m[1]; cur.xp = (m[2] ?? "").replace(/\s/g, ""); }
        }
        if (/^\*\*[^*]/.test(e.md) && !/^\*\*\*/.test(e.md)) { propBuf.push(e.md); continue; }
        flushProps(); out.push(e.md); continue;
      }
      flushProps();
      if (e.md.startsWith("- ") && out.length && out[out.length - 1].startsWith("- ")) out[out.length - 1] += "\n" + e.md; else out.push(e.md);
    }
  }
  flushAll();
  return { md: out.join("\n\n"), sbIndex };
}

// --- escrita ---
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ["monstros", "apendice-a-criaturas-diversas", "apendice-b-personagens-do-mestre", "imagens"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const index = [];
const listing = {};
function escreve(entry, isMain, extraHeader = "") {
  const fileSlug = entry.intro ? "introducao" : uniqueSlug(slug(entry.nome));
  const { md, sbIndex } = render(entry, fileSlug, isMain);
  const cab = `---\nnome: ${JSON.stringify(entry.nome)}\npagina: ${entry.pag}\ncategoria: ${entry.cat}\n---\n\n# ${entry.nome}\n\n`;
  const rel = `${entry.cat === "intro" ? "" : entry.cat + "/"}${fileSlug}.md`;
  fs.writeFileSync(path.join(OUT, rel), cab + md + "\n");
  for (const b of sbIndex) index.push({ nome: b.nome, ancora: ("Bloco de estatísticas: " + b.nome).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-"), familia: entry.nome, arquivo: rel, pagina: b.pagina, categoria: entry.cat, tipo: b.tipo, ca: b.ca, pv: b.pv, nd: b.nd, xp: b.xp });
  (listing[entry.cat] ??= []).push({ nome: entry.nome, rel, pag: entry.pag, nBlocos: sbIndex.length });
  return rel;
}
escreve(intro, false);
for (const e of entries) escreve(e, e.cat === "monstros" || !!e.intro);

// --- README (índice navegável) e índice de criaturas (tabela pesquisável) ---
const CATS = [
  ["monstros", "Monstros (A–Z)", "monstros"],
  ["apendice-a-criaturas-diversas", "Apêndice A: Criaturas Diversas", "apendice-a-criaturas-diversas"],
  ["apendice-b-personagens-do-mestre", "Apêndice B: Personagens do Mestre", "apendice-b-personagens-do-mestre"],
];
let readme = `# Bestiário (Manual dos Monstros, D&D 5e)\n\nConversão do PDF \`docs/referencias/dnd_bestiario.pdf\` para markdown, uma página por entrada do sumário do livro, com blocos de estatísticas completos, texto de ambientação, barras laterais e ilustrações. Gerado por \`scripts/bestiario/\` (veja o README de lá); não edite à mão, rode o gerador de novo.\n\n- **${index.length} blocos de estatísticas** em ${Object.values(listing).reduce((a, v) => a + v.length, 0)} arquivos, ${imageFiles.size} ilustrações em \`imagens/\`.\n- [Introdução](introducao.md): como ler um bloco de estatísticas (tamanho, tipo, tendência, CA, PV, ações, ND...).\n- [Índice de criaturas](indice-de-criaturas.md): tabela com tipo, CA, PV e ND de cada bloco.\n- \`index.json\`: os mesmos blocos em JSON (nome, família, arquivo, âncora, página, tipo, CA, PV, ND, XP), pensado para a futura aba do Livro.\n\nCada arquivo começa com um cabeçalho YAML (\`nome\`, \`pagina\`, \`categoria\`). Dentro dele, cada criatura aparece como \`## Bloco de estatísticas: <nome>\`; entradas com várias criaturas (Dragões, Demônios, Gigantes...) trazem todos os blocos no mesmo arquivo.\n\n`;
for (const [cat, titulo, dir] of CATS) {
  const lista = listing[cat] ?? [];
  readme += `## ${titulo}\n\n`;
  for (const x of lista) {
    if (x.rel.endsWith("/introducao.md")) { readme += `- [Introdução do apêndice](${x.rel}) (p. ${x.pag})\n`; continue; }
    const extra = x.nBlocos > 1 ? ` — ${x.nBlocos} blocos` : "";
    readme += `- [${x.nome}](${x.rel}) (p. ${x.pag})${extra}\n`;
  }
  readme += "\n";
}
fs.writeFileSync(path.join(OUT, "README.md"), readme);
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
let tab = `# Índice de criaturas\n\nTodos os blocos de estatísticas do bestiário. ND = Nível de Desafio.\n\n| Criatura | Tipo | CA | PV | ND | XP | Arquivo |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const b of [...index].sort((a, b) => a.nome.localeCompare(b.nome, "pt"))) tab += `| ${esc(b.nome)} | ${esc(b.tipo)} | ${esc(b.ca)} | ${esc(b.pv)} | ${esc(b.nd)} | ${esc(b.xp)} | [${esc(b.familia)}](${b.arquivo}#${b.ancora}) |\n`;
fs.writeFileSync(path.join(OUT, "indice-de-criaturas.md"), tab);

// --- imagens ---
let totalBytes = 0;
for (const [hash, file] of imageFiles) {
  const buf = await sharp(`raw/${hash}.png`).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  fs.writeFileSync(path.join(OUT, "imagens", file), buf); totalBytes += buf.length;
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
fs.writeFileSync("listing.json", JSON.stringify(listing));
console.log("arquivos:", Object.fromEntries(Object.entries(listing).map(([k, v]) => [k, v.length])), "blocos:", index.length, "imagens:", imageFiles.size, (totalBytes / 1e6).toFixed(1) + "MB");
