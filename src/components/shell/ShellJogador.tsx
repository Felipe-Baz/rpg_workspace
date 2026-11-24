"use client";

import Link from "next/link";
import { Layers, Puzzle, Swords } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useExtensoesMesa, useNativasMesa } from "@/lib/extensoes/dados";
import { useMeusPedidos } from "@/lib/extensoes/pedidos";
import { toast } from "../ui/Toasts";
import { useEffect, useRef } from "react";
import { combinarEfeitos } from "@/lib/extensoes/efeitos";
import { encaixeDe, normalizarManifesto } from "@/lib/extensoes/manifesto";
import { useMesas } from "@/lib/mesas";
import EscolherPersonagem from "../telas/EscolherPersonagem";
import ShellBase, { Carregando } from "./ShellBase";
import { ehDnd5e } from "@/lib/dnd5e";
import { itensNativos, gruposNavJogador } from "./navegacao";
import { useNovidades } from "./useNovidades";

// Visão do jogador: mesmo motor visual, navegação enxuta (só o que o mestre libera).
export default function ShellJogador({ id, children }: { id: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const { mesas, pronto } = useMesas();
  const mesa = mesas.find((m) => m.id === id);
  const base = `/mesas/${id}/jogador`;
  const { badges, avisos } = useNovidades(id, user?.uid ?? "", base);
  const { extensoes: todasExt } = useExtensoesMesa(id, false, !!mesa && !!user);
  const nativas = useNativasMesa(id, !!mesa && !!user);
  // Desativadas (kill switch) não aparecem em lugar nenhum e não têm efeitos.
  const extensoes = todasExt.filter((e) => e.ativa !== false);
  const efeitos = combinarEfeitos(extensoes.map((e) => ({ id: e.id, titulo: e.titulo, efeitos: normalizarManifesto(e.manifesto).mesa })));
  const meusPedidos = useMeusPedidos(id, user?.uid ?? "", !!mesa && !!user);
  // Avisa quando o mestre responde um pedido (a primeira leitura é só a base).
  const statusVistos = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!meusPedidos.carregado) return;
    const antes = statusVistos.current;
    if (antes) {
      for (const p of meusPedidos.pedidos) {
        if (antes.get(p.id) === "pendente" && p.status === "aprovado") toast(`O mestre aprovou seu pedido (${p.extTitulo}).`);
        if (antes.get(p.id) === "pendente" && p.status === "recusado") toast(p.motivo ? `Seu pedido (${p.extTitulo}) não pôde ser aprovado: ${p.motivo}` : `O mestre recusou seu pedido (${p.extTitulo}).`, "info");
      }
    }
    statusVistos.current = new Map(meusPedidos.pedidos.map((p) => [p.id, p.status]));
  }, [meusPedidos.pedidos, meusPedidos.carregado]);

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

  const { inicio, grupos } = gruposNavJogador(
    base,
    [...itensNativos(id, "jogador", nativas.config, souMestre), ...extensoes.flatMap((e) => {
      const enc = encaixeDe(e.manifesto, "sidebar", "jogador");
      return enc ? [{ href: `${base}/extensoes/${e.id}`, rotulo: enc.rotulo || e.titulo, icone: Puzzle, ext: true }] : [];
    }), ...efeitos.recursos.map((r) => ({ href: `${base}/recursos/${r.extId}/${r.id}`, rotulo: r.plural, icone: Layers, ext: true }))],
    ehDnd5e(mesa.sistema),
  );
  return (
    <ShellBase
      mesa={mesa}
      modo="jogador"
      inicio={inicio}
      extensoes={extensoes}
      efeitos={efeitos}
      nativas={{ config: nativas.config, prontas: nativas.carregado, souMestre }}
      grupos={grupos}
      badges={badges}
      avisos={avisos}
      rodape={souMestre ? [{ href: `/mesas/${mesa.id}`, rotulo: "Ver como mestre", icone: Swords, troca: true }] : []}
    >
      {children}
    </ShellBase>
  );
}
