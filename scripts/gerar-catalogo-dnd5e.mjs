// Gera o catálogo de D&D 5e (pacote "phb") a partir dos .md de docs/referencias/playerbook/.
// Roda manualmente (não faz parte do build):  node scripts/gerar-catalogo-dnd5e.mjs
// Saída: src/data/dnd5e/phb/*.json (commitado e revisado em diff).
// Correções manuais ficam em scripts/dnd5e/correcoes-magias.json (por id de magia) e são aplicadas por cima da heurística.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarRegras } from "./dnd5e/catalogo-regras.mjs";
import { gerarBugigangas, gerarEquipamento } from "./dnd5e/equipamento.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTE = join(RAIZ, "docs/referencias/playerbook");
const SAIDA = join(RAIZ, "src/data/dnd5e/phb");
const PACOTE = "phb";

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const slug = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Erros de digitação da tradução (lista de nomes → nome correto), aplicados antes de casar listas de classe ↔ magia.
// Nomes que a lista de classe grafa diferente da descrição (slug da lista → slug da magia).
const ALIAS = {
  "enfraquecer-o-intelecto": "enfraquecer-intelecto",
  "infringir-ferimentos": "infligir-ferimentos",
  "banquete-dos-herois": "banquete-de-herois",
};
const corrigir = (t) => t.replace(/encantmento/gi, (m) => (m[0] === "E" ? "Encantamento" : "encantamento"));

const ESCOLAS = ["abjuração", "adivinhação", "conjuração", "encantamento", "evocação", "ilusão", "necromancia", "transmutação"];
const ATRIBUTOS = { força: "for", destreza: "des", constituição: "con", inteligência: "int", sabedoria: "sab", carisma: "car" };
const TIPOS_DANO = ["ácido", "concussão", "contundente", "cortante", "elétrico", "energia", "energético", "fogo", "frio", "necrótico", "perfurante", "psíquico", "radiante", "trovejante", "veneno"];

const avisos = [];
const aviso = (m) => avisos.push(m);

// ---------- magias ----------
function lerMagias() {
  const md = readFileSync(join(FONTE, "dnd5e-magias.md"), "utf8").replace(/\r\n/g, "\n");
  const iDesc = md.indexOf("\n## Descrições das Magias");
  const listas = md.slice(0, iDesc);
  const desc = md.slice(iDesc);

  const magias = [];
  const blocos = desc.split(/\n#### /).slice(1);
  for (const bloco of blocos) {
    const linhas = bloco.split("\n");
    const nome = corrigir(linhas[0].trim());
    const corpo = linhas.slice(1).join("\n").trim();
    const m = corpo.match(/^_(?:(\d)° nível de ([^_(]+?)|Truque de ([^_(]+?))(?: \((ritual)\))?_/);
    if (!m) {
      // sub-título dentro do texto da magia anterior
      const ant = magias[magias.length - 1];
      if (ant) ant._extra.push(`#### ${nome}\n\n${corpo}`);
      else aviso(`Bloco sem cabeçalho de magia no início: ${nome}`);
      continue;
    }
    const nivel = m[1] ? Number(m[1]) : 0;
    const escola = (m[2] ?? m[3]).trim().toLowerCase();
    if (!ESCOLAS.includes(escola)) aviso(`Escola desconhecida em "${nome}": ${escola}`);
    const campo = (rot) => corpo.match(new RegExp(`- \\*\\*${rot}:\\*\\* (.+)`))?.[1].trim() ?? "";
    const tempo = campo("Tempo de Conjuração");
    const alcance = campo("Alcance");
    const comps = campo("Componentes");
    const duracao = campo("Duração");
    if (!tempo || !alcance || !comps || !duracao) aviso(`Campo faltando em "${nome}"`);
    const resto = corpo.slice(corpo.indexOf(duracao, corpo.indexOf("**Duração:**")) + duracao.length).trim();
    magias.push({ nome, nivel, escola, ritual: !!m[4], tempo, alcance, comps, duracao, resto, _extra: [] });
  }

  return { magias: magias.map(montarMagia), listas };
}

function montarMagia(b) {
  const idxSup = b.resto.search(/\*\*Em Níveis Superiores\*\*\.?/);
  let texto = (idxSup >= 0 ? b.resto.slice(0, idxSup) : b.resto).trim();
  let nivelSuperior = idxSup >= 0 ? b.resto.slice(idxSup).replace(/^\*\*Em Níveis Superiores\*\*\.?\s*/, "").trim() : undefined;
  if (b._extra.length) texto = [texto, ...b._extra].join("\n\n");

  const cm = b.comps.match(/^([VSM, ]+?)(?:\s*\((.*)\))?$/);
  const letras = (cm?.[1] ?? b.comps).replace(/[^VSM]/g, "");
  if (!cm) aviso(`Componentes fora do padrão em "${b.nome}": ${b.comps}`);
  const componentes = { v: letras.includes("V"), s: letras.includes("S"), m: letras.includes("M") };
  const material = cm?.[2]?.trim();

  const magia = {
    id: slug(b.nome),
    nome: b.nome,
    pacote: PACOTE,
    nivel: b.nivel,
    escola: b.escola,
    ritual: b.ritual,
    tempo: b.tempo,
    alcance: b.alcance,
    componentes: material ? { ...componentes, material } : componentes,
    duracao: b.duracao,
    concentracao: /concentração/i.test(b.duracao),
    descricao: texto,
    ...(nivelSuperior ? { nivelSuperior } : {}),
    classes: [],
  };
  const mec = inferirMecanica(magia);
  if (mec) magia.mecanica = mec;
  return magia;
}

// ---------- mecânica estruturada (heurística; revisar com correcoes-magias.json) ----------
function inferirMecanica(m) {
  const t = `${m.descricao}`;
  const mec = {};
  if (/ataque (?:à|a) distância com magia/i.test(t)) mec.ataque = "distancia";
  else if (/ataques? corpo[ -]a[ -]corpo com magia|ataque de magia corpo[ -]a[ -]corpo/i.test(t)) mec.ataque = "corpo";

  const sv = t.match(/teste de resistência de (Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/i);
  if (sv) mec.salvaguarda = ATRIBUTOS[sv[1].toLowerCase()];

  const tipos = TIPOS_DANO.join("|");
  const danos = [];
  for (const d of t.matchAll(new RegExp(`(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)(?: pontos)? de dano (?:de |do tipo )?(${tipos})`, "gi"))) {
    const dado = d[1].replace(/\s+/g, "");
    const tipo = d[2].toLowerCase();
    if (!danos.some((x) => x.dado === dado && x.tipo === tipo)) danos.push({ dado, tipo });
  }
  // "dano de energia igual a 1d8 + seu modificador de habilidade de conjuração" (soma o atributo de conjuração)
  for (const d of t.matchAll(new RegExp(`dano (?:de )?(${tipos}) igual a (\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)( \\+ seu modificador)?`, "gi"))) {
    const dado = d[2].replace(/\s+/g, "");
    const tipo = d[1].toLowerCase();
    if (!danos.some((x) => x.dado === dado && x.tipo === tipo)) danos.push({ dado, tipo, ...(d[3] ? { somaMod: true } : {}) });
  }
  if (danos.length) mec.danos = danos;

  // "recupera uma quantidade de pontos de vida igual a 1d8 + seu modificador..." | "recupera 4d8 + 15 pontos de vida"
  const curaIgual = t.match(/recuper\w*[^.]*?pontos de vida igual a (\d+d\d+(?:\s*\+\s*\d+)?)( \+ seu modificador)?/i);
  const curaFixa = t.match(/(?:recupera|restaura|recuperar|restaurar|recupere)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s*pontos de vida/i);
  const cura = curaIgual ?? curaFixa;
  if (cura) mec.cura = { dado: cura[1].replace(/\s+/g, ""), ...(cura[2] ? { somaMod: true } : {}) };

  // escala por círculo ("em níveis superiores ... 1d6 para cada nível")
  if (m.nivelSuperior) {
    const e = m.nivelSuperior.match(/(\d+d\d+)(?: adicionais?)?[^.]*?para cada (?:nível|círculo)/i) ?? m.nivelSuperior.match(/aumenta em (\d+d\d+)/i);
    // "para cada dois níveis do espaço acima do 2°" (Arma Espiritual, Lâmina Flamejante): +dado a cada 2 círculos
    const passo = /para cada dois (?:níveis|círculos)/i.test(m.nivelSuperior) ? 2 : 1;
    if (e) mec.escalaNivel = { dado: e[1], porNivel: passo };
  }
  // truques: "aumenta em 1d10 quando você alcança o 5° nível (2d10), 11° nível (3d10) e 17° nível (4d10)"
  if (m.nivel === 0) {
    const pers = [...t.matchAll(/(\d+)° nível \((\d+d\d+)\)/g)].map((x) => ({ nivel: Number(x[1]), dado: x[2] }));
    if (pers.length) mec.escalaPersonagem = pers;
  }

  const area = t.match(/(esfera|cubo|cone|cilindro|linha)[^.]{0,40}?(\d+(?:,\d+)?) metros/i) ?? t.match(/(\d+(?:,\d+)?) metros de (?:raio|lado|comprimento)/i);
  if (area && area.length === 3) mec.area = { forma: area[1].toLowerCase(), metros: Number(area[2].replace(",", ".")) };

  return Object.keys(mec).length ? mec : undefined;
}

// ---------- listas por classe ----------
const CLASSE_ID = { bardo: "bardo", bruxo: "bruxo", clérigo: "clerigo", druida: "druida", feiticeiro: "feiticeiro", mago: "mago", paladino: "paladino", patrulheiro: "patrulheiro" };

function aplicarListas(magias, listas) {
  const porSlug = new Map(magias.map((m) => [m.id, m]));
  let classeAtual = null;
  // a fonte tem linhas com dois itens colados ("- A (escola) B (escola)"): separa antes de processar
  const linhasListas = listas.split("\n").flatMap((l) => {
    if (!l.startsWith("- ")) return [l];
    const partes = [...l.slice(2).matchAll(/\s*([^()]+?\s*\([^)]*\))/g)].map((p) => `- ${p[1].trim()}`);
    return partes.length > 1 ? partes : [l];
  });
  for (const linha of linhasListas) {
    const h = linha.match(/^### Magias de (\S+)/);
    if (h) { classeAtual = CLASSE_ID[h[1].toLowerCase()] ?? null; if (!classeAtual) aviso(`Classe desconhecida na lista: ${h[1]}`); continue; }
    if (!classeAtual) continue;
    const it = linha.match(/^- (.+?) \(([^)]*)\)\s*$/);
    if (!it) continue;
    const bruto = slug(corrigir(it[1]));
    const id = ALIAS[bruto] ?? bruto;
    const alvo = porSlug.get(id) ?? achar(porSlug, id);
    if (!alvo) { aviso(`Magia da lista de ${classeAtual} não encontrada: "${it[1]}"`); continue; }
    if (!alvo.classes.includes(classeAtual)) alvo.classes.push(classeAtual);
  }
  for (const m of magias) {
    m.classes.sort();
  }
}
// tolera variações de caixa/plural simples e prefixos ("Amizade animal" x "Amizade Animal" já cai no slug)
function achar(porSlug, id) {
  const cands = [...porSlug.keys()].filter((k) => k.startsWith(id) || id.startsWith(k));
  return cands.length === 1 ? porSlug.get(cands[0]) : undefined;
}

// ---------- correções manuais ----------
function aplicarCorrecoes(magias) {
  const arq = join(RAIZ, "scripts/dnd5e/correcoes-magias.json");
  if (!existsSync(arq)) return;
  const corr = JSON.parse(readFileSync(arq, "utf8"));
  const porId = new Map(magias.map((m) => [m.id, m]));
  for (const [id, patch] of Object.entries(corr)) {
    const m = porId.get(id);
    if (!m) { aviso(`Correção para id inexistente: ${id}`); continue; }
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete m[k];
      else if (k === "mecanica") {
        // mescla chave a chave (null remove a chave); mecânica que ficar vazia é descartada
        const mec = { ...(m.mecanica ?? {}) };
        for (const [mk, mv] of Object.entries(v)) { if (mv === null) delete mec[mk]; else mec[mk] = mv; }
        if (Object.keys(mec).length) m.mecanica = mec; else delete m.mecanica;
      } else m[k] = v;
    }
  }
}

// ---------- validação ----------
function validar(magias) {
  const ids = new Set();
  for (const m of magias) {
    if (ids.has(m.id)) aviso(`Id repetido: ${m.id}`);
    ids.add(m.id);
    if (m.nivel < 0 || m.nivel > 9) aviso(`Nível inválido: ${m.nome}`);
    if (!m.classes.length) aviso(`Magia sem classe: ${m.nome}`);
    if (!m.descricao) aviso(`Magia sem descrição: ${m.nome}`);
  }
  if (magias.length !== 361) aviso(`Esperadas 361 magias, lidas ${magias.length}`);
}

const { magias, listas } = lerMagias();
aplicarListas(magias, listas);
aplicarCorrecoes(magias);
magias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
validar(magias);

mkdirSync(SAIDA, { recursive: true });
writeFileSync(join(SAIDA, "magias.json"), JSON.stringify(magias, null, 2) + "\n");

const comMec = magias.filter((m) => m.mecanica).length;
console.log(`${magias.length} magias (${comMec} com mecânica) → src/data/dnd5e/phb/magias.json`);
const regras = gerarRegras(FONTE);
for (const k of ["racas", "antecedentes", "classes", "talentos", "multiclasse"]) {
  writeFileSync(join(SAIDA, `${k}.json`), JSON.stringify(regras[k], null, 2) + "\n");
}
console.log(`${regras.racas.length} raças, ${regras.antecedentes.length} antecedentes, ${regras.classes.length} classes, ${regras.talentos.length} talentos`);
const equip = gerarEquipamento(FONTE);
writeFileSync(join(SAIDA, "equipamento.json"), JSON.stringify(equip.equipamento, null, 2) + "\n");
console.log(`${equip.equipamento.length} itens de equipamento`);
const bugigangas = gerarBugigangas(FONTE);
if (bugigangas.length !== 100) console.warn(`Bugigangas: esperadas 100, lidas ${bugigangas.length}`);
writeFileSync(join(SAIDA, "bugigangas.json"), JSON.stringify(bugigangas, null, 2) + "\n");
avisos.push(...regras.avisos, ...equip.avisos);
if (avisos.length) {
  console.log(`\n${avisos.length} aviso(s):`);
  for (const a of avisos) console.log(" -", a);
  process.exitCode = 1;
}
