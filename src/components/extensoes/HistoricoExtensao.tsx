"use client";

import { useState } from "react";
import { History, Undo2 } from "lucide-react";
import { desfazerLote, useLotes, type Lote } from "@/lib/extensoes/escrita";
import type { ItemLote } from "@/lib/extensoes/lote";
import { confirmar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";

const quando = (t: number) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const rotulo = (i: ItemLote) => `${i.tipo === "ficha" ? "Ficha" : "Missão"}: ${i.nome}`;
const porOp = (l: Lote, op: "criar" | "alterar" | "excluir") => l.itens.filter((i) => (i.op ?? "criar") === op);

/** "2 fichas criadas · 1 missão alterada" */
function contagem(l: Lote): string {
  const partes: string[] = [];
  for (const [op, verbo] of [["criar", "criada"], ["alterar", "alterada"], ["excluir", "excluída"]] as const) {
    const itens = porOp(l, op);
    const f = itens.filter((i) => i.tipo === "ficha").length, m = itens.length - f;
    if (f) partes.push(`${f} ficha${f > 1 ? "s" : ""} ${verbo}${f > 1 ? "s" : ""}`);
    if (m) partes.push(`${m} ${m > 1 ? "missões" : "missão"} ${verbo}${m > 1 ? "s" : ""}`);
  }
  return partes.join(" · ");
}

// "O que esta extensão fez": cada lote pode ser desfeito inteiro (apaga o que criou, restaura o que alterou e recria o que excluiu).
export default function HistoricoExtensao({ mesaId, extId }: { mesaId: string; extId: string }) {
  const { lotes } = useLotes(mesaId, extId, true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  if (lotes.length === 0) return null;

  async function desfazer(l: Lote) {
    const blocos = [
      porOp(l, "criar").length ? `Apaga o que foi criado:\n${porOp(l, "criar").map((i) => `• ${rotulo(i)}`).join("\n")}` : "",
      porOp(l, "alterar").length ? `Volta à versão anterior:\n${porOp(l, "alterar").map((i) => `• ${rotulo(i)}`).join("\n")}` : "",
      porOp(l, "excluir").length ? `Recria o que foi apagado:\n${porOp(l, "excluir").map((i) => `• ${rotulo(i)}`).join("\n")}` : "",
    ].filter(Boolean);
    const ok = await confirmar({
      perigo: true,
      titulo: "Desfazer lote",
      texto: `Desfaz o que esta extensão fez em ${quando(l.criadoEm)}.\n\n${blocos.join("\n\n")}${porOp(l, "criar").length ? "\n\nAlterações que você fez nos itens criados também serão perdidas." : ""}`,
      confirmar: "Desfazer",
    });
    if (!ok) return;
    setOcupado(l.id);
    try {
      const feito = await desfazerLote(mesaId, l, (nomes) =>
        confirmar({
          perigo: true,
          titulo: "Itens mudados depois",
          texto: `Estes itens foram mudados depois deste lote. Desfazer volta cada um à versão de antes do lote e PERDE essas mudanças:\n${nomes.map((n) => `• ${n}`).join("\n")}`,
          confirmar: "Desfazer mesmo assim",
        }),
      );
      if (feito) toast("Lote desfeito");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível desfazer.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <details className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-muted"><History size={14} /> O que esta extensão fez ({lotes.length})</summary>
      <ul className="mt-3 space-y-2">
        {lotes.map((l) => (
          <li key={l.id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 ${l.desfeitoEm ? "opacity-60" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">{quando(l.criadoEm)} · {contagem(l)}{l.desfeitoEm ? " · desfeito" : ""}</span>
              <span className="block truncate">{l.itens.map((i) => i.nome).join(", ")}</span>
            </span>
            {!l.desfeitoEm && (
              <button disabled={ocupado === l.id} onClick={() => desfazer(l)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 hover:border-danger hover:text-danger disabled:opacity-50">
                <Undo2 size={14} /> Desfazer
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
