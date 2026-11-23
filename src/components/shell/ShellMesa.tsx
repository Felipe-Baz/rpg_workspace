"use client";

import Link from "next/link";
import { Eye, Flame, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMesas } from "@/lib/mesas";
import ShellBase, { Carregando } from "./ShellBase";
import { gruposNav } from "./navegacao";

// Visão do mestre: exige ser o dono da mesa.
export { Carregando } from "./ShellBase";

export default function ShellMesa({ id, children }: { id: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const { mesas, pronto } = useMesas();
  const mesa = mesas.find((m) => m.id === id);

  if (!pronto) return <Carregando />;
  if (!mesa || mesa.donoUid !== user?.uid)
    return (
      <main className="mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="font-display text-2xl">Mesa indisponível</h1>
        <p className="text-muted">Ela não existe ou você não é o mestre dela.</p>
        <div className="flex justify-center gap-3 text-sm">
          <Link href="/mesas" className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">Minhas mesas</Link>
          {mesa && <Link href={`/mesas/${mesa.id}/jogador`} className="rounded-lg border border-border px-4 py-2 hover:bg-border/50">Abrir como jogador</Link>}
        </div>
      </main>
    );

  const base = `/mesas/${mesa.id}`;
  const { inicio, grupos } = gruposNav(base);
  return (
    <ShellBase
      mesa={mesa}
      modo="mestre"
      inicio={inicio}
      destaque={{ href: `${base}/sessao`, rotulo: "Iniciar sessão", icone: Flame }}
      grupos={grupos}
      rodape={[
        { href: `${base}/configuracoes`, rotulo: "Configurações", icone: Settings },
        { href: `${base}/jogador`, rotulo: "Ver como jogador", icone: Eye, troca: true },
      ]}
    >
      {children}
    </ShellBase>
  );
}
