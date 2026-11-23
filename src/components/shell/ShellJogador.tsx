"use client";

import Link from "next/link";
import { Swords } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMesas } from "@/lib/mesas";
import EscolherPersonagem from "../telas/EscolherPersonagem";
import ShellBase, { Carregando } from "./ShellBase";
import { gruposNavJogador } from "./navegacao";
import { useNovidades } from "./useNovidades";

// Visão do jogador: mesmo motor visual, navegação enxuta (só o que o mestre libera).
export default function ShellJogador({ id, children }: { id: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const { mesas, pronto } = useMesas();
  const mesa = mesas.find((m) => m.id === id);
  const base = `/mesas/${id}/jogador`;
  const { badges, avisos } = useNovidades(id, user?.uid ?? "", base);

  if (!pronto) return <Carregando />;
  if (!mesa || !user)
    return (
      <main className="mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="font-display text-2xl">Mesa não encontrada</h1>
        <Link href="/mesas" className="inline-block rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">Minhas mesas</Link>
      </main>
    );

  const souMestre = mesa.donoUid === user.uid;
  if (!souMestre && !mesa.jogadores.some((j) => j.uid === user.uid))
    return <EscolherPersonagem mesa={mesa} uid={user.uid} nomeConta={user.displayName || user.email || ""} />;

  const { inicio, grupos } = gruposNavJogador(base);
  return (
    <ShellBase
      mesa={mesa}
      modo="jogador"
      inicio={inicio}
      grupos={grupos}
      badges={badges}
      avisos={avisos}
      rodape={souMestre ? [{ href: `/mesas/${mesa.id}`, rotulo: "Ver como mestre", icone: Swords, troca: true }] : []}
    >
      {children}
    </ShellBase>
  );
}
