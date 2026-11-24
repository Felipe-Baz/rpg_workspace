"use client";

import { useExtensoesContexto } from "../shell/ExtensoesContext";

export const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** `termo`: chave da ferramenta; se uma extensão renomeou, mostra o nome dela. */
export default function Titulo({ titulo, texto, acao, termo }: { titulo: string; texto?: string; acao?: React.ReactNode; termo?: string }) {
  const { efeitos } = useExtensoesContexto();
  const nome = (termo && efeitos.termos[termo as never]) || titulo;
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="break-words font-display text-2xl font-bold tracking-wide sm:text-3xl">{nome}</h1>
        {texto && <p className="mt-1 text-sm text-muted">{texto}</p>}
      </div>
      {acao}
    </header>
  );
}
