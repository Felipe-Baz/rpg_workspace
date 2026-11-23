"use client";

import { toast } from "../ui/Toasts";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { CORES, STATUS_LABEL, atualizarMesa, type Status } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo, { campo } from "./Titulo";

export default function TelaConfiguracoes() {
  const mesa = useMesaAtual();
  const [copiado, setCopiado] = useState(false);
  const set = (patch: Parameters<typeof atualizarMesa>[1]) => atualizarMesa(mesa.id, patch);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mesa.codigo);
      setCopiado(true);
      toast("Código de convite copiado");
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  }

  return (
    <>
      <Titulo titulo="Configurações da mesa" texto="As alterações são salvas automaticamente." />
      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <label className="block text-sm">
          Nome
          <input value={mesa.nome} onChange={(e) => set({ nome: e.target.value })} className={campo} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Sistema
            <input value={mesa.sistema} onChange={(e) => set({ sistema: e.target.value })} placeholder="D&D 5e, Tormenta20…" className={campo} />
          </label>
          <label className="block text-sm">
            Status
            <select value={mesa.status} onChange={(e) => set({ status: e.target.value as Status })} className={campo}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Descrição (visível aos jogadores)
          <textarea value={mesa.descricao} onChange={(e) => set({ descricao: e.target.value })} rows={3} className={campo} />
        </label>
        <div>
          <p className="mb-2 text-sm">Cor da mesa</p>
          <div className="flex gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => set({ cor: c })}
                aria-label={`Cor ${c}`}
                className="h-7 w-7 rounded-full"
                style={{ background: c, outline: c === mesa.cor ? "2px solid currentColor" : "none", outlineOffset: 2 }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <p className="font-semibold">Código de convite</p>
          <p className="text-sm text-muted">Quem tiver o código entra na mesa como jogador.</p>
        </div>
        <button
          onClick={copiar}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-mono font-semibold tracking-widest hover:border-accent-hover"
        >
          {mesa.codigo} {copiado ? <Check size={16} className="text-ok" /> : <Copy size={16} className="text-muted" />}
        </button>
      </div>
    </>
  );
}
