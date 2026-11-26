// Forma Selvagem do druida (Livro do Jogador, classe Druida e Círculo da Lua). Funções puras.
//
// A ficha só guarda `forma: { feraId, pv }`. Enquanto há forma, a ficha EFETIVA (a que a tela lê) troca o que o livro
// manda trocar (`comForma`): Força, Destreza e Constituição, CA, deslocamento, PV e os ataques passam a ser os da fera;
// Inteligência, Sabedoria, Carisma, proficiências, nível e espaços de magia continuam os do druida. `gravavel`
// (efetiva.ts) faz o caminho inverso antes de gravar, então os números do druida nunca são sobrescritos.

import { PERICIAS, bonusProficiencia, modificador, nivelNaClasse, type Atributo, type Ataque, type FichaDnd } from "../../dnd5e.ts";

// ---------- catálogo de feras (gerado de docs/referencias/bestiario por scripts/dnd5e/gerar-feras.mjs) ----------
export type AtaqueFera = { nome: string; corpo: boolean; bonus: number; alcance: string; dano: string; bonusDano: number; tipoDano: string; nota?: string };
export type Fera = {
  id: string; nome: string; tamanho: string; nd: string; ndNum: number;
  ca: number; caTexto: string; pv: number; pvTexto: string;
  deslocamento: string; voa: boolean; nada: boolean;
  atributos: Record<Atributo, number>; pericias: Record<string, number>; sentidos: string;
  tracos: { nome: string; texto: string }[]; ataques: AtaqueFera[]; acoes: { nome: string; texto: string }[];
  /** Elemental (Forma Selvagem de Elemental do Círculo da Lua): gasta 2 usos. */
  elemental?: boolean;
  /** Tipos de dano puros (as resistências "a ataques não-mágicos" ficam só em `defesasTexto`). */
  defesas?: { resistencias: string[]; vulnerabilidades: string[]; imunidades: string[] };
  defesasTexto?: string[];
};

let cache: Promise<Fera[]> | undefined;
/** Carrega o JSON só na primeira chamada (import dinâmico; não pesa nas telas que não usam a Forma Selvagem). */
export function carregarFeras(): Promise<Fera[]> {
  cache ??= import("../../../data/dnd5e/phb/feras.json").then((m) => (m.default ?? m) as unknown as Fera[]);
  return cache;
}

// ---------- o que o druida pode assumir ----------
export type LimiteForma = {
  ndMax: number;
  semVoo: boolean;
  semNatacao: boolean;
  /** Círculo da Lua: Forma Selvagem com ação bônus, cura gastando espaço, ND maior. */
  lua: boolean;
  /** Duração em horas (metade do nível de druida, arredondada para baixo). */
  horas: number;
  /** Círculo da Lua, 10º nível: pode assumir um elemental (2 usos). */
  elemental: boolean;
  nivel: number;
};

export const ehCirculoDaLua = (f: Pick<FichaDnd, "subclasse">) => /lua/i.test(f.subclasse ?? "");

/** Tabela "Formas de Besta" do livro; o Círculo da Lua usa ND 1 e, a partir do 6º nível, nível ÷ 3 (arredondado para baixo). */
export function limiteDaForma(f: Pick<FichaDnd, "classe" | "nivel" | "classes" | "subclasse">): LimiteForma | null {
  const n = nivelNaClasse(f, "druida");
  if (n < 2) return null;
  const lua = ehCirculoDaLua(f);
  const tabela = n >= 8 ? { nd: 1, voo: false, nat: false } : n >= 4 ? { nd: 0.5, voo: true, nat: false } : { nd: 0.25, voo: true, nat: true };
  const ndLua = n >= 6 ? Math.max(1, Math.floor(n / 3)) : 1;
  return {
    ndMax: lua ? Math.max(tabela.nd, ndLua) : tabela.nd,
    // a Lua ignora a coluna ND Máx., mas respeita as limitações de voo e natação da tabela
    semVoo: tabela.voo, semNatacao: tabela.nat, lua, horas: Math.floor(n / 2), nivel: n, elemental: lua && n >= 10,
  };
}

/** Elemental só no Círculo da Lua a partir do 10º nível (sem as limitações de ND, voo e natação das bestas). */
export const feraPermitida = (fera: Fera, l: LimiteForma) =>
  fera.elemental ? l.elemental : fera.ndNum <= l.ndMax && !(l.semVoo && fera.voa) && !(l.semNatacao && fera.nada);

/** Usos da Forma Selvagem gastos ao assumir a forma (elemental: dois). */
export const custoDaForma = (fera: Fera) => (fera.elemental ? 2 : 1);

/** Por que a fera não serve (ou `null` se serve). */
export function motivoDaFera(fera: Fera, l: LimiteForma): string | null {
  if (fera.elemental) return l.elemental ? null : "só o Círculo da Lua, a partir do 10º nível";
  if (fera.ndNum > l.ndMax) return `ND ${fera.nd} acima do máximo (${fmtNd(l.ndMax)})`;
  if (l.semVoo && fera.voa) return "tem deslocamento de voo";
  if (l.semNatacao && fera.nada) return "tem deslocamento de natação";
  return null;
}
export const fmtNd = (n: number) => (n === 0.125 ? "1/8" : n === 0.25 ? "1/4" : n === 0.5 ? "1/2" : String(n));

// ---------- ficha efetiva com a fera ----------
const modDe = (v: number) => modificador(v);

/** Linhas de ataque da fera. O acerto e o dano ficam exatamente os do livro (o atributo é só o que torna a conta legível). */
export function ataquesDaFera(fera: Fera, lua6: boolean): Ataque[] {
  return fera.ataques.map((a, i) => {
    const profFera = fera.ndNum >= 5 ? 3 : 2;
    // escolhe Força ou Destreza: o que deixa o acerto mais próximo da proficiência da fera
    const cand: Atributo[] = ["for", "des"];
    const atr = cand.reduce((m, c) => (Math.abs(a.bonus - modDe(fera.atributos[c]) - profFera) < Math.abs(a.bonus - modDe(fera.atributos[m]) - profFera) ? c : m), "for" as Atributo);
    const mod = modDe(fera.atributos[atr]);
    return {
      id: `fera-${fera.id}-${i}`, nome: a.nome, atr, proficiente: false, bonusAtaque: a.bonus - mod,
      dano: a.dano, bonusDano: a.bonusDano - mod, tipoDano: a.tipoDano,
      notas: [a.alcance, lua6 ? "conta como mágico (Ataque Primordial)" : "", a.nota ?? ""].filter(Boolean).join(". "),
      derivado: true,
    };
  });
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Perícias: o druida mantém as proficiências; se a fera tem a MESMA perícia e o bônus dela é maior que o do druida
 * (já com os atributos físicos da fera), vale o da fera. Devolve os bônus extras com a diferença somada.
 */
export function bonusPericiasComFera(f: FichaDnd, atributos: FichaDnd["atributos"], fera: Fera): FichaDnd["bonusPericias"] {
  const out = { ...f.bonusPericias };
  for (const [nome, bonusFera] of Object.entries(fera.pericias)) {
    const p = PERICIAS.find((x) => semAcento(x.nome) === semAcento(nome));
    const nivel = p ? (f.pericias[p.id] ?? 0) : 0;
    if (!p || nivel <= 0) continue;
    const meu = modificador(atributos[p.atr]) + nivel * bonusProficiencia(f.nivel) + (f.bonusPericias[p.id] ?? 0);
    if (bonusFera > meu) out[p.id] = (out[p.id] ?? 0) + (bonusFera - meu);
  }
  return out;
}

/** A ficha com os números da fera. Só para a tela: nunca grave isto direto (use `gravavel`). */
export function comForma(f: FichaDnd, fera: Fera): FichaDnd {
  const forma = f.forma;
  if (!forma) return f;
  const atributos = { ...f.atributos, for: fera.atributos.for, des: fera.atributos.des, con: fera.atributos.con };
  const n = nivelNaClasse(f, "druida");
  const d = fera.defesas;
  return {
    ...f,
    atributos,
    bonusPericias: bonusPericiasComFera(f, atributos, fera),
    ...(d ? { defesas: { resistencias: [...(f.defesas?.resistencias ?? []), ...d.resistencias], vulnerabilidades: [...(f.defesas?.vulnerabilidades ?? []), ...d.vulnerabilidades], imunidades: [...(f.defesas?.imunidades ?? []), ...d.imunidades] } } : {}),
    ca: fera.ca,
    deslocamento: fera.deslocamento,
    pvMax: fera.pv, pv: Math.max(0, Math.min(forma.pv, fera.pv)), pvTemp: 0,
    ataques: ataquesDaFera(fera, ehCirculoDaLua(f) && n >= 6),
  };
}

/** Desfaz o que `comForma` sobrepôs, para gravar: números do druida de volta, PV da fera em `forma.pv`. */
export function semSobreposicao(bruta: FichaDnd, editada: FichaDnd): FichaDnd {
  if (!bruta.forma || !editada.forma) return editada;
  return {
    ...editada,
    atributos: bruta.atributos, bonusPericias: bruta.bonusPericias, defesas: bruta.defesas, ca: bruta.ca, deslocamento: bruta.deslocamento, pvMax: bruta.pvMax, pv: bruta.pv, pvTemp: bruta.pvTemp,
    forma: { ...editada.forma, pv: Math.max(0, editada.pv) },
    // as linhas da fera não são gravadas; ataques novos do jogador entram junto com os que ele já tinha
    ataques: [...bruta.ataques, ...editada.ataques.filter((a) => !a.derivado && !bruta.ataques.some((b) => b.id === a.id))],
  };
}

// ---------- assumir e reverter ----------
export const emForma = (f: Pick<FichaDnd, "forma">) => !!f.forma;

/** Assume a forma (a característica já deve ter gasto o uso). O PV da fera começa cheio. */
export const assumirForma = (f: FichaDnd, fera: Fera): FichaDnd => ({
  ...f, forma: { feraId: fera.id, pv: fera.pv }, ativos: [...new Set([...(f.ativos ?? []), "forma-selvagem"])],
});

/** Volta à forma normal: o druida retorna aos PV que tinha antes (guardados em `pv`, que a forma não toca). */
export const reverterForma = (f: FichaDnd): FichaDnd => {
  const { forma: _forma, ...resto } = f;
  void _forma;
  return { ...resto, ativos: (f.ativos ?? []).filter((x) => x !== "forma-selvagem") };
};

/**
 * Dano com a fera: tira dos PV dela. Se eles acabam, volta à forma normal e o que sobrou passa para o druida
 * (se isso não o zerar, ele não cai inconsciente). `real` é a ficha SEM a sobreposição da fera.
 */
export function danoNaForma(real: FichaDnd, danoFinal: number, aplicarNoDruida: (f: FichaDnd, dano: number) => { ficha: FichaDnd; texto: string[] }): { ficha: FichaDnd; texto: string[]; voltou: boolean } {
  const forma = real.forma;
  if (!forma) return { ficha: real, texto: [], voltou: false };
  const d = Math.max(0, Math.floor(danoFinal));
  if (d < forma.pv) return { ficha: { ...real, forma: { ...forma, pv: forma.pv - d } }, texto: [], voltou: false };
  const excesso = d - forma.pv;
  const volta = reverterForma(real);
  const texto = ["A fera chegou a 0 PV: você volta à forma normal."];
  if (excesso <= 0) return { ficha: volta, texto, voltou: true };
  const r = aplicarNoDruida(volta, excesso);
  return { ficha: r.ficha, texto: [...texto, `${excesso} de dano excedente passa para você.`, ...r.texto], voltou: true };
}

// ---------- Círculo da Lua: Forma Selvagem de Combate ----------
/** Espaço de magia gasto (ação bônus) para ganhar 1d8 PV por círculo do espaço, só em forma e só no Círculo da Lua. */
export function curaDeCombate(f: FichaDnd, circulo: number): { ok: true; ficha: FichaDnd; dado: string } | { ok: false; motivo: string } {
  if (!f.forma) return { ok: false, motivo: "Só enquanto estiver transformado." };
  if (!ehCirculoDaLua(f)) return { ok: false, motivo: "É uma característica do Círculo da Lua." };
  const e = f.espacos[circulo - 1];
  if (!e || e.total - e.usados <= 0) return { ok: false, motivo: `Sem espaço de ${circulo}º círculo disponível.` };
  return { ok: true, ficha: { ...f, espacos: f.espacos.map((x, i) => (i === circulo - 1 ? { ...x, usados: x.usados + 1 } : x)) }, dado: `${circulo}d8` };
}

/** Em forma de fera não se conjura (as magias já ativas continuam); no 18º nível, Magias da Besta permite (sem componentes materiais). */
export function motivoSemConjurar(f: Pick<FichaDnd, "forma" | "classe" | "nivel" | "classes">): string | null {
  if (!f.forma) return null;
  return nivelNaClasse(f, "druida") >= 18 ? null : "Transformado em fera você não pode conjurar magias. Volte à forma normal.";
}


// ---------- Círculo da Lua: Mil Formas ----------
export const temMilFormas = (f: Pick<FichaDnd, "classe" | "nivel" | "classes" | "subclasse">) => ehCirculoDaLua(f) && nivelNaClasse(f, "druida") >= 14;

/**
 * Mil Formas (14º nível): _alterar-se_ à vontade, sem gastar espaço. Registra a concentração na magia
 * (a duração e o efeito são os do livro; a ficha não aplica a mudança de aparência).
 */
export function alterarSeAVontade(f: FichaDnd): { ok: true; ficha: FichaDnd; encerrou?: string } | { ok: false; motivo: string } {
  if (!temMilFormas(f)) return { ok: false, motivo: "Mil Formas é do Círculo da Lua, a partir do 14º nível." };
  const semConjurar = motivoSemConjurar(f);
  if (semConjurar) return { ok: false, motivo: semConjurar };
  const anterior = f.concentracao && f.concentracao.magiaId !== "alterar-se" ? f.concentracao.nome : undefined;
  return { ok: true, ficha: { ...f, concentracao: { magiaId: "alterar-se", nome: "Alterar-se (Mil Formas)" } }, ...(anterior ? { encerrou: anterior } : {}) };
}
