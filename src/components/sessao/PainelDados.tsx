"use client";

import { useState } from "react";
import { Dices, Trash2 } from "lucide-react";
import { expressaoD20, rolar, type Rolagem } from "@/lib/dados";
import { usePersistido } from "@/lib/persistido";

type Registro = Rolagem & { id: number; quem?: string };
const FACES = [4, 6, 8, 10, 12, 20, 100];
const MAX_HISTORICO = 30;

// Rolador compartilhado (tela do mestre e popover flutuante): o histórico é o mesmo por mesa.
export default function PainelDados({ mesaId, compacto = false }: { mesaId: string; compacto?: boolean }) {
  const [hist, setHist] = usePersistido<Registro[]>(`dados:${mesaId}`, []);
  const [expr, setExpr] = useState("");
  const [erro, setErro] = useState("");
  const [mod, setMod] = useState(0);
  const [giro, setGiro] = useState(0); // reinicia a animação do resultado a cada rolagem

  function fazer(e: string) {
    const r = rolar(e);
    if (!r) { setErro("Expressão inválida. Exemplos: d20, 2d6+3, 4d6kh3."); return; }
    setErro("");
    setGiro((g) => g + 1);
    setHist((h) => [{ ...r, id: Date.now() + Math.random() }, ...h].slice(0, MAX_HISTORICO));
  }

  const ultimo = hist[0];

  return (
    <div className="space-y-3">
      {/* Resultado em destaque */}
      <div
        key={giro}
        className={`anim-surgir flex min-h-24 flex-col items-center justify-center rounded-xl border bg-background p-3 text-center ${
          ultimo?.critico === "acerto" ? "border-gold shadow-[0_0_30px_-8px_var(--gold)]" : ultimo?.critico === "falha" ? "border-danger" : "border-border"
        }`}
      >
        {ultimo ? (
          <>
            <span className={`font-display text-5xl font-bold ${ultimo.critico === "acerto" ? "text-gold" : ultimo.critico === "falha" ? "text-danger" : ""}`}>{ultimo.total}</span>
            <span className="mt-1 text-xs text-muted">
              {ultimo.expressao}
              {ultimo.critico === "acerto" && " · crítico!"}
              {ultimo.critico === "falha" && " · falha crítica"}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted"><Dices size={18} /> Role um dado</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FACES.map((f) => (
          <button key={f} onClick={() => fazer(f === 20 ? expressaoD20(null, mod) : `d${f}`)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent-hover hover:bg-card-2">
            d{f}
          </button>
        ))}
      </div>

      {/* d20 com vantagem / desvantagem e modificador */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button onClick={() => fazer(expressaoD20("v", mod))} className="rounded-lg border border-ok/50 px-3 py-1.5 text-ok hover:bg-ok/10">Vantagem</button>
        <button onClick={() => fazer(expressaoD20("d", mod))} className="rounded-lg border border-danger/50 px-3 py-1.5 text-danger hover:bg-danger/10">Desvantagem</button>
        <label className="ml-auto flex items-center gap-1.5 text-muted">
          mod
          <input type="number" value={mod} onChange={(e) => setMod(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))} aria-label="Modificador do d20" className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center" />
        </label>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (expr.trim()) fazer(expr); }} className="flex gap-2">
        <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="2d6+3, 4d6kh3…" aria-label="Expressão de dados" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong">Rolar</button>
      </form>
      {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}

      {hist.length > 1 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-widest text-muted">
            Histórico
            <button onClick={() => setHist([])} className="inline-flex items-center gap-1 normal-case tracking-normal hover:text-foreground"><Trash2 size={12} /> limpar</button>
          </div>
          <ul className={`space-y-1 overflow-y-auto text-sm ${compacto ? "max-h-32" : "max-h-56"}`}>
            {hist.slice(1).map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 rounded-lg bg-card-2/60 px-3 py-1.5">
                <span className="truncate text-muted">
                  {r.expressao} <span className="text-xs">[{r.grupos.map((g) => g.dados.join(",")).join(" | ")}]</span>
                </span>
                <b className={r.critico === "acerto" ? "text-gold" : r.critico === "falha" ? "text-danger" : ""}>{r.total}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
