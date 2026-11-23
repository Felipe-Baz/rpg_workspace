"use client";

import Link from "next/link";
import { useEffect } from "react";
import { sair, useAuth } from "@/lib/auth";
import { registrarJogador, useMesaMarcas } from "@/lib/marcas";
import PainelMestre from "./PainelMestre";
import VisaoJogadorMarca from "./VisaoJogadorMarca";

export default function MarcasApp({ mesaId }: { mesaId: string }) {
  const { user } = useAuth();
  const uid = user!.uid; // RequireAuth garante user
  const nome = user!.displayName || user!.email || "Sem nome";
  const { pronto, existe, souMestre } = useMesaMarcas(mesaId, uid);

  // Membro (não-mestre) se registra ao entrar, para o Mestre poder atribuir uma Marca.
  useEffect(() => {
    if (pronto && existe && !souMestre) registrarJogador(mesaId, uid, nome).catch(() => {});
  }, [pronto, existe, souMestre, mesaId, uid, nome]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--m-line)" }}>
        <div>
          <p className="tag">Marcas de Pacto</p>
          <h1 className="mt-2 text-3xl">O Juramento de Cinzas</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="dim">{nome}{souMestre ? " · Mestre" : ""}</span>
          <Link href="/mesas" className="btn ghost">Mesas</Link>
          <button className="btn ghost" onClick={() => sair()}>Sair</button>
        </div>
      </header>

      {!pronto ? (
        <p className="dim">Consultando os registros…</p>
      ) : !existe ? (
        <div className="panel mx-auto max-w-lg p-6 text-center">
          <h2 className="text-xl">Mesa não encontrada</h2>
          <p className="dim mt-2">Você precisa ser membro desta mesa. Entre pelo código de convite.</p>
        </div>
      ) : souMestre ? (
        <PainelMestre mesaId={mesaId} />
      ) : (
        <VisaoJogadorMarca mesaId={mesaId} uid={uid} />
      )}
    </main>
  );
}
