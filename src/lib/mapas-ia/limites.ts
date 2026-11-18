// Regras puras de teto de gasto (contagem de gerações por mesa e período).

export const TETO_PADRAO = 50; // gerações por período (padrão baixo, evita surpresa de custo)

/** Período mensal, ex.: "2026-11". */
export const periodoDe = (d: Date = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export interface UsoPeriodo {
  total: number;
  porProvedor: Record<string, number>;
}

export type Decisao = { ok: true; restante: number } | { ok: false; motivo: string; restante: number };

/** Decide se `quantidade` gerações cabem no teto. */
export function verificarTeto(uso: Pick<UsoPeriodo, "total">, teto: number, quantidade = 1): Decisao {
  const restante = Math.max(0, teto - uso.total);
  if (quantidade > restante) {
    return {
      ok: false,
      restante,
      motivo: `Teto de ${teto} gerações no período atingido (${uso.total} usadas, ${quantidade} pedidas). Aumente o teto para continuar.`,
    };
  }
  return { ok: true, restante: restante - quantidade };
}

export interface Estimativa {
  quantidade: number;
  /** Lotes acima do limite exigem confirmação explícita. */
  exigeConfirmacao: boolean;
  cabeNoTeto: boolean;
  restanteAposLote: number;
}

export const LIMITE_SEM_CONFIRMAR = 1;

export function estimarLote(uso: Pick<UsoPeriodo, "total">, teto: number, quantidade: number): Estimativa {
  const d = verificarTeto(uso, teto, quantidade);
  return {
    quantidade,
    exigeConfirmacao: quantidade > LIMITE_SEM_CONFIRMAR,
    cabeNoTeto: d.ok,
    restanteAposLote: d.ok ? d.restante : d.restante,
  };
}
