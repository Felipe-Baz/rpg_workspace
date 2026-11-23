"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { nativaAtiva, nativaVisivel } from "@/lib/extensoes/nativas";
import { useExtensoesContexto } from "../shell/ExtensoesContext";
import { ListaSkeleton } from "../ui/Skeleton";
import { registrarJogador, useMesaMarcas } from "@/lib/marcas";
import Titulo from "../telas/Titulo";
import MarcasFrame from "./MarcasFrame";
import PainelMestre from "./PainelMestre";
import VisaoJogadorMarca from "./VisaoJogadorMarca";

// Tela da extensão Marcas de Pacto. Vive DENTRO do workspace (sidebar, topbar e Ctrl+K da mesa);
// só o conteúdo usa o tema sombrio, isolado em MarcasFrame.
export default function MarcasApp({ mesaId }: { mesaId: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const nome = user?.displayName || user?.email || "Sem nome";
  const { pronto, existe, souMestre } = useMesaMarcas(mesaId, uid);
  const { nativas, nativasProntas, souMestre: mestreNoShell } = useExtensoesContexto();

  // Membro (não-mestre) se registra ao entrar, para o Mestre poder atribuir uma Marca.
  useEffect(() => {
    if (uid && pronto && existe && !souMestre) registrarJogador(mesaId, uid, nome).catch(() => {});
  }, [uid, pronto, existe, souMestre, mesaId, nome]);

  if (!nativaAtiva(mesaId, "marcas-de-pacto"))
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="font-display text-2xl">Extensão indisponível</h1>
        <p className="text-muted">As Marcas de Pacto pertencem a outra mesa.</p>
        <Link href="/mesas" className="inline-block rounded-lg border border-border px-4 py-2 hover:bg-card">Minhas mesas</Link>
      </div>
    );

  // O mestre pode ocultar a extensão dos jogadores (Extensões > Marcas de Pacto); por padrão eles a veem.
  if (!mestreNoShell && !nativasProntas) return <ListaSkeleton linhas={2} />;
  if (!nativaVisivel(mesaId, "marcas-de-pacto", mestreNoShell ? "mestre" : "jogador", nativas))
    return (
      <div className="mx-auto max-w-md space-y-3 py-10 text-center">
        <h1 className="font-display text-2xl">Indisponível no momento</h1>
        <p className="text-muted">O mestre ocultou as Marcas de Pacto dos jogadores por enquanto.</p>
      </div>
    );

  return (
    <>
      <Titulo titulo="Marcas de Pacto" texto={`O Juramento de Cinzas${souMestre ? " · você é o Mestre" : ""}`} />
      <MarcasFrame>
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
      </MarcasFrame>
    </>
  );
}
