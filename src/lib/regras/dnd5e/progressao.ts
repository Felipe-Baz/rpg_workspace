// Progressão do personagem: XP e nível, métodos de atributos (padrão, compra, 4d6), incrementos por nível e a subida de
// nível. Funções puras que montam o `Build`; a interface (assistentes) só pergunta e chama estas funções.

import { ATRIBUTOS, type Atributo } from "../../dnd5e.ts";
import type { Build, Escolhas, PassoNivel } from "./build.ts";
import type { Catalogo, ClasseCat } from "./catalogo.ts";
import { definirInvocacoes } from "./invocacoes.ts";

// ---------- XP ----------
/** XP mínimo de cada nível (índice 0 = nível 1). Tabela "Avanço de Personagem" do livro. */
export const XP_POR_NIVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const nivelPorXp = (xp: number) => XP_POR_NIVEL.reduce((n, min, i) => (xp >= min ? i + 1 : n), 1);
export const xpParaNivel = (nivel: number) => XP_POR_NIVEL[Math.min(20, Math.max(1, nivel)) - 1];
/** O personagem já tem XP para um nível acima do atual? */
export const podeSubirDeNivel = (xp: number, nivel: number) => nivel < 20 && nivelPorXp(xp) > nivel;

// ---------- métodos de atributos ----------
export const DISTRIBUICAO_PADRAO = [15, 14, 13, 12, 10, 8];
export const ORCAMENTO_COMPRA = 27;
/** Custo de cada valor na compra de pontos (8 a 15). */
export const CUSTO_COMPRA: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
/** Custo total dos seis valores, ou `null` se algum estiver fora de 8–15. */
export function custoCompra(valores: Record<Atributo, number>): number | null {
  let total = 0;
  for (const a of ATRIBUTOS) {
    const c = CUSTO_COMPRA[valores[a]];
    if (c === undefined) return null;
    total += c;
  }
  return total;
}

/** 4d6 descartando o menor. `d6` devolve um valor de 1 a 6 (injetável para teste). */
export function rolarAtributo(d6: () => number): { dados: number[]; total: number } {
  const dados = Array.from({ length: 4 }, d6);
  const ordenados = [...dados].sort((a, b) => a - b);
  return { dados, total: ordenados.slice(1).reduce((s, x) => s + x, 0) };
}

/** Os seis valores são exatamente a lista dada, cada um usado uma vez (distribuição padrão ou rolagens)? */
export function usaCadaValorUmaVez(valores: Record<Atributo, number>, lista: readonly number[]): boolean {
  const restante = [...lista];
  for (const a of ATRIBUTOS) {
    const i = restante.indexOf(valores[a]);
    if (i < 0) return false;
    restante.splice(i, 1);
  }
  return restante.length === 0;
}

// ---------- riqueza inicial ----------
/** Riqueza inicial por classe, como o livro escreve: dados e multiplicador em po. */
export const RIQUEZA_INICIAL: Record<string, { dados: string; vezes: number }> = {
  barbaro: { dados: "2d4", vezes: 10 }, bardo: { dados: "5d4", vezes: 10 }, bruxo: { dados: "4d4", vezes: 10 }, clerigo: { dados: "5d4", vezes: 10 },
  druida: { dados: "2d4", vezes: 10 }, feiticeiro: { dados: "3d4", vezes: 10 }, guerreiro: { dados: "5d4", vezes: 10 }, ladino: { dados: "4d4", vezes: 10 },
  mago: { dados: "4d4", vezes: 10 }, monge: { dados: "5d4", vezes: 1 }, paladino: { dados: "5d4", vezes: 10 }, patrulheiro: { dados: "5d4", vezes: 10 },
};

// ---------- incrementos e subida de nível ----------
/** Níveis em que a classe dá "Incremento no Valor de Habilidade" (4, 8, 12, 16, 19; guerreiro e ladino ganham mais). */
export const niveisDeIncremento = (c: ClasseCat): number[] =>
  (c.tabela ?? []).filter((t) => t.caracteristicas.some((x) => /incremento no valor/i.test(x.nome))).map((t) => t.nivel);

/** Incrementos de atributo que o build já usou (passos com `atributos` ou `talento`). */
export const incrementosUsados = (b: Build) => (b.historicoNiveis ?? []).filter((p) => p.incremento && (p.incremento.talento || Object.keys(p.incremento.atributos ?? {}).length)).length;

/** Quantos incrementos o personagem tem direito até o nível atual (somando as classes). */
export function incrementosDisponiveis(b: Build, cat: Catalogo): number {
  return b.classes.reduce((s, c) => s + (cat.classe(c.id) ? niveisDeIncremento(cat.classe(c.id)!).filter((n) => n <= c.nivel).length : 0), 0);
}

export const pvMedioDoDado = (dado: number) => Math.floor(dado / 2) + 1;

export type ResumoSubida = {
  de: number;
  para: number;
  classe: ClasseCat;
  /** Características que a tabela da classe dá neste nível (com o texto, quando há). */
  caracteristicas: { nome: string; texto?: string }[];
  proficiencia: { antes: number; depois: number };
  dadoVida: number;
  pvMedio: number;
  /** Este nível pede um incremento de atributo (ou talento). */
  incremento: boolean;
  /** Este nível pede a escolha da subclasse. */
  escolheSubclasse: boolean;
  subclasseRotulo?: string;
};

/** O que o próximo nível de uma classe traz, para o assistente mostrar antes de confirmar. `null` no nível 20 ou classe desconhecida. */
export function resumoSubida(b: Build, cat: Catalogo, indiceClasse = 0): ResumoSubida | null {
  const c = b.classes[indiceClasse];
  const cl = c && cat.classe(c.id);
  if (!c || !cl || c.nivel >= 20 || b.classes.reduce((s, x) => s + x.nivel, 0) >= 20) return null;
  const para = c.nivel + 1;
  const linha = cl.tabela?.find((t) => t.nivel === para);
  const total = b.classes.reduce((s, x) => s + x.nivel, 0);
  const prof = (n: number) => 2 + Math.floor((Math.min(Math.max(n, 1), 20) - 1) / 4);
  return {
    de: c.nivel, para, classe: cl,
    caracteristicas: (linha?.caracteristicas ?? []).map((x) => ({ nome: x.nome, texto: cl.caracteristicas?.find((k) => k.id === x.ref)?.texto })),
    proficiencia: { antes: prof(total), depois: prof(total + 1) },
    dadoVida: cl.dadoVida, pvMedio: pvMedioDoDado(cl.dadoVida),
    incremento: niveisDeIncremento(cl).includes(para),
    escolheSubclasse: !c.subclasse && para === (cl.subclasseNivel ?? 99),
    subclasseRotulo: cl.subclasseRotulo,
  };
}

export type EscolhasSubida = {
  classe?: number;
  /** PV do nível: valor rolado, ou "medio". */
  pv: number | "medio";
  incremento?: { atributos?: Partial<Record<Atributo, number>>; talento?: string };
  subclasse?: string;
  /** Escolhas do talento adquirido (ex.: o atributo de Atleta). */
  escolhasTalento?: Escolhas;
  /** Bruxo: invocações místicas e Dádiva do Pacto depois do nível (ausente = não muda). */
  invocacoes?: string[];
  pacto?: string;
  /** Escolhas de classe/subclasse liberadas neste nível (Estilo de Luta, Especialização, Inimigo Favorito...). */
  escolhasClasse?: Escolhas;
};

/** Sobe um nível: registra o passo no histórico e atualiza classe, subclasse e talento. Não valida regras da mesa (use `validar`). */
export function subirNivel(b: Build, e: EscolhasSubida): Build {
  const i = e.classe ?? 0;
  const c = b.classes[i];
  if (!c) return b;
  const incremento = e.incremento && (e.incremento.talento || Object.keys(e.incremento.atributos ?? {}).length) ? e.incremento : undefined;
  const passo: PassoNivel = { classe: c.id, pv: e.pv, ...(incremento ? { incremento } : {}) };
  const subido: Build = {
    ...b,
    classes: b.classes.map((k, j) => (j === i ? { ...k, nivel: k.nivel + 1, ...(e.subclasse ? { subclasse: e.subclasse } : {}), ...(e.escolhasClasse && Object.keys(e.escolhasClasse).length ? { escolhas: { ...k.escolhas, ...e.escolhasClasse } } : {}) } : k)),
    historicoNiveis: [...(b.historicoNiveis ?? []), passo],
    ...(incremento?.talento && e.escolhasTalento ? { escolhasTalentos: { ...b.escolhasTalentos, [incremento.talento]: e.escolhasTalento } } : {}),
  };
  return c.id === "bruxo" && (e.invocacoes || e.pacto) ? definirInvocacoes(subido, e.invocacoes ?? c.escolhas?.invocacoes ?? [], e.pacto) : subido;
}

/** O incremento é um +2 em um atributo ou +1 em dois (ou um talento)? E respeita o teto de 20 dado o total atual? */
export function incrementoValido(inc: NonNullable<EscolhasSubida["incremento"]>, totais: Record<Atributo, number>): string | null {
  if (inc.talento) return Object.keys(inc.atributos ?? {}).length ? "Escolha um talento OU aumente atributos, não os dois." : null;
  const partes = Object.entries(inc.atributos ?? {}) as [Atributo, number][];
  const soma = partes.reduce((s, [, v]) => s + v, 0);
  if (soma !== 2) return "Distribua exatamente 2 pontos de atributo.";
  if (partes.some(([, v]) => v < 1 || v > 2)) return "Cada atributo recebe 1 ou 2 pontos.";
  if (partes.length === 2 && partes.some(([, v]) => v !== 1)) return "Dois atributos recebem +1 cada.";
  const acima = partes.find(([a, v]) => totais[a] + v > 20);
  return acima ? `Nenhum atributo passa de 20 (${acima[0].toUpperCase()}).` : null;
}
