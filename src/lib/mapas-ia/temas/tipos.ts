// Tema da mesa: perfil de estilo reaproveitado por toda geração futura. Módulo puro.

/** Documento mesas/{id}/temas/{temaId}. */
export interface Tema {
  id: string;
  nome: string;
  descricao: string;
  /** Cores "#rrggbb" (até 8). */
  paleta: string[];
  regras: string[];
  proibidos: string[];
  /** Imagens âncora (URLs no Storage) usadas como referência de estilo. */
  ancoras: string[];
  /** Imagens de referência enviadas pelo mestre (URLs no Storage). */
  referencias: string[];
  geradoPorIA: boolean;
  criadoEm: number;
}

/** Perfil de estilo (parte editável do tema). */
export type PerfilEstilo = Pick<Tema, "descricao" | "paleta" | "regras" | "proibidos">;

export const MAX_PALETA = 8;
const LIMITE_ITEM = 300;
const LIMITE_LISTA = 20;

export const ehCorHex = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);

const lista = (v: unknown, max = LIMITE_LISTA): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, LIMITE_ITEM))
        .filter(Boolean)
        .slice(0, max)
    : [];

/** Normaliza um perfil vindo da IA ou do formulário: tipos, limites e cores válidas. */
export function normalizarPerfil(bruto: unknown): PerfilEstilo {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  return {
    descricao: typeof o.descricao === "string" ? o.descricao.trim().slice(0, 2000) : "",
    paleta: (Array.isArray(o.paleta) ? o.paleta : []).filter(ehCorHex).map((c) => c.toLowerCase()).slice(0, MAX_PALETA),
    regras: lista(o.regras),
    proibidos: lista(o.proibidos),
  };
}

/** Linhas de um textarea -> lista (ignora vazias). */
export const linhasParaLista = (t: string) => lista(t.split("\n"));
