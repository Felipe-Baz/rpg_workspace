"use client";

import { useCallback, useEffect, useState } from "react";
import Dialog from "./Dialog";

// Substitui window.confirm / window.prompt por diálogos do app, em forma de Promise:
//   import { confirmar, perguntar } from "@/components/ui/Dialogos";
//   if (!(await confirmar({ titulo, texto, confirmar: "Excluir", perigo: true }))) return;
//   const nome = await perguntar({ titulo: "Nova categoria", rotulo: "Nome" });   // null = cancelou
type OpcoesConfirmar = { titulo?: string; texto: string; confirmar?: string; perigo?: boolean };
type OpcoesPerguntar = { titulo: string; rotulo?: string; inicial?: string; confirmar?: string };
type Aberto =
  | { tipo: "confirmar"; op: OpcoesConfirmar; fim: (v: boolean) => void }
  | { tipo: "perguntar"; op: OpcoesPerguntar; fim: (v: string | null) => void };

let abrir: ((a: Aberto) => void) | null = null;

export const confirmar = (op: OpcoesConfirmar): Promise<boolean> =>
  abrir ? new Promise((res) => abrir!({ tipo: "confirmar", op, fim: res })) : Promise.resolve(window.confirm(op.texto));

export const perguntar = (op: OpcoesPerguntar): Promise<string | null> =>
  abrir ? new Promise((res) => abrir!({ tipo: "perguntar", op, fim: res })) : Promise.resolve(window.prompt(op.titulo, op.inicial)?.trim() || null);

export function DialogosProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  useEffect(() => {
    abrir = setAberto;
    return () => { abrir = null; };
  }, []);

  const fechar = useCallback(<T,>(fim: (v: T) => void, v: T) => { setAberto(null); fim(v); }, []);

  return (
    <>
      {children}
      {aberto?.tipo === "confirmar" && (
        <div className="relative z-[100]">
          <Dialog titulo={aberto.op.titulo ?? "Confirmar"} onClose={() => fechar(aberto.fim, false)} largura="max-w-sm">
            <p className="mb-6 text-sm text-muted">{aberto.op.texto}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => fechar(aberto.fim, false)} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancelar</button>
              <button
                data-foco
                onClick={() => fechar(aberto.fim, true)}
                className={`rounded-lg px-4 py-2 font-medium text-white ${aberto.op.perigo ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-strong"}`}
              >
                {aberto.op.confirmar ?? "Confirmar"}
              </button>
            </div>
          </Dialog>
        </div>
      )}
      {aberto?.tipo === "perguntar" && (
        <div className="relative z-[100]">
          <Dialog titulo={aberto.op.titulo} onClose={() => fechar(aberto.fim, null)} largura="max-w-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get("valor") ?? "").trim();
                fechar(aberto.fim, v || null);
              }}
              className="space-y-4"
            >
              <label className="block text-sm">
                {aberto.op.rotulo ?? "Nome"}
                <input
                  name="valor"
                  defaultValue={aberto.op.inicial}
                  required
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => fechar(aberto.fim, null)} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancelar</button>
                <button className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">{aberto.op.confirmar ?? "OK"}</button>
              </div>
            </form>
          </Dialog>
        </div>
      )}
    </>
  );
}
