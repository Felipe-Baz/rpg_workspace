// Etapa 2: páginas -> fluxo de eventos (h, sb, sec, p, abil, img)
import { loadPages, lt } from "./load.mjs";

export const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const SMALL = new Set(["de","da","do","das","dos","e","a","o","as","os","em","com","para","por","ao","à","no","na","nos","nas","ou","um","uma"]);
export function titulo(s) {
  s = s.replace(/\s+/g, " ").trim();
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(\/-])([a-zà-ú])([^\s)\/-]*)/g, (m, pre, c, rest, off) => {
    const w = c + rest;
    return pre + (off > 0 && SMALL.has(w) ? w : c.toUpperCase() + rest);
  });
}

/** runs -> markdown inline (negrito/itálico) */
export function inline(runs) {
  let out = "";
  for (const r of runs) {
    const t = r.t.replace(/\s+/g, " ");
    if (!t.trim()) { out += t; continue; }
    const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0], core = t.trim();
    const m = r.b && r.i ? "***" : r.b ? "**" : r.i ? "*" : "";
    out += lead + m + core + m + trail;
  }
  return out.replace(/\*\*\*\*|\*\*\s*\*\*/g, " ").replace(/(\*+)\s+(\*+)/g, "$1 $2");
}

const isCal = (l) => /^Calibri/i.test(l.font);
const isCen = (l) => /^Century|^CenturySchoolbook|^Kanzlei/i.test(l.font);
const firstBold = (l) => { const r = l.runs.find((r) => r.t.trim()); return !!r && r.b; };

export function buildEvents(pages, from, to) {
  const ev = [];
  let mode = "lore"; // lore | stat | side
  let pendAbil = false;
  for (let p = from; p <= to; p++) {
    const pg = pages[p]; if (!pg) continue;
    let lines = pg.lines.filter((l) => {
      const t = lt(l).trim();
      if (!t) return false;
      if (/^\d{1,3}$/.test(t) && l.y > 780) return false; // numero de pagina
      if (l.size >= 36) return false; // capitular decorativa
      return true;
    });
    const colOf = (l) => (l.x < 297 ? 0 : 1);
    const cols = [0, 1].map((c) => lines.filter((l) => colOf(l) === c).sort((a, b) => a.y - b.y || a.x - b.x));
    // margem esquerda de cada coluna = x mais comum entre as linhas de texto corrido (Century regular)
    const base = cols.map((col) => {
      const h = {};
      for (const l of col) if (isCen(l) && !/bold/i.test(l.font)) { const k = Math.round(l.x); h[k] = (h[k] || 0) + 1; }
      const e = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
      return e ? +e[0] : 0;
    });
    for (const col of cols) {
      // junta linhas na mesma altura (linhas de tabela / linha de atributos)
      const rows = [];
      for (const l of col) {
        const last = rows[rows.length - 1];
        if (last && Math.abs(l.y - last.y) < 2.5) last.lines.push(l); else rows.push({ y: l.y, y1: l.y1, lines: [l] });
      }
      let prev = null, para = null;
      const flush = () => { if (para) { ev.push(para); para = null; } };
      for (const row of rows) {
        row.lines.sort((a, b) => a.x - b.x);
        const l0 = row.lines[0];
        const text = row.lines.map(lt).join(" ").replace(/\s+/g, " ").trim();
        // linha de atributos (rotulos e valores em linhas separadas ou juntas)
        if (/^FOR\s+DES\s+CON\s+INT\s+SAB\s+CAR$/.test(text)) { flush(); pendAbil = true; continue; }
        if (pendAbil && /^(\d+\s*\(\s*[+–\-−]\s*\d+\s*\)\s*){6}$/.test(text)) {
          pendAbil = false; const v = [...text.matchAll(/(\d+)\s*\(\s*([+–\-−])\s*(\d+)\s*\)/g)];
          const vals = {}; ["FOR","DES","CON","INT","SAB","CAR"].forEach((k, i) => (vals[k] = v[i][1] + " (" + v[i][2] + v[i][3] + ")"));
          ev.push({ k: "abil", vals, page: p, y: row.y }); mode = "stat"; prev = null; continue;
        }
        pendAbil = false;
        // seis valores sem rótulos (às vezes colados ao fim de outra linha, ex.: "Deslocamento 9 m 11 (+0) ...", ou com erro de digitação no modificador)
        const vm = [...text.matchAll(/(\d{1,2})\s*\(\s*[+–\-−)][^()]*\)+/g)];
        if (vm.length === 6 && !/\bFOR\b/.test(text) && (mode === "stat" || vm[0].index === 0)) {
          flush();
          const prefix = text.slice(0, vm[0].index).trim();
          const pm = prefix.match(/^([A-Za-zÀ-ú ]+?)\s+(\d.*)$/);
          if (prefix) ev.push({ k: "p", mode: "stat", md: pm ? `**${pm[1]}** ${pm[2]}` : prefix, firstBold: true, page: p, y: row.y });
          const vals = {};
          ["FOR", "DES", "CON", "INT", "SAB", "CAR"].forEach((k, i) => { const s = +vm[i][1], m = Math.floor((s - 10) / 2); vals[k] = `${s} (${m < 0 ? "–" + -m : "+" + m})`; });
          ev.push({ k: "abil", vals, page: p, y: row.y }); mode = "stat"; prev = null; continue;
        }
        if (/\bFOR\b.*\bDES\b.*\bCON\b.*\bINT\b.*\bSAB\b.*\bCAR\b/.test(text)) {
          flush();
          const vals = {}; for (const m of text.matchAll(/(FOR|DES|CON|INT|SAB|CAR)\s+(\d+\s*\(\s*[+–\-−]\s*\d+\s*\))/g)) vals[m[1]] = m[2].replace(/\s+/g, "").replace("(", " (");
          ev.push({ k: "abil", vals, page: p, y: row.y }); mode = "stat"; prev = null; continue;
        }
        const cal = isCal(l0), cen = isCen(l0);
        // títulos
        if (cen && /bold/i.test(l0.font) && l0.size >= 12 && row.lines.length === 1) {
          flush(); mode = "lore";
          ev.push({ k: "h", lvl: l0.size >= 13 ? 2 : 3, text: titulo(text), size: l0.size, page: p, y: row.y }); prev = null; continue;
        }
        if (cen && /bold/i.test(l0.font) && l0.size >= 10 && l0.size < 12 && row.lines.length === 1 && text.length < 80 && !/[.:]$/.test(text) && text === text.toUpperCase()) {
          flush(); mode = "lore"; ev.push({ k: "h", lvl: 3, text: titulo(text), size: l0.size, page: p, y: row.y }); prev = null; continue;
        }
        if (cal && /bold/i.test(l0.font) && l0.size >= 12 && row.lines.length === 1) {
          flush(); mode = "stat"; ev.push({ k: "sb", name: titulo(text), page: p, y: row.y }); prev = null; continue;
        }
        if (cal && /bold/i.test(l0.font) && l0.size >= 10 && l0.size <= 11 && text === text.toUpperCase() && text.length < 60 && row.lines.length === 1) {
          flush();
          if (mode === "stat") ev.push({ k: "sec", text: titulo(text), page: p, y: row.y }); else { mode = "side"; ev.push({ k: "p", mode: "sidetitle", md: titulo(text), page: p, y: row.y }); }
          prev = null; continue;
        }
        if (cen && mode !== "lore") { flush(); mode = "lore"; prev = null; }
        if (cal && mode === "lore") { flush(); mode = "stat"; prev = null; } // continuação do bloco na outra coluna (barras laterais sempre têm título)
        // tabela: varias celulas na mesma linha
        if (row.lines.length >= 2 && mode !== "stat" && row.lines.every((x) => lt(x).trim().length < 60)) {
          flush(); ev.push({ k: "row", cells: row.lines.map((x) => inline(x.runs).trim()), mode, page: p, y: row.y }); prev = null; continue;
        }
        let md = row.lines.map((x) => inline(x.runs).trim()).join(" ");
        const bullet = /^[\s-•·▪◦]+/.test(md) && /[-•·▪◦]/.test(md.slice(0, 4)) || l0.font === "Symbol";
        if (bullet) md = "- " + md.replace(/^[\s-•·▪◦]+/, "");
        const f0 = l0.runs.find((r) => r.t.trim());
        const boldItal = !!f0 && f0.b && f0.i;
        const gap = prev ? row.y - prev.y1 : 0;
        const dx = l0.x - base[colOf(l0)];
        const startsPara = bullet || (mode === "stat" ? firstBold(l0) : mode === "side" ? boldItal : (dx > 4 && dx < 22) || boldItal);
        // quebra de paragrafo
        let brk;
        if (para) {
          const emItem = para.md.startsWith("- ") && !bullet && mode === "lore" && !boldItal; // recuo pendente de item de lista
          brk = (startsPara && !emItem) || gap > (mode === "lore" ? 3.5 : 4);
        }
        else {
          // inicio de coluna/pagina: continua o paragrafo anterior se nao parece inicio de paragrafo
          const last = ev[ev.length - 1];
          const bare = md.replace(/^[*\s]+/, "");
          const cont = last && last.k === "p" && last.mode === mode && !startsPara && (/^[a-zà-ú0-9(,;.]/.test(bare) || !/[.!?:)"”*]\s*$/.test(last.md));
          if (cont) { para = ev.pop(); brk = false; } else brk = true;
        }
        if (brk) { flush(); para = { k: "p", mode, md, firstBold: firstBold(l0), page: p, y: row.y }; }
        else para.md += (para.md.endsWith("-") && !para.md.endsWith(" -") ? "" : " ") + md;
        prev = { y1: row.y1 };
      }
      flush();
    }
    // imagens da pagina -> evento img alinhado pela altura
    for (const im of pg.images) ev.push({ k: "img", hash: im.hash, page: p, y: im.y, w: im.w, h: im.h });
  }
  return ev;
}
