// Equipamento: proficiência em armas e armaduras, CA pela armadura equipada, ataques das armas, carga, sintonização
// e moedas. Funções puras; `derivar` as usa com os itens equipados da ficha.

import { type Ataque, type Atributo, type Item } from "../../dnd5e.ts";
import type { ArmaCat, ArmaduraCat, EscudoCat, Moeda, Preco } from "./catalogo.ts";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Tira o plural simples de cada palavra ("espadas longas" → "espada longa", "bordões" → "bordao"). */
const raiz = (s: string) => norm(s).split(" ").map((w) => (w.endsWith("oes") ? `${w.slice(0, -3)}ao` : w.length > 3 ? w.replace(/s$/, "") : w)).join(" ");
// nomes que o livro usa no plural/outra grafia para armas do catálogo
const ALIAS: Record<string, string> = { clava: "porrete", foice: "foice curta" };

/** Lista de proficiências ("Armas simples, bestas de mão e espadas curtas") em itens separados. */
export const itensDeTexto = (t: string): string[] => (/^\s*(nenhum|nenhuma)/i.test(t) || /^escolha/i.test(t) ? [] : t.split(/,\s*|\s+e\s+/).map((x) => x.trim().replace(/\.$/, "")).filter(Boolean));

export function proficienteEmArma(arma: ArmaCat, proficiencias: readonly string[]): boolean {
  const nome = raiz(arma.nome);
  const categoria = raiz(`armas ${arma.categoria === "simples" ? "simples" : "marciais"}`);
  return proficiencias.some((p) => {
    const r = raiz(p);
    return r === categoria || r === nome || ALIAS[r] === nome;
  });
}

export type CategoriaArmadura = ArmaduraCat["categoria"] | "escudo";
export function proficienteEmArmadura(categoria: CategoriaArmadura, proficiencias: readonly string[]): boolean {
  const re = { leve: /leve/, media: /m[eé]dia/, pesada: /pesada/, escudo: /escudo/ }[categoria];
  return proficiencias.some((p) => /todas/i.test(p) || re.test(norm(p)));
}

// ---------- CA ----------
export type ParteCa = { rotulo: string; valor: number };

/** Capacidades que mudam a base de CA sem armadura. */
const SEM_ARMADURA: Record<string, { atr: Atributo; rotulo: string; semEscudo?: boolean }> = {
  barbaro: { atr: "con", rotulo: "Constituição (Defesa sem Armadura)" },
  monge: { atr: "sab", rotulo: "Sabedoria (Defesa sem Armadura)", semEscudo: true },
};

export type EntradaCa = {
  mods: Record<Atributo, number>;
  /** Classes do personagem, na ordem em que as obteve: a primeira com Defesa sem Armadura vale (não acumula). */
  classeIds?: string[];
  armadura?: { cat: ArmaduraCat; bonusMagico: number; nome: string };
  escudo?: { cat: EscudoCat; bonusMagico: number };
  /** Magia Armadura Arcana ligada: sem armadura, a base é 13. */
  armaduraArcana?: boolean;
};

/** Base e partes da CA: armadura (com limite de Des) ou o melhor cálculo sem armadura; escudo e bônus mágicos somam. */
export function partesDeCa(e: EntradaCa): { base: ParteCa; extras: ParteCa[] } {
  const extras: ParteCa[] = [];
  let base: ParteCa;
  if (e.armadura) {
    const a = e.armadura.cat;
    base = { rotulo: e.armadura.nome, valor: a.caBase };
    if (a.somaDes) extras.push({ rotulo: a.maxDes !== undefined && e.mods.des > a.maxDes ? `Destreza (máx. +${a.maxDes})` : "Destreza", valor: a.maxDes !== undefined ? Math.min(e.mods.des, a.maxDes) : e.mods.des });
    if (e.armadura.bonusMagico) extras.push({ rotulo: "Bônus mágico da armadura", valor: e.armadura.bonusMagico });
  } else {
    base = e.armaduraArcana ? { rotulo: "Armadura Arcana", valor: 13 } : { rotulo: "Base sem armadura", valor: 10 };
    extras.push({ rotulo: "Destreza", valor: e.mods.des });
    const alt = e.armaduraArcana ? undefined : (e.classeIds ?? []).map((id) => SEM_ARMADURA[id]).find(Boolean);
    if (alt && !(alt.semEscudo && e.escudo) && e.mods[alt.atr] > 0) extras.push({ rotulo: alt.rotulo, valor: e.mods[alt.atr] });
  }
  if (e.escudo) {
    extras.push({ rotulo: "Escudo", valor: e.escudo.cat.bonusCa });
    if (e.escudo.bonusMagico) extras.push({ rotulo: "Bônus mágico do escudo", valor: e.escudo.bonusMagico });
  }
  return { base, extras };
}

// ---------- ataques das armas ----------
const dec = (n: number) => String(n).replace(".", ",");

function notasDaArma(a: ArmaCat): string {
  const p = a.propriedades;
  const t: string[] = [];
  if (p.acuidade) t.push("acuidade");
  if (p.leve) t.push("leve");
  if (p.pesada) t.push("pesada");
  if (p.alcance) t.push("alcance +1,5 m");
  if (p.duasMaos) t.push("duas mãos");
  if (p.recarga) t.push("recarga");
  if (p.arremesso) t.push(`arremesso ${dec(p.arremesso.normal)}/${dec(p.arremesso.longo)} m`);
  if (p.municao) t.push(`munição ${dec(p.municao.normal)}/${dec(p.municao.longo)} m`);
  if (p.especial) t.push("especial");
  return t.join(", ");
}

/** Atributo do ataque: à distância usa Destreza; acuidade usa o maior entre Força e Destreza; o resto, Força. */
export function atributoDaArma(a: ArmaCat, mods: Record<Atributo, number>): Atributo {
  if (a.distancia) return "des";
  if (a.propriedades.acuidade) return mods.des > mods.for ? "des" : "for";
  return "for";
}

export type EntradaAtaques = {
  itens: readonly Item[];
  arma: (id: string) => ArmaCat | undefined;
  mods: Record<Atributo, number>;
  proficiencias: readonly string[];
};

/** Linhas de ataque das armas equipadas (e do ataque desarmado). Versátil gera uma linha extra de duas mãos. */
export function ataquesDeArmas(e: EntradaAtaques): Ataque[] {
  const out: Ataque[] = [];
  for (const item of e.itens) {
    if (!item.equipado || !item.catalogoId) continue;
    const arma = e.arma(item.catalogoId);
    if (!arma || !arma.dado) continue;
    const base = {
      atr: atributoDaArma(arma, e.mods), proficiente: proficienteEmArma(arma, e.proficiencias),
      bonusAtaque: item.bonusMagico ?? 0, bonusDano: item.bonusMagico ?? 0, tipoDano: arma.tipoDano ?? "", derivado: true as const,
    };
    const nome = item.nome || arma.nome;
    const notas = notasDaArma(arma);
    out.push({ ...base, id: `arma:${item.id}`, nome, dano: arma.dado, notas });
    if (arma.propriedades.versatil) out.push({ ...base, id: `arma:${item.id}:2m`, nome: `${nome} (duas mãos)`, dano: arma.propriedades.versatil, notas });
  }
  out.push({ id: "arma:desarmado", nome: "Ataque desarmado", atr: "for", proficiente: true, bonusAtaque: 0, dano: "1d1", bonusDano: 0, tipoDano: "concussão", notas: "dano fixo 1 + Força", derivado: true });
  return out;
}

// ---------- carga e sintonização ----------
export const MAX_SINTONIZADOS = 3;
/** Capacidade de carga em kg: 15 × Força em libras no livro, convertido pela edição brasileira (≈ 7,5 kg por ponto). */
export const capacidadeDeCarga = (forca: number) => Math.round(forca * 7.5 * 100) / 100;
export const sintonizados = (itens: readonly Item[]) => itens.filter((i) => i.sintonizado).length;

// ---------- moedas ----------
/** Valor de cada moeda em peças de cobre. */
export const VALOR_EM_COBRE: Record<Moeda, number> = { pc: 1, pp: 10, pe: 50, po: 100, pl: 1000 };
export const totalEmCobre = (m: Record<Moeda, number>) => (Object.keys(VALOR_EM_COBRE) as Moeda[]).reduce((a, k) => a + (m[k] ?? 0) * VALOR_EM_COBRE[k], 0);
export const emOuro = (m: Record<Moeda, number>) => totalEmCobre(m) / 100;
export const precoEmCobre = (p: Preco | undefined) => (p ? p.valor * VALOR_EM_COBRE[p.moeda] : 0);

/**
 * Troca `qtd` moedas de `de` pela mesma riqueza em `para`; só troca o que dá exato (sem fração de moeda).
 * Devolve as moedas iguais se não der para trocar.
 */
export function trocarMoedas(m: Record<Moeda, number>, de: Moeda, para: Moeda, qtd: number): Record<Moeda, number> {
  const n = Math.min(Math.max(0, Math.floor(qtd)), m[de]);
  if (n <= 0 || de === para) return m;
  const valor = n * VALOR_EM_COBRE[de];
  const recebe = Math.floor(valor / VALOR_EM_COBRE[para]);
  const gasta = Math.ceil((recebe * VALOR_EM_COBRE[para]) / VALOR_EM_COBRE[de]);
  if (recebe <= 0 || gasta <= 0) return m;
  return { ...m, [de]: m[de] - gasta, [para]: m[para] + recebe };
}

/** Desconta um preço pagando com as moedas que houver (da menor para a maior, dando troco em cobre). `null` se não cobrir. */
export function pagar(m: Record<Moeda, number>, custoCobre: number): Record<Moeda, number> | null {
  if (custoCobre <= 0) return m;
  if (totalEmCobre(m) < custoCobre) return null;
  let falta = custoCobre;
  const novo = { ...m };
  for (const k of ["pc", "pp", "pe", "po", "pl"] as Moeda[]) {
    const v = VALOR_EM_COBRE[k];
    const usa = Math.min(novo[k], Math.ceil(falta / v));
    novo[k] -= usa;
    falta -= usa * v;
    if (falta <= 0) break;
  }
  if (falta < 0) { // pagou a mais: devolve o troco na maior moeda possível
    let troco = -falta;
    for (const k of ["pl", "po", "pe", "pp", "pc"] as Moeda[]) {
      const q = Math.floor(troco / VALOR_EM_COBRE[k]);
      novo[k] += q;
      troco -= q * VALOR_EM_COBRE[k];
    }
  }
  return novo;
}

