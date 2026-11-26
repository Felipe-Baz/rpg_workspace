// Equipamento do Livro do Jogador (armas, armaduras, itens, ferramentas, pacotes) → JSON do pacote "phb".
// Chamado por scripts/gerar-catalogo-dnd5e.mjs.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const celulas = (l) => l.split("|").slice(1, -1).map((c) => c.trim());
const negrito = (c) => c.match(/^\*\*(.+)\*\*$/)?.[1].trim();

function dinheiro(s, avisos, ctx) {
  const t = s.replace(/\s+/g, "").replace(/\./g, "");
  const m = t.match(/^(\d+)(pc|pp|pe|po|pl)$/);
  if (!m) { if (!/^[–*-]*$/.test(t)) avisos.push(`Preço não reconhecido (${ctx}): "${s}"`); return undefined; }
  return { valor: Number(m[1]), moeda: m[2] };
}
function peso(s, avisos, ctx) {
  const t = s.trim();
  if (/^[–*-]*$/.test(t)) return 0;
  const m = t.match(/^([\d,]+)\s*kg$/);
  if (!m) { avisos.push(`Peso não reconhecido (${ctx}): "${s}"`); return 0; }
  return Number(m[1].replace(",", "."));
}

/** Linhas de tabela entre dois marcadores de texto. */
function tabela(md, ini, fim, cabecalho) {
  const i = md.indexOf(ini);
  const j = fim ? md.indexOf(fim, i + 1) : md.length;
  const linhas = md.slice(i, j).split("\n");
  const k = linhas.findIndex((l) => l.startsWith(cabecalho));
  if (i < 0 || k < 0) return [];
  const rows = [];
  for (const l of linhas.slice(k + 2)) { if (!l.startsWith("|")) break; rows.push(celulas(l)); }
  return rows;
}

function armaduras(md, avisos) {
  const out = [];
  let cat = "";
  for (const c of tabela(md, "### Armadura Leve", "### Propriedades das Armas", "| Nome | Preço | Classe de Armadura")) {
    const g = negrito(c[0]);
    if (g) { cat = /leve/i.test(g) ? "leve" : /média/i.test(g) ? "media" : /pesada/i.test(g) ? "pesada" : "escudo"; continue; }
    const ca = c[2];
    const m = ca.match(/^(\+?\d+)(?: \+ modificador de Des(?: \(máx\. \+(\d)\))?)?$/);
    if (!m) { avisos.push(`CA de armadura não reconhecida: ${c[0]} "${ca}"`); continue; }
    const escudo = cat === "escudo";
    out.push({
      id: slug(c[0]), nome: c[0], pacote: "phb", tipo: escudo ? "escudo" : "armadura", categoria: cat,
      preco: dinheiro(c[1], avisos, c[0]),
      ...(escudo ? { bonusCa: Number(m[1]) } : { caBase: Number(m[1]), somaDes: /Des/.test(ca), ...(m[2] ? { maxDes: Number(m[2]) } : {}) }),
      ...(c[3] && c[3] !== "–" ? { forca: Number(c[3].match(/\d+/)?.[0]) } : {}),
      ...(/desvantagem/i.test(c[4]) ? { furtividadeDesv: true } : {}),
      peso: peso(c[5], avisos, c[0]),
    });
  }
  if (out.length !== 13) avisos.push(`Esperadas 12 armaduras + escudo, lidas ${out.length}`);
  return out;
}

function propriedades(txt, avisos, nome) {
  const p = {};
  if (!txt || txt === "–") return p;
  for (const bruto of txt.split(/,\s*(?![^(]*\))/)) {
    const t = bruto.trim().toLowerCase();
    let m;
    if (t === "acuidade") p.acuidade = true;
    else if (t === "leve") p.leve = true;
    else if (t === "pesada") p.pesada = true;
    else if (t === "duas mãos") p.duasMaos = true;
    else if (t === "alcance") p.alcance = true;
    else if (t === "recarga") p.recarga = true;
    else if (t === "especial") p.especial = true;
    else if ((m = t.match(/^arremesso \((?:distância )?([\d,.]+)\/([\d,.]+)\)$/))) p.arremesso = { normal: Number(m[1].replace(",", ".")), longo: Number(m[2].replace(",", ".")) };
    else if ((m = t.match(/^versátil \((\d+d\d+)\)$/))) p.versatil = m[1];
    else if ((m = t.match(/^munição \((?:distância )?([\d,.]+)\/([\d,.]+)\)$/))) p.municao = { normal: Number(m[1].replace(",", ".")), longo: Number(m[2].replace(",", ".")) };
    else avisos.push(`Propriedade não reconhecida em ${nome}: "${bruto}"`);
  }
  return p;
}

function armas(md, avisos) {
  const out = [];
  let cat = "", dist = false;
  for (const c of tabela(md, "#### Armas", "**Equipamento**", "| Nome | Preço | Dano")) {
    const g = negrito(c[0]);
    if (g) { cat = /simples/i.test(g) ? "simples" : "marcial"; dist = /distância/i.test(g); continue; }
    const d = c[2].match(/^(\d+(?:d\d+)?) (\S+)$/);
    out.push({
      id: slug(c[0]), nome: c[0], pacote: "phb", tipo: "arma", categoria: cat, distancia: dist,
      preco: dinheiro(c[1], avisos, c[0]),
      ...(d ? { dado: d[1], tipoDano: d[2] } : {}),
      peso: peso(c[3], avisos, c[0]),
      propriedades: propriedades(c[4], avisos, c[0]),
    });
    if (!d && c[0] !== "Rede") avisos.push(`Dano não reconhecido: ${c[0]} "${c[2]}"`);
  }
  if (out.length !== 37) avisos.push(`Esperadas 37 armas, lidas ${out.length}`);
  return out;
}

function itens(md, avisos) {
  const out = [];
  const add = (linhas, tipo) => {
    let grupo = "";
    for (const c of linhas) {
      const g = negrito(c[0]);
      if (g) { grupo = g; continue; }
      if (/^\*/.test(c[1])) continue; // "Veículos: ver outra seção"
      const preco = dinheiro(c[1], avisos, c[0]);
      if (!preco) continue;
      out.push({ id: slug(c[0]), nome: c[0], pacote: "phb", tipo, ...(grupo ? { grupo } : {}), preco, peso: peso(c[2], avisos, c[0]) });
    }
  };
  add(tabela(md, "**Equipamento**", "#### Pacotes de Equipamento", "| Item | Custo | Peso |"), "item");
  // a tabela de equipamento é interrompida por um cabeçalho repetido: lê o segundo trecho
  const i2 = md.indexOf("| Lâmpada |");
  if (i2 > 0) {
    const resto = [];
    for (const l of md.slice(i2).split("\n")) { if (!l.startsWith("|")) break; resto.push(celulas(l)); }
    add(resto, "item");
  }
  add(tabela(md, "#### Ferramentas", "## Montarias e Veículos", "| Item | Custo | Peso |"), "ferramenta");
  // remove duplicatas por id (mantém a primeira)
  const vistos = new Set();
  return out.filter((x) => (vistos.has(x.id) ? false : (vistos.add(x.id), true)));
}

const QTD = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4, cinco: 5 };
const normNome = (s) => semAcento(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/s\b/g, "");

function pacotes(md, todos, avisos) {
  const i = md.indexOf("#### Pacotes de Equipamento");
  const j = md.indexOf("#### Capacidade de Recipientes");
  const texto = md.slice(i, j);
  const porNome = new Map(todos.map((x) => [normNome(x.nome), x]));
  const out = [];
  for (const m of texto.matchAll(/\*\*(Pacote de [^(*]+?)\s*\(([\d.]+) po\)\.\*\*\s*Inclui ([^*]+?)\.(?=\*\*|\s*$)/g)) {
    const itensP = [];
    for (const parte of m[3].split(/,\s*|\s+e\s+(?=[\p{L}\d])/u)) {
      const t = parte.trim().replace(/\.$/, "");
      if (!t) continue;
      const q = t.match(/^(\d[\d.]*|um|uma|dois|duas|três|quatro|cinco)\s+(?:dias? de |metros? de |de )?(.*)$/i);
      const qtd = q ? (/^\d/.test(q[1]) ? Number(q[1].replace(/\./g, "")) : QTD[q[1].toLowerCase()]) : 1;
      const nome = (q ? q[2] : t).replace(/^(?:um|uma) /i, "");
      const alvo = porNome.get(normNome(nome)) ?? [...porNome.entries()].find(([k]) => k.startsWith(normNome(nome)) || normNome(nome).startsWith(k))?.[1];
      itensP.push(alvo ? { ref: alvo.id, nome: alvo.nome, qtd } : { nome: nome.charAt(0).toUpperCase() + nome.slice(1), qtd });
    }
    out.push({ id: slug(m[1]), nome: m[1].trim(), pacote: "phb", tipo: "pacote", preco: { valor: Number(m[2].replace(/\./g, "")), moeda: "po" }, itens: itensP });
  }
  if (out.length !== 7) avisos.push(`Esperados 7 pacotes de equipamento, lidos ${out.length}`);
  return out;
}

/** Linhas de uma tabela que começa em "## Seção" ou "#### Título" e tem o cabeçalho dado. */
function linhasDaTabela(md, ini, cabecalho) {
  const i = md.indexOf(ini);
  if (i < 0) return [];
  const linhas = md.slice(i).split("\n");
  const k = linhas.findIndex((l) => l.startsWith(cabecalho));
  if (k < 0) return [];
  const rows = [];
  for (const l of linhas.slice(k + 2)) { if (!l.startsWith("|")) break; rows.push(celulas(l)); }
  return rows;
}

/** Montarias, arreios, veículos, comida/hospedagem e serviços do capítulo 5: itens de preço com uma nota (deslocamento, carga...). */
function outrosItens(md, avisos) {
  const out = [];
  const guarda = (grupo, nome, preco, pesoKg, nota) => out.push({ id: slug(`${grupo}-${nome}`), nome, pacote: "phb", tipo: "item", grupo, preco, peso: pesoKg, ...(nota ? { nota } : {}) });
  // montarias: Item | Custo | Deslocamento | Capacidade de Carga
  for (const c of linhasDaTabela(md, "#### Montarias e Outros Animais", "| Item | Custo | Deslocamento |")) {
    const p = dinheiro(c[1], avisos, c[0]); if (p) guarda("Montarias e outros animais", c[0], p, 0, `deslocamento ${c[2]}, carga ${c[3]}`);
  }
  // arreios e veículos de tração: Item | Custo | Peso; "**Sela**" abre um subgrupo
  let sub = "";
  for (const c of linhasDaTabela(md, "#### Arreios, Selas e Veículos de Tração", "| Item | Custo | Peso |")) {
    const g = negrito(c[0]); if (g) { sub = g; continue; }
    if (/^X\d/.test(c[1])) continue; // armadura de montaria: preço e peso são multiplicadores da armadura comum
    const p = dinheiro(c[1], avisos, c[0]); if (!p) continue;
    const nome = sub && /^(Compacta|Exótica|Militar|Viagem)$/.test(c[0]) ? `${sub} ${c[0] === "Viagem" ? "de viagem" : c[0].toLowerCase()}` : c[0];
    guarda("Arreios, selas e veículos de tração", nome, p, peso(c[2], avisos, c[0]), "");
  }
  // veículos aquáticos: Item | Custo | Velocidade
  for (const c of linhasDaTabela(md, "**Veículos Aquáticos**", "| Item | Custo | Velocidade |")) {
    const p = dinheiro(c[1], avisos, c[0]); if (p) guarda("Veículos aquáticos", c[0], p, 0, `velocidade ${c[2]}`);
  }
  // comida, bebida e hospedagem: linhas sem custo abrem um subgrupo
  sub = "";
  for (const c of linhasDaTabela(md, "#### Comida, Bebida e Hospedagem", "| Item | Custo |")) {
    if (!c[1]) { sub = c[0]; continue; }
    const p = dinheiro(c[1], avisos, c[0]); if (!p) continue;
    const filho = /^(Esquálid|Pobre|Modest|Confortável|Rica|Aristocrát|Galão|Caneca|Comum|Fino)/.test(c[0]);
    guarda("Comida, bebida e hospedagem", filho && sub ? `${sub}: ${c[0]}` : c[0], p, 0, "");
    if (!filho) sub = "";
  }
  // serviços: Serviço | Pagamento ("2 pc por km")
  sub = "";
  for (const c of linhasDaTabela(md, "**Serviços**", "| Serviço | Pagamento |")) {
    if (!c[1]) { sub = c[0]; continue; }
    const m = c[1].replace(/\./g, "").match(/^(\d+)\s*(pc|pp|pe|po|pl)\s*(.*)$/);
    if (!m) { avisos.push(`Serviço não reconhecido: "${c[1]}"`); continue; }
    guarda("Serviços", sub && /^(Dentro da cidade|Entre cidades|Destreinado|Treinado)$/.test(c[0]) ? `${sub}: ${c[0]}` : c[0], { valor: Number(m[1]), moeda: m[2] }, 0, m[3] || "");
  }
  return out;
}

/** Tabela Bugigangas (d100, duas partes): lista de textos na ordem do d100. */
export function gerarBugigangas(dirFonte) {
  const md = readFileSync(join(dirFonte, "dnd5e-equipamento.md"), "utf8").replace(/\r\n/g, "\n");
  // a tabela vem em vários trechos: lê toda linha "| NN | texto |" depois do título, na ordem do d100
  const ini = md.indexOf("#### Bugigangas");
  const porNumero = new Map();
  for (const l of md.slice(ini).split("\n")) {
    const m = l.match(/^\|\s*(\d{1,3})\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) porNumero.set(Number(m[1]), m[2]);
  }
  return [...porNumero.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
}

export function gerarEquipamento(dirFonte) {
  const avisos = [];
  const md = readFileSync(join(dirFonte, "dnd5e-equipamento.md"), "utf8").replace(/\r\n/g, "\n");
  const arm = armaduras(md, avisos);
  const wp = armas(md, avisos);
  const it = itens(md, avisos);
  const pk = pacotes(md, [...wp, ...arm, ...it], avisos);
  const existentes = new Set([...wp, ...arm, ...it, ...pk].map((x) => x.id));
  const outros = outrosItens(md, avisos).filter((x) => !existentes.has(x.id));
  const ids = new Set();
  for (const x of [...arm, ...wp, ...it, ...pk, ...outros]) { if (ids.has(x.id)) avisos.push(`Id repetido no equipamento: ${x.id}`); ids.add(x.id); }
  return { equipamento: [...wp, ...arm, ...it, ...pk, ...outros], avisos };
}
