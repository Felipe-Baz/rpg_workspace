"use client";

import { useState } from "react";

function Bomba(): never {
  throw new Error("Erro de teste (cliente)");
}

export default function BotaoQuebrar() {
  const [explodir, setExplodir] = useState(false);
  if (explodir) return <Bomba />;
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-4 py-12 text-center">
      <p className="text-sm text-muted">Clique para lançar um erro durante a renderização.</p>
      <button type="button" onClick={() => setExplodir(true)} className="mt-4 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white">
        Quebrar esta tela
      </button>
    </main>
  );
}
