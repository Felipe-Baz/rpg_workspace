"use client";

import { useState } from "react";
import { Dices, Volume2, VolumeX } from "lucide-react";
import { expressaoD20, type Rolagem } from "@/lib/dados";
import { definirSom, somAtivo } from "@/lib/som-dados";
import { useRolagem } from "../dados/RolagemProvider";

const FACES = [4, 6, 8, 10, 12, 20, 100];

// Rolador do site: os dados 3D caem na tela de todos que estão com a mesa aberta. O histórico é o da mesa inteira.
export default function PainelDados({ compacto = false }: { mesaId?: string; compacto?: boolean }) {
  const { rolar, historico, rolando } = useRolagem();
  const [expr, setExpr] = useState("");
  const [erro, setErro] = useState("");
  const [mod, setMod] = useState(0);
  const [giro, setGiro] = useState(0); // reinicia a animação do resultado a cada rolagem
  const [ultimo, setUltimo] = useState<Rolagem | null>(null);
  const [som, setSom] = useState(somAtivo);

  async function fazer(e: string) {
    if (rolando) return;
    const r = await rolar(e);
    if (!r) { setErro("Expressão inválida. Exemplos: d20, 2d6+3, 4d6kh3, 1d120."); return; }
    setErro("");
    setGiro((g) => g + 1);
    setUltimo(r);
  }

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
            <span className={`anim-dado font-display text-5xl font-bold ${ultimo.critico === "acerto" ? "text-gold" : ultimo.critico === "falha" ? "text-danger" : ""}`}>{ultimo.total}</span>
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
          <button key={f} disabled={rolando} onClick={() => fazer(f === 20 ? expressaoD20(null, mod) : `d${f}`)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent-hover hover:bg-card-2 disabled:opacity-50">
            d{f}
          </button>
        ))}
      </div>

      {/* d20 com vantagem / desvantagem e modificador */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button disabled={rolando} onClick={() => fazer(expressaoD20("v", mod))} className="rounded-lg border border-ok/50 px-3 py-1.5 text-ok hover:bg-ok/10 disabled:opacity-50">Vantagem</button>
        <button disabled={rolando} onClick={() => fazer(expressaoD20("d", mod))} className="rounded-lg border border-danger/50 px-3 py-1.5 text-danger hover:bg-danger/10 disabled:opacity-50">Desvantagem</button>
        <label className="ml-auto flex items-center gap-1.5 text-muted">
          mod
          <input type="number" value={mod} onChange={(e) => setMod(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))} aria-label="Modificador do d20" className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center" />
        </label>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (expr.trim()) fazer(expr); }} className="flex gap-2">
        <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="2d6+3, 4d6kh3, 1d120…" aria-label="Expressão de dados" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={rolando} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60">Rolar</button>
        <button type="button" onClick={() => { definirSom(!som); setSom(!som); }} aria-pressed={som} aria-label={som ? "Silenciar o som dos dados" : "Ligar o som dos dados"} title={som ? "Som ligado" : "Som desligado"} className="rounded-lg border border-border px-2.5 text-muted hover:text-foreground">
          {som ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </form>
      {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}

      {historico.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-widest text-muted">Histórico da mesa</p>
          <ul className={`space-y-1 overflow-y-auto text-sm ${compacto ? "max-h-32" : "max-h-56"}`}>
            {historico.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 rounded-lg bg-card-2/60 px-3 py-1.5">
                <span className="truncate text-muted">
                  <span className="text-foreground">{h.nome}</span> · {h.rolagem.expressao} <span className="text-xs">[{h.rolagem.grupos.map((g) => g.dados.join(",")).join(" | ")}]</span>
                </span>
                <b className={h.rolagem.critico === "acerto" ? "text-gold" : h.rolagem.critico === "falha" ? "text-danger" : ""}>{h.rolagem.total}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
