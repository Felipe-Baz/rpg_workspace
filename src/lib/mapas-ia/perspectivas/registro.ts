import { isometrica } from "./isometrica.ts";
import { topdown } from "./topdown.ts";
import type { Perspectiva } from "./tipos.ts";

// Para adicionar uma perspectiva: crie o arquivo em este diretório, a imagem de exemplo em
// public/perspectivas/ e acrescente UMA linha aqui.
export const PERSPECTIVAS: Perspectiva[] = [
  topdown,
  isometrica,
];

export const PERSPECTIVA_PADRAO = "topdown";

export const obterPerspectiva = (id: string | undefined, lista: Perspectiva[] = PERSPECTIVAS) =>
  lista.find((p) => p.id === (id ?? PERSPECTIVA_PADRAO));

/** Perspectivas que o mestre pode escolher: em grid só as que permitem grid (hoje, top-down). */
export const perspectivasDisponiveis = (modo: "grid" | "cenario", lista: Perspectiva[] = PERSPECTIVAS) =>
  modo === "grid" ? lista.filter((p) => p.permiteGrid) : lista;

/** Regra de grid: mapas em grid são sempre top-down. */
export const perspectivaEfetiva = (modo: "grid" | "cenario", escolhida: string | undefined) =>
  modo === "grid" ? PERSPECTIVA_PADRAO : obterPerspectiva(escolhida) ? (escolhida ?? PERSPECTIVA_PADRAO) : PERSPECTIVA_PADRAO;

/** Se o seletor deve aparecer (em grid fica oculto: perspectiva fixa). */
export const mostrarSeletor = (modo: "grid" | "cenario") => modo === "cenario";

/**
 * Chave de ordenação (zIndex) de um objeto dentro da camada.
 * - porZ: o campo z manda (ordem de inserção desempata).
 * - porY: quem tem maior Y fica na frente; z só desempata.
 * - nenhuma: ordem de inserção.
 */
export function chaveOrdem(p: Perspectiva | undefined, o: { y: number; z: number }, indice: number): number {
  const ord = p?.ordenacao ?? "porZ";
  if (ord === "nenhuma") return indice;
  if (ord === "porY") return Math.round(o.y * 1_000_000) * 1000 + Math.max(-400, Math.min(400, o.z)) + indice * 1e-4;
  return o.z * 100000 + indice;
}

/** Asset sem `perspectivaId` (anterior a esta change) é top-down. */
export const assetServe = (asset: { perspectivaId?: string }, perspectivaId: string | undefined) =>
  (asset.perspectivaId ?? PERSPECTIVA_PADRAO) === (perspectivaId ?? PERSPECTIVA_PADRAO);
