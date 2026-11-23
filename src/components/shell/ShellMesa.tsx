"use client";

import Link from "next/link";
import { Eye, Flame, Layers, Puzzle, Settings } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useExtensoesMesa, useNativasMesa } from "@/lib/extensoes/dados";
import { combinarEfeitos } from "@/lib/extensoes/efeitos";
import { encaixeDe, normalizarManifesto } from "@/lib/extensoes/manifesto";
import { usePedidosMestre } from "@/lib/extensoes/pedidos";
import { toast } from "../ui/Toasts";
import { useMesas } from "@/lib/mesas";
import ShellBase, { Carregando } from "./ShellBase";
import { itensNativos, gruposNav } from "./navegacao";

// Visão do mestre: exige ser o dono da mesa.
export { Carregando } from "./ShellBase";

export default function ShellMesa({ id, children }: { id: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const { mesas, pronto } = useMesas();
  const mesa = mesas.find((m) => m.id === id);
  const ehMestre = !!mesa && mesa.donoUid === user?.uid;
  const { extensoes: todasExt } = useExtensoesMesa(id, true, ehMestre);
  const nativas = useNativasMesa(id, ehMestre);
  // Desativadas (kill switch) não aparecem em lugar nenhum e não têm efeitos.
  const extensoes = todasExt.filter((e) => e.ativa !== false);
  const efeitos = combinarEfeitos(extensoes.map((e) => ({ id: e.id, titulo: e.titulo, efeitos: normalizarManifesto(e.manifesto).mesa })));
  const { pedidos, carregado: pedidosOk } = usePedidosMestre(id, ehMestre);
  const pendentes = pedidos.filter((p) => p.status === "pendente").length;
  // Avisa quando chega um pedido novo de jogador (a primeira leitura é só a base).
  const vistos = useRef<number | null>(null);
  useEffect(() => {
    if (!pedidosOk) return;
    if (vistos.current !== null && pendentes > vistos.current) toast("Um jogador fez um pedido por uma extensão. Veja em Extensões.", "info");
    vistos.current = pendentes;
  }, [pendentes, pedidosOk]);

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
  const { inicio, grupos } = gruposNav(
    base,
    [...itensNativos(id), ...extensoes.flatMap((e) => {
      const enc = encaixeDe(e.manifesto, "sidebar", "mestre");
      return enc ? [{ href: `${base}/extensoes/${e.id}`, rotulo: enc.rotulo || e.titulo, icone: Puzzle, ext: true }] : [];
    }), ...efeitos.recursos.map((r) => ({ href: `${base}/recursos/${r.extId}/${r.id}`, rotulo: r.plural, icone: Layers, ext: true }))],
  );
  return (
    <ShellBase
      mesa={mesa}
      modo="mestre"
      inicio={inicio}
      extensoes={extensoes}
      efeitos={efeitos}
      badges={pendentes ? { [`${base}/extensoes`]: pendentes } : {}}
      nativas={{ config: nativas.config, prontas: nativas.carregado, souMestre: true }}
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
