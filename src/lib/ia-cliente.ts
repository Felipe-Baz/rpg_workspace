/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de APIs externas */
"use client";

import { auth } from "./firebase";

/** Chama as rotas /api/ia/* com o ID token do usuário. As rotas nunca devolvem chaves. */
export async function chamarIa<T = any>(caminho: string, init: { method?: string; corpo?: unknown } = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Não autenticado.");
  const r = await fetch(`/api/ia/${caminho}`, {
    method: init.method ?? (init.corpo ? "POST" : "GET"),
    headers: { authorization: `Bearer ${token}`, ...(init.corpo ? { "content-type": "application/json" } : {}) },
    body: init.corpo ? JSON.stringify(init.corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.erro ?? `Erro ${r.status}`), { status: r.status, dados: j });
  return j as T;
}
