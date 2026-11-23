"use client";

import { useState } from "react";
import { History, Undo2 } from "lucide-react";
import { desfazerLote, useLotes, type Lote } from "@/lib/extensoes/escrita";
import { confirmar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";

const quando = (t: number) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// "O que esta extensão criou": cada lote pode ser desfeito inteiro (apaga os itens criados, mesmo que editados depois).
export default function HistoricoExtensao({ mesaId, extId }: { mesaId: string; extId: string }) {
  const { lotes } = useLotes(mesaId, extId, true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  if (lotes.length === 0) return null;

  async function desfazer(l: Lote) {
    const ok = await confirmar({
      perigo: true,
      titulo: "Desfazer lote",
      texto: `Vai apagar o que esta extensão criou em ${quando(l.criadoEm)}:\n${l.itens.map((i) => `• ${i.tipo === "ficha" ? "Ficha" : "Missão"}: ${i.nome}`).join("\n")}\n\nAlterações que você fez nesses itens também serão perdidas.`,
      confirmar: "Desfazer",
    });
    if (!ok) return;
    setOcupado(l.id);
    try {
      await desfazerLote(mesaId, l);
      toast("Lote desfeito");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível desfazer.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <details className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-muted"><History size={14} /> O que esta extensão criou ({lotes.length})</summary>
      <ul className="mt-3 space-y-2">
        {lotes.map((l) => (
          <li key={l.id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 ${l.desfeitoEm ? "opacity-60" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">{quando(l.criadoEm)}{l.desfeitoEm ? " · desfeito" : ""}</span>
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
