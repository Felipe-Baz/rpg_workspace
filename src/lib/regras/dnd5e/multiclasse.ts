// Multiclasse (regra opcional da mesa): pré-requisitos de atributo, proficiências reduzidas da nova classe, espaços de
// magia pelo nível de conjurador combinado, e a entrada numa classe nova. Funções puras; a interface só pergunta.

import { CLASSES_CONJ, definirClasse, ehConjuradora, espacosDaClasse, type Atributo, type ClasseId, type FichaDnd } from "../../dnd5e.ts";
import type { Build, Escolhas, PassoNivel } from "./build.ts";
import type { Catalogo, ClasseCat } from "./catalogo.ts";

// ---------- pré-requisitos ----------
const ATR_POR_NOME: Record<string, Atributo> = { força: "for", destreza: "des", constituição: "con", inteligência: "int", sabedoria: "sab", carisma: "car" };
export type Condicao = { atr: Atributo; min: number };
/** Alternativas ("ou"); cada alternativa é um conjunto de condições que valem juntas ("e"). */
export type Requisito = Condicao[][];

/** "Força 13 ou Destreza 13" → [[for 13], [des 13]]; "Destreza 13 e Sabedoria 13" → [[des 13, sab 13]]. */
export function lerRequisito(texto: string): Requisito {
  return texto.split(/\s+ou\s+/i).map((alt) =>
    alt.split(/\s+e\s+/i).flatMap((c) => {
      const m = c.trim().toLowerCase().match(/^(\p{L}+)\s+(\d+)$/u);
      const atr = m && ATR_POR_NOME[m[1]];
      return atr ? [{ atr, min: Number(m[2]) }] : [];
    }),
  ).filter((a) => a.length > 0);
}
export const atendeRequisito = (r: Requisito, totais: Record<Atributo, number>) => r.length === 0 || r.some((alt) => alt.every((c) => totais[c.atr] >= c.min));
export const textoRequisito = (r: Requisito) => r.map((alt) => alt.map((c) => `${c.atr.toUpperCase()} ${c.min}`).join(" e ")).join(" ou ");

export type ResultadoRequisito = { classe: string; nome: string; requisito: string; ok: boolean };

/** Pré-requisitos de cada classe do personagem (as atuais e a nova), contra os atributos finais. */
export function conferirRequisitos(ids: readonly string[], cat: Catalogo, totais: Record<Atributo, number>): ResultadoRequisito[] {
  const tabela = cat.multiclasse().prerequisitos;
  return ids.map((id) => {
    const cl = cat.classe(id);
    const linha = tabela.find((p) => p.classe === cl?.nome);
    const r = linha ? lerRequisito(linha.requisito) : [];
    return { classe: id, nome: cl?.nome ?? id, requisito: linha?.requisito ?? "—", ok: atendeRequisito(r, totais) };
  });
}

// ---------- proficiências ao entrar numa classe que não é a primeira ----------
export type ProfMulticlasse = {
  armaduras?: string[]; armas?: string[]; ferramentas?: string[];
  /** Uma perícia: de uma lista da classe ou qualquer. */
  pericia?: "classe" | "qualquer";
  instrumento?: boolean;
};
/** Tabela "Proficiências de Multiclasse" do livro. */
export const PROF_MULTICLASSE: Record<string, ProfMulticlasse> = {
  barbaro: { armaduras: ["escudo"], armas: ["armas simples", "armas marciais"] },
  bardo: { armaduras: ["leve"], pericia: "qualquer", instrumento: true },
  bruxo: { armaduras: ["leve"], armas: ["armas simples"] },
  clerigo: { armaduras: ["leve", "média", "escudo"] },
  druida: { armaduras: ["leve", "média", "escudo"] },
  feiticeiro: {},
  guerreiro: { armaduras: ["leve", "média", "escudo"], armas: ["armas simples", "armas marciais"] },
  ladino: { armaduras: ["leve"], pericia: "classe", ferramentas: ["Ferramentas de ladrão"] },
  mago: {},
  monge: { armas: ["armas simples", "espada curta"] },
  paladino: { armaduras: ["leve", "média", "escudo"], armas: ["armas simples", "armas marciais"] },
  patrulheiro: { armaduras: ["leve", "média", "escudo"], armas: ["armas simples", "armas marciais"], pericia: "classe" },
};

// ---------- espaços de magia ----------
export type ClasseNaFicha = { id: string; nivel: number; subclasse?: string };
const COMPLETOS = new Set(["bardo", "clerigo", "druida", "feiticeiro", "mago"]);
const METADE = new Set(["paladino", "patrulheiro"]);
const TERCO: Record<string, string> = { guerreiro: "cavaleiro-arcano", ladino: "trapaceiro-arcano" };

/** Quanto cada classe soma ao nível de conjurador (bruxo usa Magia de Pacto, fora desta conta). */
export function contribuicaoConjurador(c: ClasseNaFicha): number {
  if (COMPLETOS.has(c.id)) return c.nivel;
  if (METADE.has(c.id)) return Math.floor(c.nivel / 2);
  if (TERCO[c.id] && c.subclasse === TERCO[c.id]) return Math.floor(c.nivel / 3);
  return 0;
}
const temConjuracao = (c: ClasseNaFicha) => COMPLETOS.has(c.id) || METADE.has(c.id) || (!!TERCO[c.id] && c.subclasse === TERCO[c.id]);

export type EspacosMulticlasse = { espacos: number[]; nivelConjurador: number; modo: "multiclasse" | "classe" | "nenhum" };

/**
 * Espaços de magia de quem tem mais de uma classe. Com Conjuração em duas ou mais classes, soma os níveis (completo,
 * metade, um terço) e consulta a tabela de multiclasse. Com Conjuração em uma só, vale a tabela da própria classe pelo nível
 * DELA. Os espaços de pacto do bruxo são somados ao círculo correspondente (a recarga continua a do jogo: ver pendências).
 */
export function espacosMulticlasse(classes: readonly ClasseNaFicha[], tabela: readonly { nivel: number; espacos: number[] }[]): EspacosMulticlasse {
  const conj = classes.filter(temConjuracao);
  let espacos = Array<number>(9).fill(0);
  let nivelConjurador = 0;
  let modo: EspacosMulticlasse["modo"] = "nenhum";
  if (conj.length >= 2) {
    nivelConjurador = conj.reduce((s, c) => s + contribuicaoConjurador(c), 0);
    espacos = [...(tabela.find((t) => t.nivel === Math.min(20, nivelConjurador))?.espacos ?? espacos)];
    modo = "multiclasse";
  } else if (conj.length === 1 && ehConjuradora(conj[0].id as ClasseId)) {
    espacos = espacosDaClasse(conj[0].id as keyof typeof CLASSES_CONJ, conj[0].nivel);
    nivelConjurador = conj[0].nivel;
    modo = "classe";
  }
  const bruxo = classes.find((c) => c.id === "bruxo");
  if (bruxo) {
    const pacto = espacosDaClasse("bruxo", bruxo.nivel);
    espacos = espacos.map((n, i) => n + pacto[i]);
    if (modo === "nenhum") modo = "classe";
  }
  return { espacos, nivelConjurador, modo };
}

/**
 * Atributo e espaços de conjuração da ficha efetiva depois de mudar classe ou nível. Uma classe: regras da classe
 * (`definirClasse`). Várias: tabela de multiclasse e o atributo da primeira classe conjuradora.
 */
export function ajustarConjuracao(ef: FichaDnd, b: Build, cat: Catalogo): Pick<FichaDnd, "atrConjuracao" | "espacos"> {
  if (b.classes.length <= 1) {
    const x = ef.classe ? definirClasse(ef, ef.classe) : ef;
    return { atrConjuracao: x.atrConjuracao, espacos: x.espacos };
  }
  const r = espacosMulticlasse(b.classes, cat.multiclasse().espacosConjurador);
  const primeira = b.classes.find((c) => ehConjuradora(c.id as ClasseId));
  const usados = ef.espacos.map((e) => e.usados);
  return {
    atrConjuracao: primeira ? CLASSES_CONJ[primeira.id as keyof typeof CLASSES_CONJ].atr : ef.atrConjuracao,
    espacos: r.espacos.map((total, i) => ({ total, usados: Math.min(usados[i] ?? 0, total) })),
  };
}

// ---------- entrar numa classe nova ----------
export type EntradaClasseNova = { id: string; pv: number | "medio"; subclasse?: string; escolhas?: Escolhas };

/** Adiciona uma classe no 1º nível dela: PV como nível acima do 1º (dado da nova classe), proficiências reduzidas. */
export function adicionarClasse(b: Build, e: EntradaClasseNova): Build {
  if (b.classes.some((c) => c.id === e.id)) return b;
  const passo: PassoNivel = { classe: e.id, pv: e.pv };
  return {
    ...b,
    classes: [...b.classes, { id: e.id, nivel: 1, ...(e.subclasse ? { subclasse: e.subclasse } : {}), ...(e.escolhas ? { escolhas: e.escolhas } : {}) }],
    historicoNiveis: [...(b.historicoNiveis ?? []), passo],
  };
}

/** Classes do catálogo que o personagem ainda não tem. */
export const classesNovas = (b: Build, cat: Catalogo): ClasseCat[] => cat.classes().filter((c) => !b.classes.some((x) => x.id === c.id));

