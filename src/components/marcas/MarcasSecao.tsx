"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { registrarJogador, useMesaMarcas } from "@/lib/marcas";
import MarcasFrame from "./MarcasFrame";
import VisaoJogadorMarca from "./VisaoJogadorMarca";

/** Seção de Marcas de Pacto embutida na visão do jogador (tema escuro isolado em `.marcas`). */
export default function MarcasSecao({ mesaId }: { mesaId: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const nome = user?.displayName || user?.email || "Sem nome";
  const { pronto, existe, souMestre } = useMesaMarcas(mesaId, uid);

  useEffect(() => {
    if (uid && pronto && existe && !souMestre) registrarJogador(mesaId, uid, nome).catch(() => {});
  }, [uid, pronto, existe, souMestre, mesaId, nome]);

  if (!user) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Marcas de Pacto</h2>
      <MarcasFrame>
        {!pronto ? (
          <p className="dim">Consultando os registros…</p>
        ) : !existe ? (
          <p className="dim">Esta mesa não usa Marcas de Pacto.</p>
        ) : souMestre ? (
          <p className="dim">
            Você é o Mestre. Gerencie as Marcas em{" "}
            <a href={`/mesas/${mesaId}/marcas`} className="gold underline">Marcas de Pacto</a>.
          </p>
        ) : (
          <VisaoJogadorMarca mesaId={mesaId} uid={uid} />
        )}
      </MarcasFrame>
    </section>
  );
}
