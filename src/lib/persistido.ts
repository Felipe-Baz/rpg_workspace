"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Estado persistido no localStorage (por navegador), compartilhado entre componentes da mesma página.
// Para dados de sessão ao vivo (rolagens, iniciativa, notas rápidas) que não precisam ir ao Firestore.
const ouvintes = new Set<() => void>();
const assinar = (cb: () => void) => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; };
const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function usePersistido<T>(chave: string, inicial: T): [T, (v: T | ((atual: T) => T)) => void] {
  const bruto = useSyncExternalStore(assinar, () => ler(chave), () => null);
  const valor = useMemo<T>(() => {
    if (bruto === null) return inicial;
    try { return JSON.parse(bruto) as T; } catch { return inicial; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bruto]);

  const definir = useCallback((v: T | ((atual: T) => T)) => {
    let atual = inicial;
    const b = ler(chave);
    if (b !== null) { try { atual = JSON.parse(b) as T; } catch {} }
    const novo = typeof v === "function" ? (v as (a: T) => T)(atual) : v;
    try { localStorage.setItem(chave, JSON.stringify(novo)); } catch {}
    ouvintes.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return [valor, definir];
}
