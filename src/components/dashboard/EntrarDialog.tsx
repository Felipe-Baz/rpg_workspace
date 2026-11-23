"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { entrarPorCodigo } from "@/lib/mesas";
import Dialog from "../ui/Dialog";

export default function EntrarDialog({ uid, onClose }: { uid: string; onClose: () => void }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codigo = String(new FormData(e.currentTarget).get("codigo"));
    setErro("");
    setOcupado(true);
    try {
      const mesaId = await entrarPorCodigo(codigo, uid);
      onClose();
      // Convite aceito: cai direto na visão do jogador daquela mesa.
      router.push(`/mesas/${mesaId}/jogador`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar na mesa.");
      setOcupado(false);
    }
  }

  return (
    <Dialog titulo="Entrar em uma mesa" onClose={onClose} largura="max-w-sm">
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-sm">
          Código de convite
          <input
            name="codigo"
            required
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD2345"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-3 text-center font-mono text-lg uppercase tracking-[0.3em] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancelar</button>
          <button disabled={ocupado} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60">
            {ocupado ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
