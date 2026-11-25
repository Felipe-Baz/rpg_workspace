// Motor de efeitos, independente de sistema. Toda fonte de regra (raça, item, condição, magia ativa...) declara
// efeitos tipados sobre um "alvo" (string livre definida pelo sistema, ex.: "atr.for", "ca", "deslocamento").
// `resolver` aplica a pilha numa ordem fixa e devolve o total com a origem de cada parte (princípio "sempre explicável").
// Puro, sem React nem Firestore: cada sistema (D&D 5e, Tormenta20...) só fornece alvos e fontes.

export type OperacaoEfeito =
  | "definir" // substitui a base (vale o de maior prioridade; empate: o último)
  | "somar" // soma ao valor
  | "piso" // garante no mínimo N (ex.: Força 19 do Cinto do Gigante)
  | "teto"; // limita a no máximo N

export type Efeito = {
  alvo: string;
  op: OperacaoEfeito;
  valor: number;
  /** Rótulo mostrado ao jogador, ex.: "Alto Elfo", "Escudo". Preenchido por `fonte()` quando omitido. */
  origem?: string;
  /** Só para `definir`: maior vence (ex.: armadura sobre "sem armadura"). */
  prioridade?: number;
};

export type Fonte = { id: string; nome: string; efeitos: Efeito[] };

export type ParteValor = { rotulo: string; valor: number };
export type Valor = { total: number; partes: ParteValor[] };

/** Cria uma fonte copiando o nome dela para a origem dos efeitos que não têm rótulo. */
export function fonte(id: string, nome: string, efeitos: Efeito[]): Fonte {
  return { id, nome, efeitos: efeitos.map((e) => ({ ...e, origem: e.origem ?? nome })) };
}

/** Achata as fontes numa lista de efeitos (já com origem). */
export const efeitosDe = (fontes: readonly Fonte[]): Efeito[] =>
  fontes.flatMap((f) => f.efeitos.map((e) => ({ ...e, origem: e.origem ?? f.nome })));

/**
 * Ordem: base (ou `definir` de maior prioridade) → somas → piso → teto.
 * `partes` lista cada contribuição na ordem aplicada; a soma das partes é sempre o total antes de piso/teto.
 */
export function resolver(alvo: string, base: ParteValor, efeitos: readonly Efeito[]): Valor {
  const meus = efeitos.filter((e) => e.alvo === alvo);
  const partes: ParteValor[] = [base];

  const definicoes = meus.filter((e) => e.op === "definir");
  if (definicoes.length) {
    let vencedor = definicoes[0];
    for (const d of definicoes) if ((d.prioridade ?? 0) >= (vencedor.prioridade ?? 0)) vencedor = d;
    partes[0] = { rotulo: vencedor.origem ?? "Definido", valor: vencedor.valor };
  }
  for (const e of meus) if (e.op === "somar" && e.valor !== 0) partes.push({ rotulo: e.origem ?? "Bônus", valor: e.valor });

  let total = partes.reduce((a, p) => a + p.valor, 0);
  for (const e of meus) {
    if (e.op === "piso" && total < e.valor) {
      partes.push({ rotulo: `${e.origem ?? "Mínimo"} (mínimo ${e.valor})`, valor: e.valor - total });
      total = e.valor;
    }
  }
  for (const e of meus) {
    if (e.op === "teto" && total > e.valor) {
      partes.push({ rotulo: `${e.origem ?? "Limite"} (máximo ${e.valor})`, valor: e.valor - total });
      total = e.valor;
    }
  }
  return { total, partes };
}

/** "11 Couro batido + 3 Destreza + 2 Escudo" (sinais explícitos a partir da segunda parte). */
export function explicar(v: Valor): string {
  return v.partes
    .map((p, i) => (i === 0 ? `${p.valor} ${p.rotulo}` : `${p.valor >= 0 ? "+" : "−"} ${Math.abs(p.valor)} ${p.rotulo}`))
    .join(" ");
}
