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

/** POST a uma rota /api/ia/* que responde NDJSON; chama `aoEvento` a cada linha. Erros HTTP viram Error com a mensagem da rota. */
export async function streamIa<T = any>(caminho: string, corpo: unknown, aoEvento: (ev: T) => void, sinal?: AbortSignal): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Não autenticado.");
  const r = await fetch(`/api/ia/${caminho}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(corpo),
    signal: sinal,
  });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    throw Object.assign(new Error(j.erro ?? `Erro ${r.status}`), { status: r.status, dados: j });
  }
  const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (value) resto += value;
    const linhas = resto.split("\n");
    resto = done ? "" : linhas.pop()!;
    for (const l of linhas) if (l.trim()) aoEvento(JSON.parse(l) as T);
    if (done) break;
  }
}
