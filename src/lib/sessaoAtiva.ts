"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Sessão ao vivo em andamento (por mesa). Fica no sessionStorage da aba: sobrevive à navegação e ao
// recarregar, e termina quando o mestre encerra a sessão ou fecha o site (a aba), cancelando-a.
export type SessaoAtiva = { iniciadaEm: number; rodando: boolean; inicioTrecho: number; acumulado: number };

const ouvintes = new Set<() => void>();
const assinar = (cb: () => void) => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; };
const chave = (mesaId: string) => `sessao-ativa:${mesaId}`;
const ler = (mesaId: string) => { try { return sessionStorage.getItem(chave(mesaId)); } catch { return null; } };
const gravar = (mesaId: string, s: SessaoAtiva | null) => {
  try { if (s) sessionStorage.setItem(chave(mesaId), JSON.stringify(s)); else sessionStorage.removeItem(chave(mesaId)); } catch {}
  ouvintes.forEach((f) => f());
};
const atual = (mesaId: string): SessaoAtiva | null => {
  const b = ler(mesaId);
  if (!b) return null;
  try { return JSON.parse(b) as SessaoAtiva; } catch { return null; }
};

export const segundosDaSessao = (s: SessaoAtiva, agora = Date.now()) =>
  s.acumulado + (s.rodando ? Math.floor((agora - s.inicioTrecho) / 1000) : 0);

export function useSessaoAtiva(mesaId: string) {
  const bruto = useSyncExternalStore(assinar, () => ler(mesaId), () => null);
  const sessao = useMemo<SessaoAtiva | null>(() => {
    if (!bruto) return null;
    try { return JSON.parse(bruto) as SessaoAtiva; } catch { return null; }
  }, [bruto]);

  // Inicia (com o cronômetro rodando) se ainda não houver sessão aberta; não mexe numa sessão existente.
  const iniciar = useCallback(() => {
    if (atual(mesaId)) return;
    const agora = Date.now();
    gravar(mesaId, { iniciadaEm: agora, rodando: true, inicioTrecho: agora, acumulado: 0 });
  }, [mesaId]);
  const encerrar = useCallback(() => gravar(mesaId, null), [mesaId]);
  const alternar = useCallback(() => {
    const s = atual(mesaId);
    if (!s) return;
    const agora = Date.now();
    gravar(mesaId, s.rodando ? { ...s, rodando: false, acumulado: segundosDaSessao(s, agora) } : { ...s, rodando: true, inicioTrecho: agora });
  }, [mesaId]);
  const zerar = useCallback(() => {
    const s = atual(mesaId);
    if (s) gravar(mesaId, { ...s, rodando: false, acumulado: 0, inicioTrecho: Date.now() });
  }, [mesaId]);

  return { sessao, iniciar, encerrar, alternar, zerar };
}
