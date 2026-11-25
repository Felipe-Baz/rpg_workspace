// Gera os dados da aba "Livros" (visão do mestre) a partir dos resumos em docs/referencias/playerbook/*.md.
// Cada arquivo vira um capítulo; os cabeçalhos viram seções navegáveis. Saída: src/data/livros/jogador/<capitulo>.json.
// Uso: node scripts/gerar-livros.mjs   (rode de novo quando um .md de referência mudar)
//
// As magias não passam por aqui: o navegador de magias usa src/data/dnd5e/phb/magias.json. Daqui sai só o texto de regras
// da conjuração (cap. 10), cortado antes das listas por classe, que o navegador deriva do catálogo.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = join(raiz, "docs/referencias/playerbook");
const SAIDA = join(raiz, "src/data/livros/jogador");

/**
 * `secao`: nível de cabeçalho que vira uma seção da navegação. Cabeçalhos mais rasos são "grupos": o corpo deles vira uma
 * seção de introdução e o título aparece como rótulo do grupo na lista.
 */
const CAPITULOS = [
  { id: "regras", arquivo: "dnd5e-regras-mestre.md", secao: 3 },
  { id: "racas", arquivo: "dnd5e-racas.md", secao: 2, ignorar: [], renomear: { "Raças (cap. 2)": "Introdução às raças" } },
  { id: "classes", arquivo: "dnd5e-classes.md", secao: 2, ignorar: ["Índice"], renomear: { "Capítulo 3: Classes": "Visão geral das classes" } },
  { id: "antecedentes", arquivo: "dnd5e-antecedentes.md", secao: 3, ignorar: [], renomear: { "Detalhes do Personagem (cap. 4)": "Detalhes do personagem", Antecedentes: "O que é um antecedente" } },
  { id: "equipamento", arquivo: "dnd5e-equipamento.md", secao: 2, ignorar: ["Índice"], renomear: { "Equipamento (cap. 5)": "Introdução ao equipamento" } },
  { id: "talentos", arquivo: "dnd5e-talentos-multiclasse.md", secao: 3, ignorar: [], renomear: { "Multiclasse (cap. 6)": "Multiclasse: visão geral", "Talentos (cap. 6)": "Talentos: visão geral" } },
  { id: "conjuracao", arquivo: "dnd5e-magias.md", secao: 3, cortarEm: /^### Magias de /, ignorar: [], renomear: {} },
];

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Tabelas do PDF vêm com a primeira linha vazia (`|   |   |`): promove a linha seguinte a cabeçalho. */
function arrumarTabelas(linhas) {
  const saida = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const vazio = /^\|(\s*\|)+\s*$/.test(l);
    if (vazio && /^\|[\s:|-]+\|\s*$/.test(linhas[i + 1] ?? "") && (linhas[i + 2] ?? "").startsWith("|")) {
      // linhas[i] = cabeçalho vazio, [i+1] = separador, [i+2] = primeira linha de dados (vira cabeçalho).
      saida.push(linhas[i + 2], linhas[i + 1]);
      i += 2;
      continue;
    }
    saida.push(l);
  }
  return saida;
}

function blocos(texto) {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const lista = [{ nivel: 0, titulo: "", linhas: [] }];
  let cerca = false;
  for (const l of linhas) {
    if (/^```/.test(l)) cerca = !cerca;
    const m = !cerca && /^(#{1,6})\s+(.+?)\s*$/.exec(l);
    if (m) lista.push({ nivel: m[1].length, titulo: m[2].replace(/\s+#+$/, ""), linhas: [] });
    else lista.at(-1).linhas.push(l);
  }
  return lista;
}

const corpo = (linhas) => arrumarTabelas(linhas).join("\n").replace(/\n{3,}/g, "\n\n").trim();

function gerar(cap) {
  let texto = readFileSync(join(ENTRADA, cap.arquivo), "utf8");
  if (cap.cortarEm) {
    const linhas = texto.split("\n");
    const i = linhas.findIndex((l) => cap.cortarEm.test(l));
    if (i > 0) texto = linhas.slice(0, i).join("\n");
  }
  const bs = blocos(texto).slice(1); // descarta o preâmbulo antes do 1º cabeçalho
  if (bs[0]?.nivel === 1) bs.shift(); // título do arquivo ("# D&D 5e: ..."): metadados, não conteúdo

  const ignorar = new Set(cap.ignorar ?? []);
  const secoes = [];
  const grupos = []; // pilha de contêineres por nível
  let pulaAte = 0; // ignora também o que está dentro de um cabeçalho ignorado
  let atual = null;

  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (pulaAte && b.nivel > pulaAte) continue;
    pulaAte = 0;
    if (ignorar.has(b.titulo)) { pulaAte = b.nivel; continue; }

    if (b.nivel < cap.secao) {
      grupos.length = b.nivel - 1; // sai de contêineres mais fundos
      const texto = corpo(b.linhas);
      const rotuloGrupo = b.titulo.replace(/\s*\(cap\. \d+\)$/, "").replace(/^Capítulo \d+: /, "");
      grupos[b.nivel - 1] = rotuloGrupo;
      // O corpo do contêiner vira a introdução do grupo; textos mínimos (só uma frase de passagem) não valem uma seção.
      if (texto.length >= 250) {
        atual = { titulo: cap.renomear?.[b.titulo] ?? b.titulo, grupo: rotuloGrupo, md: texto };
        secoes.push(atual);
      } else atual = null;
      continue;
    }
    if (b.nivel === cap.secao) {
      const grupo = grupos.filter(Boolean).at(-1);
      atual = { titulo: cap.renomear?.[b.titulo] ?? b.titulo, grupo, md: corpo(b.linhas) };
      secoes.push(atual);
      continue;
    }
    // Cabeçalho mais fundo que a seção: continua dentro dela, com o cabeçalho preservado.
    if (atual) atual.md = `${atual.md}\n\n${"#".repeat(b.nivel)} ${b.titulo}\n\n${corpo(b.linhas)}`.trim();
  }

  // Grupos redundantes (um só, ou igual ao título da primeira seção) só atrapalham: remove.
  const distintos = new Set(secoes.map((s) => s.grupo).filter(Boolean));
  const usados = new Set();
  for (const s of secoes) {
    // Grupo de uma seção só, com o mesmo nome dela, é ruído.
    if (s.grupo === s.titulo && secoes.filter((x) => x.grupo === s.grupo).length === 1) delete s.grupo;
    if (distintos.size < 2) delete s.grupo;
    if (!s.grupo) delete s.grupo;
    let id = slug(s.titulo) || "secao";
    for (let n = 2; usados.has(id); n++) id = `${slug(s.titulo)}-${n}`;
    usados.add(id);
    s.id = id;
  }
  return secoes.filter((s) => s.md).map(({ id, titulo, grupo, md }) => ({ id, titulo, ...(grupo ? { grupo } : {}), md }));
}

mkdirSync(SAIDA, { recursive: true });
let total = 0;
for (const cap of CAPITULOS) {
  const secoes = gerar(cap);
  const json = JSON.stringify({ secoes });
  writeFileSync(join(SAIDA, `${cap.id}.json`), json + "\n");
  total += json.length;
  console.log(`${cap.id.padEnd(13)} ${String(secoes.length).padStart(3)} seções  ${(json.length / 1024).toFixed(0).padStart(4)} KB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KB -> ${SAIDA}`);
