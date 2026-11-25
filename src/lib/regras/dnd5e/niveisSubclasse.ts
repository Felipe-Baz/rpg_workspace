// O catálogo não guarda o nível em que cada característica de SUBCLASSE chega. O texto do livro abre dizendo
// ("A partir do 6º nível, ..."), então o nível vem da primeira menção nos primeiros caracteres; sem menção (listas de
// magias expandidas, opções de terreno, manobras) vale o nível em que a subclasse é obtida.

import type { Subclasse } from "./catalogo.ts";

/** Correções onde o texto cita outro nível antes do nível em que a característica chega (id da característica). */
const CORRECOES: Record<string, number> = { "magias-de-circulo": 3 };

export function nivelDaCaracteristicaSub(k: Subclasse["caracteristicas"][number], nivelSubclasse: number): number {
  const fixo = CORRECOES[k.id];
  if (fixo) return fixo;
  const m = k.texto.slice(0, 200).match(/(\d+)\s*[°ºª]\s*n[íi]vel/);
  return Math.max(nivelSubclasse, m ? Number(m[1]) : nivelSubclasse);
}

/** Só as características de subclasse já liberadas no nível dado. */
export const caracteristicasSubAteNivel = (sub: Subclasse, nivel: number, nivelSubclasse: number) =>
  sub.caracteristicas.filter((k) => nivelDaCaracteristicaSub(k, nivelSubclasse) <= nivel);
