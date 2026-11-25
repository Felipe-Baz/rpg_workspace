// Biblioteca de livros da visão do mestre: registro dos livros/capítulos, carga sob demanda e busca.
// Os textos vêm de src/data/livros/<livro>/<capitulo>.json (gerados por scripts/gerar-livros.mjs a partir de
// docs/referencias/playerbook/*.md) e as magias de src/data/dnd5e/phb/magias.json. Nada disso entra no bundle
// das outras telas: cada capítulo é um import dinâmico.

export type SecaoLivro = { id: string; titulo: string; grupo?: string; md: string };
export type TipoCapitulo = "texto" | "magias";
export type CapituloLivro = { id: string; titulo: string; resumo: string; tipo: TipoCapitulo };
/** Atalho da "consulta rápida": abre direto uma seção. */
export type Atalho = { rotulo: string; capitulo: string; secao: string };
export type Livro = { id: string; titulo: string; subtitulo: string; capitulos: CapituloLivro[]; atalhos: Atalho[] };

/** Consulta rápida do Livro do Jogador: as páginas que o mestre mais abre no meio da sessão. */
export const ATALHOS_JOGADOR: Atalho[] = [
  { rotulo: "Condições", capitulo: "regras", secao: "condicoes" },
  { rotulo: "CDs típicas", capitulo: "regras", secao: "classes-de-dificuldade-cd-tipicas" },
  { rotulo: "Vantagem e desvantagem", capitulo: "regras", secao: "vantagem-e-desvantagem" },
  { rotulo: "Cobertura", capitulo: "regras", secao: "cobertura" },
  { rotulo: "Ações em combate", capitulo: "regras", secao: "acoes-em-combate-resumo" },
  { rotulo: "Chegando a 0 PV", capitulo: "regras", secao: "chegando-a-0-pv" },
  { rotulo: "Descansos", capitulo: "regras", secao: "descanso" },
  { rotulo: "Ritmo de viagem", capitulo: "regras", secao: "ritmo-de-viagem" },
  { rotulo: "Exaustão", capitulo: "regras", secao: "exaustao" },
  { rotulo: "Espaços de magia", capitulo: "conjuracao", secao: "espacos-de-magia" },
  { rotulo: "Moedas em reais", capitulo: "equipamento", secao: "riqueza" },
  { rotulo: "Armas", capitulo: "equipamento", secao: "armas" },
  { rotulo: "Armaduras", capitulo: "equipamento", secao: "armaduras-e-escudos" },
];

export const LIVROS: Livro[] = [
  {
    id: "jogador",
    titulo: "Livro do Jogador",
    subtitulo: "Dungeons & Dragons · 5ª edição",
    atalhos: ATALHOS_JOGADOR,
    capitulos: [
      { id: "regras", titulo: "Regras de mesa", resumo: "Testes, CDs, viagem, descanso, combate e condições: o que o mestre arbitra na sessão.", tipo: "texto" },
      { id: "magias", titulo: "Compêndio de magias", resumo: "Todas as magias com busca por nome, círculo, escola e classe.", tipo: "magias" },
      { id: "conjuracao", titulo: "Regras de conjuração", resumo: "Espaços, componentes, duração, alcance, áreas de efeito e concentração.", tipo: "texto" },
      { id: "classes", titulo: "Classes", resumo: "As 12 classes: progressão por nível, características e subclasses.", tipo: "texto" },
      { id: "racas", titulo: "Raças", resumo: "Os 9 povos, sub-raças e traços raciais.", tipo: "texto" },
      { id: "antecedentes", titulo: "Antecedentes e detalhes", resumo: "Antecedentes, tendências, idiomas, personalidade e inspiração.", tipo: "texto" },
      { id: "talentos", titulo: "Talentos e multiclasse", resumo: "Todos os talentos e as regras de multiclasse.", tipo: "texto" },
      { id: "equipamento", titulo: "Equipamento", resumo: "Armas, armaduras, ferramentas, montarias, serviços e custo de vida.", tipo: "texto" },
    ],
  },
];

type ModuloCapitulo = { default?: { secoes: SecaoLivro[] }; secoes?: SecaoLivro[] };
const CARREGADORES: Record<string, () => Promise<ModuloCapitulo>> = {
  "jogador/regras": () => import("../data/livros/jogador/regras.json"),
  "jogador/conjuracao": () => import("../data/livros/jogador/conjuracao.json"),
  "jogador/classes": () => import("../data/livros/jogador/classes.json"),
  "jogador/racas": () => import("../data/livros/jogador/racas.json"),
  "jogador/antecedentes": () => import("../data/livros/jogador/antecedentes.json"),
  "jogador/talentos": () => import("../data/livros/jogador/talentos.json"),
  "jogador/equipamento": () => import("../data/livros/jogador/equipamento.json"),
};

const cache = new Map<string, Promise<SecaoLivro[]>>();
/** Seções de um capítulo de texto (import dinâmico; o navegador guarda em cache). */
export function carregarCapitulo(livro: string, capitulo: string): Promise<SecaoLivro[]> {
  const chave = `${livro}/${capitulo}`;
  let p = cache.get(chave);
  if (!p) {
    const c = CARREGADORES[chave];
    p = c ? c().then((m) => (m.default ?? m).secoes ?? []) : Promise.resolve([]);
    cache.set(chave, p);
  }
  return p;
}

// ---------- texto ----------
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Id de âncora de um título. Igual no sumário e no render, para o link achar o cabeçalho. */
export const slug = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Texto puro de um trecho de markdown (sem ênfase, links nem tabelas), para busca e prévia. */
export function textoPuro(md: string): string {
  return md
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export type ItemSumario = { nivel: number; titulo: string; id: string };
/** Cabeçalhos internos de uma seção (a seção em si é o `h2` da página). Repetidos aparecem uma vez. */
export function extrairSumario(md: string): ItemSumario[] {
  const itens: ItemSumario[] = [];
  const vistos = new Set<string>();
  for (const l of md.split("\n")) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(l);
    if (!m) continue;
    const titulo = m[2].replace(/[*_`]/g, "");
    const id = slug(titulo);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    itens.push({ nivel: m[1].length, titulo, id });
  }
  return itens;
}

// ---------- busca ----------
export type EntradaBusca = { capitulo: string; secao: string; titulo: string; grupo?: string; texto: string; normal: string; tituloNormal: string };
export type ResultadoBusca = { entrada: EntradaBusca; previa: string; pontos: number };

export function indexarSecoes(capitulo: string, secoes: SecaoLivro[]): EntradaBusca[] {
  return secoes.map((s) => {
    const texto = textoPuro(s.md);
    return { capitulo, secao: s.id, titulo: s.titulo, grupo: s.grupo, texto, normal: semAcento(`${s.titulo} ${texto}`), tituloNormal: semAcento(s.titulo) };
  });
}

/** Todas as palavras da consulta precisam aparecer; título vale mais que corpo. */
export function buscarNoLivro(indice: EntradaBusca[], consulta: string, limite = 30): ResultadoBusca[] {
  const termos = semAcento(consulta).split(/\s+/).filter((t) => t.length > 1);
  if (!termos.length) return [];
  const saida: ResultadoBusca[] = [];
  for (const e of indice) {
    if (!termos.every((t) => e.normal.includes(t))) continue;
    let pontos = 0;
    for (const t of termos) {
      if (e.tituloNormal === t) pontos += 50;
      else if (e.tituloNormal.startsWith(t)) pontos += 25;
      else if (e.tituloNormal.includes(t)) pontos += 15;
      pontos += Math.min(5, e.normal.split(t).length - 1);
    }
    saida.push({ entrada: e, previa: previa(e.texto, termos), pontos });
  }
  return saida.sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}

/** Trecho curto em volta do primeiro termo encontrado no corpo. */
function previa(texto: string, termos: string[]): string {
  const normal = semAcento(texto);
  // A normalização pode encurtar o texto (acentos compostos); nesse caso o índice não vale para o original.
  const alvo = normal.length === texto.length ? normal : texto.toLowerCase();
  const i = termos.map((t) => alvo.indexOf(t)).filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? 0;
  const ini = Math.max(0, i - 50);
  return `${ini > 0 ? "…" : ""}${texto.slice(ini, ini + 150).trim()}${ini + 150 < texto.length ? "…" : ""}`;
}
