"use client";

import { useSyncExternalStore } from "react";

// Controle local (por navegador) do que o jogador já viu em cada seção: guarda os ids.
// Serve só para avisos de "novo"; não é dado de negócio, então fica no localStorage.
const ouvintes = new Set<() => void>();
let versao = 0;

const assinar = (cb: () => void) => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; };

export function lerVistos(chave: string): string[] | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as string[]) : null;
  } catch {
    return null;
  }
}

export function gravarVistos(chave: string, ids: string[]) {
  try { localStorage.setItem(chave, JSON.stringify(ids)); } catch {}
  versao++;
  ouvintes.forEach((f) => f());
}

/** Faz o componente reler os vistos quando qualquer seção for gravada. */
export function useVersaoVistos(): number {
  return useSyncExternalStore(assinar, () => versao, () => 0);
}
