"use client";

import { useState } from "react";
import { Check, Inbox, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { validarAcoes, resumirAcoes } from "@/lib/extensoes/acoes";
import { concluirPedido, prepararPedido, recusarPedido, usePedidosMestre, type PedidoJogador } from "@/lib/extensoes/pedidos";
import { confirmar } from "../ui/Dialogos";
import { useMesaAtual } from "../shell/MesaContext";
import { toast } from "../ui/Toasts";

const quando = (t: number) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Pedidos que jogadores fizeram por extensões: o mestre revê o que seria criado e aprova ou recusa.
export default function PedidosPendentes() {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const { pedidos } = usePedidosMestre(mesa.id, true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const pendentes = pedidos.filter((p) => p.status === "pendente");
  const recentes = pedidos.filter((p) => p.status !== "pendente").slice(0, 5);
  if (pendentes.length === 0 && recentes.length === 0) return null;

  const nomes = Object.fromEntries(mesa.jogadores.map((j) => [j.id, j.personagem || j.nome || "jogador"]));
  const resumo = (p: PedidoJogador) => {
    const acoes = validarAcoes(p.acoes);
    return acoes ? resumirAcoes(acoes, nomes).split("\n\n")[0] : "Pedido com dados inválidos.";
  };

  async function agir(p: PedidoJogador, aprovar: boolean) {
    setOcupado(p.id);
    try {
      if (aprovar) {
        // O "antes → depois" é calculado agora, com os dados atuais (o item pode ter mudado desde o pedido).
        const prep = await prepararPedido(mesa, user!.uid, p);
        if (!prep) return;
        if (!(await confirmar({ titulo: `Pedido de ${p.nome} por “${p.extTitulo}”`, texto: prep.montado.resumo, confirmar: "Aprovar" }))) return;
        await concluirPedido(mesa.id, p, prep);
        toast("Pedido aprovado. Dá para desfazer na tela da extensão.");
      } else {
        await recusarPedido(mesa.id, p.id);
        toast("Pedido recusado");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="space-y-3" aria-label="Pedidos dos jogadores">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        <Inbox size={14} /> Pedidos dos jogadores {pendentes.length > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-white">{pendentes.length}</span>}
      </h2>
      <ul className="space-y-2">
        {pendentes.map((p) => (
          <li key={p.id} className="rounded-xl border border-accent/50 bg-accent/5 p-4">
            <p className="text-sm"><b>{p.nome}</b> pediu, por <span className="text-ext">{p.extTitulo}</span> · <span className="text-muted">{quando(p.criadoEm)}</span></p>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">{resumo(p)}</p>
            <div className="mt-3 flex gap-2">
              <button disabled={ocupado === p.id} onClick={() => agir(p, true)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50"><Check size={14} /> Revisar e aprovar</button>
              <button disabled={ocupado === p.id} onClick={() => agir(p, false)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-danger hover:text-danger disabled:opacity-50"><X size={14} /> Recusar</button>
            </div>
          </li>
        ))}
        {recentes.length > 0 && (
          <li className="px-1 text-xs text-muted">
            Recentes: {recentes.map((p) => `${p.nome} (${p.status === "aprovado" ? "aprovado" : p.motivo ? "recusado: não vale mais" : "recusado"})`).join(" · ")}
          </li>
        )}
      </ul>
    </section>
  );
}
