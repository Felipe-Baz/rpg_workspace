"use client";

import { useState, useSyncExternalStore } from "react";
import CacaCorvos from "./CacaCorvos";

function assinar(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Aviso de "sem conexão" com minijogo para passar o tempo até a internet voltar. */
export default function OfflineAviso({ forcar = false }: { forcar?: boolean } = {}) {
  const online = useSyncExternalStore(assinar, () => navigator.onLine, () => true);
  const [jogando, setJogando] = useState(false);

  if (online && !forcar) return null;

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-3 z-[150] mx-auto w-auto max-w-xl rounded-xl border border-warn/50 bg-card p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:mx-0">
      <div className="flex items-center justify-between gap-3">
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground">Sem conexão com a internet</p>
          <p className="text-xs text-muted">O que você alterar pode não ser salvo. Reconectamos sozinhos.</p>
        </div>
        <button
          type="button"
          onClick={() => setJogando((v) => !v)}
          className="shrink-0 rounded-lg border border-border bg-card-2 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-border"
        >
          {jogando ? "Fechar jogo" : "Jogar"}
        </button>
      </div>
      {jogando && (
        <div className="mt-3">
          <CacaCorvos />
        </div>
      )}
    </div>
  );
}
