"use client";

import Link from "next/link";
import { useEffect } from "react";
import DadoD20 from "./DadoD20";
import CacaCorvos from "./CacaCorvos";
import PaginaEstado, { estilosBotao } from "./PaginaEstado";

/** Conteúdo compartilhado dos error boundaries de rota. */
export default function ErroRota({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";

  return (
    <PaginaEstado
      codigo="Ops"
      titulo="Uma maldição travou esta tela"
      texto="Ocorreu um erro inesperado ao carregar. Tente de novo; se persistir, volte ao início."
      detalhe={digest ? `Código: ${digest}` : undefined}
      topo={<DadoD20 final={1} legenda="Clique para desafiar o destino" />}
      acoes={
        <>
          <button type="button" onClick={() => retry()} className={estilosBotao.primario}>Tentar novamente</button>
          <Link href="/mesas" className={estilosBotao.secundario}>Minhas mesas</Link>
        </>
      }
    >
      <CacaCorvos />
    </PaginaEstado>
  );
}
