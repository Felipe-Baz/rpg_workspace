"use client";

import { auth } from "./firebase";

export type PessoaMesa = { uid: string; nome: string; em?: number };
export type AcaoMembro = "remover" | "apagarFicha" | "bloquear" | "desbloquear";

async function chamar<T>(caminho: string, init?: { corpo: unknown }): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Não autenticado.");
  const r = await fetch(caminho, {
    method: init ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, ...(init ? { "content-type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j as T;
}

/** Contas que estão na mesa (exceto o mestre) e as bloqueadas. Só o mestre. */
export const listarPessoas = (mesaId: string) =>
  chamar<{ membros: PessoaMesa[]; bloqueados: PessoaMesa[] }>(`/api/mesas/membros?mesaId=${encodeURIComponent(mesaId)}`);

/** Ação do mestre sobre uma conta da mesa (ver `/api/mesas/membros`). */
export const agirSobreMembro = (mesaId: string, acao: AcaoMembro, uid: string, nome = "") =>
  chamar<{ ok: true }>("/api/mesas/membros", { corpo: { mesaId, acao, uid, nome } });
