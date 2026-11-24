"use client";

import Link from "next/link";
import { Layers, Puzzle, Swords } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useExtensoesMesa, useNativasMesa } from "@/lib/extensoes/dados";
import { useMeusPedidos } from "@/lib/extensoes/pedidos";
import { toast } from "../ui/Toasts";
import { useEffect, useRef, useState } from "react";
import { VisaoJogadorProvider } from "./VisaoJogadorContext";
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
  const chaveVisao = `rpg:visao-jogador:${id}`;
  // A mesa só renderiza depois de carregar no cliente, então ler o storage aqui não diverge do servidor.
  const [como, setComoEstado] = useState(() => {
    try { return typeof window === "undefined" ? "" : sessionStorage.getItem(chaveVisao) ?? ""; } catch { return ""; }
  });
  function definirComo(uid: string) {
    setComoEstado(uid);
    try { if (uid) sessionStorage.setItem(chaveVisao, uid); else sessionStorage.removeItem(chaveVisao); } catch { /* sem storage */ }
  }
  const souDono = !!mesa && !!user && mesa.donoUid === user.uid;
  // Só o mestre pode ver como outro membro; para os demais o parâmetro é ignorado.
  const jogadorVisto = souDono ? mesa?.jogadores.find((j) => j.uid && j.uid === como) : undefined;
  const uidVisto = jogadorVisto?.uid ?? user?.uid ?? "";
  const { badges, avisos } = useNovidades(id, uidVisto, base);
  const { extensoes: todasExt } = useExtensoesMesa(id, false, !!mesa && !!user);
  const nativas = useNativasMesa(id, !!mesa && !!user);
  // Desativadas (kill switch) não aparecem em lugar nenhum e não têm efeitos.
  const extensoes = todasExt.filter((e) => e.ativa !== false);
  const efeitos = combinarEfeitos(extensoes.map((e) => ({ id: e.id, titulo: e.titulo, efeitos: normalizarManifesto(e.manifesto).mesa })));
  const meusPedidos = useMeusPedidos(id, uidVisto, !!mesa && !!user);
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
      <VisaoJogadorProvider value={{ uid: uidVisto, vendoComo: !!jogadorVisto }}>
        {souMestre && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card-2 px-3 py-2 text-sm">
            <label htmlFor="ver-como" className="text-muted">Ver como</label>
            <select
              id="ver-como"
              value={jogadorVisto?.uid ?? ""}
              onChange={(e) => definirComo(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1"
            >
              <option value="">Eu (mestre)</option>
              {mesa.jogadores.filter((j) => j.uid && j.uid !== user.uid).map((j) => (
                <option key={j.id} value={j.uid}>{j.personagem || j.nome}</option>
              ))}
            </select>
            {jogadorVisto && <span className="text-muted">Somente leitura: o que você vê é o que este jogador vê, incluindo as anotações dele.</span>}
          </div>
        )}
        {children}
      </VisaoJogadorProvider>
    </ShellBase>
  );
}
