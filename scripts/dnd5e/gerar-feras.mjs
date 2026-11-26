// Gera src/data/dnd5e/phb/feras.json (as bestas que a Forma Selvagem do druida permite) a partir do bestiário
// em docs/referencias/bestiario/apendice-a-criaturas-diversas. Rodar à mão: `node scripts/dnd5e/gerar-feras.mjs`.
// Entram só criaturas do tipo "Besta" (enxames não são bestas) com ND até 6 (o Círculo da Lua chega a ND 6 no 18º nível).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PASTA = join(RAIZ, "docs/referencias/bestiario/apendice-a-criaturas-diversas");
const SAIDA = join(RAIZ, "src/data/dnd5e/phb/feras.json");

const num = (s) => Number(String(s).replace(/[–−]/g, "-").replace(",", ".").replace(/^\+/, ""));
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ndNum = (s) => (s.includes("/") ? Number(s.split("/")[0]) / Number(s.split("/")[1]) : Number(s));
const campo = (txt, rotulo) => new RegExp(`\\*\\*${rotulo}\\*\\*\\s*([^\\n]*)`).exec(txt)?.[1]?.trim() ?? "";
const limpa = (s) => s.replace(/\*\*\*?|\*/g, "").replace(/\s+/g, " ").trim();
const TAMANHOS = { miúda: "Miúda", pequena: "Pequena", média: "Média", grande: "Grande", enorme: "Enorme", imensa: "Imensa" };

/** "Ataque Corpo-a-Corpo com Arma: +5 para atingir, alcance 1,5 m, um alvo. Acerto: 10 (2d6 + 3) de dano cortante. ..." */
function lerAtaque(nome, corpo) {
  const t = limpa(corpo);
  const m = /^Ataque (Corpo-a-Corpo|à Distância|Corpo-a-Corpo ou à Distância)[^:]*:\s*([+–−-]\d+) para atingir,\s*(.*?)\.\s*Acerto:\s*(.*)$/i.exec(t);
  if (!m) return null;
  const acerto = m[4];
  const d = /^(?:\d+\s*)?\((\d+d\d+)(?:\s*([+–−-])\s*(\d+))?\)\s*de dano\s+(?:de\s+)?(\p{L}+)/iu.exec(acerto);
  const fixo = !d && /^(\d+)\s+de dano\s+(?:de\s+)?(\p{L}+)/iu.exec(acerto);
  if (!d && !fixo) return null;
  const dano = d ? d[1] : fixo[1];
  const bonusDano = d && d[3] ? (d[2] === "+" ? 1 : -1) * Number(d[3]) : 0;
  const tipoDano = d ? d[4] : fixo[2];
  // o que sobra depois da frase de dano (agarrar, derrubar, veneno...) fica como nota
  const resto = acerto.replace(/^[^.]*?de dano\s+(?:de\s+)?\p{L}+\.?/iu, "").replace(/^\s*(e|\.)\s+/i, "").trim();
  return {
    nome, corpo: !/Distância/i.test(m[1]) || /Corpo/i.test(m[1]), bonus: num(m[2]), alcance: m[3].replace(/, (um|uma) .*/i, ""),
    dano, bonusDano, tipoDano, ...(resto ? { nota: resto } : {}),
  };
}

const lista = (s) => s.split(/[;,]|\se\s/).map((x) => x.trim()).filter(Boolean);
/** Tipos de dano puros de uma linha de defesa; "de ataques não-mágicos" não vira tipo (só texto). */
const tiposPuros = (s) => s.split(";").filter((seg) => !/não-mágic/i.test(seg)).flatMap(lista);

/** Lê uma criatura de um bloco de estatísticas. `tipo` é a linha em itálico ("Besta Grande, imparcial"). */
function lerCriatura(txt, nome, tipo, extra = {}) {
  const nd = /^(\S+)/.exec(campo(txt, "Nível de Desafio"))?.[1] ?? "";
  if (!nd || ndNum(nd) > 6) return null;
  const pvL = campo(txt, "Pontos de Vida");
  const pv = Number(/^(\d+)/.exec(pvL)?.[1]);
  const dl = campo(txt, "Deslocamento");
  const bloco = txt.split(/^## Bloco de estatísticas.*$/m)[1] ?? txt;
  const tabela = /\|\s*(\d+) \([^)]*\)\s*\|\s*(\d+) \([^)]*\)\s*\|\s*(\d+) \([^)]*\)\s*\|\s*(\d+) \([^)]*\)\s*\|\s*(\d+) \([^)]*\)\s*\|\s*(\d+) \([^)]*\)\s*\|/.exec(bloco);
  if (!pv || !tabela) { console.warn(`ignorada (formato): ${nome}`); return null; }
  const [, f, d, c, i, s, ca] = tabela.map(Number);
  const [antes, depoisAcoes = ""] = bloco.split(/^### Ações\s*$/m);
  // traços: parágrafos "***Nome***. texto" entre o ND e as ações
  const tracos = [];
  for (const p of antes.split(/\n\n/)) {
    const m = /^\*\*\*([^*]+)\*\*\*\.\s*([\s\S]+)$/.exec(p.trim());
    if (m) tracos.push({ nome: m[1].trim(), texto: limpa(m[2]) });
  }
  const ataques = [];
  const acoes = [];
  for (const p of depoisAcoes.split(/\n\n/)) {
    const m = /^\*\*\*([^*]+)\*\*\*\.\s*([\s\S]+)$/.exec(p.trim());
    if (!m) continue;
    const a = /^Ataque/.test(limpa(m[2])) ? lerAtaque(m[1].trim(), m[2]) : null;
    if (a) ataques.push(a); else acoes.push({ nome: m[1].trim(), texto: limpa(m[2]) });
  }
  if (!ataques.length) console.warn(`sem ataque lido: ${nome}`);
  const pericias = {};
  for (const p of campo(txt, "Perícias").split(",")) { const m = /^\s*(.+?)\s+([+–−-]\d+)\s*$/.exec(p); if (m) pericias[m[1]] = num(m[2]); }
  const veloc = (r) => { const m = new RegExp(r + String.raw`\s+(\d+(?:,\d+)?)\s*m`).exec(dl); return m ? num(m[1]) : undefined; };
  const defesas = {
    resistencias: tiposPuros(campo(txt, "Resistência a Dano")),
    vulnerabilidades: tiposPuros(campo(txt, "Vulnerabilidade a Dano")),
    imunidades: tiposPuros(campo(txt, "Imunidade a Dano")),
  };
  const defesasTexto = [["Resistência a dano", "Resistência a Dano"], ["Vulnerabilidade a dano", "Vulnerabilidade a Dano"], ["Imunidade a dano", "Imunidade a Dano"], ["Imunidade a condição", "Imunidade a Condição"]]
    .map(([r, k]) => (campo(txt, k) ? `${r}: ${campo(txt, k)}` : "")).filter(Boolean);
  return {
    id: slug(nome), nome, tamanho: TAMANHOS[/^\S+ ([^\s,]+)/.exec(tipo)[1].toLowerCase()] ?? "Média",
    nd, ndNum: ndNum(nd), ca: Number(/^(\d+)/.exec(campo(txt, "Classe de Armadura"))?.[1]), caTexto: campo(txt, "Classe de Armadura"),
    pv, pvTexto: pvL, deslocamento: dl, voa: veloc("voo") != null, nada: veloc("natação") != null,
    atributos: { for: f, des: d, con: c, int: i, sab: s, car: ca }, pericias, sentidos: campo(txt, "Sentidos"),
    ...(defesas.resistencias.length || defesas.vulnerabilidades.length || defesas.imunidades.length ? { defesas } : {}),
    ...(defesasTexto.length ? { defesasTexto } : {}),
    tracos, ataques, acoes, ...extra,
  };
}

const feras = [];
for (const arq of readdirSync(PASTA).filter((a) => a.endsWith(".md") && a !== "introducao.md").sort()) {
  const txt = readFileSync(join(PASTA, arq), "utf8").split(String.fromCharCode(13)).join("");
  const tipo = /^\*(Besta [^*\n]*)\*$/m.exec(txt)?.[1];
  if (!tipo) continue;
  const c = lerCriatura(txt, /^nome:\s*"(.*)"/m.exec(txt)?.[1] ?? arq, tipo);
  if (c) feras.push(c);
}
// Forma Selvagem de Elemental (Círculo da Lua, 10º nível): os quatro elementais do bestiário
const txtElem = readFileSync(join(RAIZ, "docs/referencias/bestiario/monstros/elementais.md"), "utf8").split(String.fromCharCode(13)).join("");
for (const bloco of txtElem.split(/^## Bloco de estatísticas: /m).slice(1)) {
  const nome = bloco.split("\n")[0].trim();
  if (!/^Elemental d[oa]s? (Água|Terra|Ar|Fogo)$/.test(nome)) continue;
  const tipo = /^\*(Elemental [^*\n]*)\*$/m.exec(bloco)?.[1];
  const c = lerCriatura(bloco, nome, tipo, { elemental: true });
  if (c) feras.push(c);
}
feras.sort((a, b) => a.ndNum - b.ndNum || a.nome.localeCompare(b.nome, "pt"));
writeFileSync(SAIDA, JSON.stringify(feras, null, 1) + "\n");
console.log(`${feras.length} feras → ${SAIDA}`);
