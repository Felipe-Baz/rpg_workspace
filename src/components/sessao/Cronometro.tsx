"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { segundosDaSessao, useSessaoAtiva } from "@/lib/sessaoAtiva";

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};

// Duração da sessão. Vive na sessão ativa da mesa (sobrevive à navegação) e conta pelo relógio, não por ticks.
export default function Cronometro({ mesaId }: { mesaId: string }) {
  const { sessao, alternar, zerar } = useSessaoAtiva(mesaId);
  const [agora, setAgora] = useState(() => Date.now());
  const rodando = !!sessao?.rodando;

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, [rodando]);

  const seg = sessao ? segundosDaSessao(sessao, Math.max(agora, sessao.inicioTrecho)) : 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`font-display text-4xl tabular-nums ${rodando ? "text-accent-soft" : ""}`}>{fmt(seg)}</span>
      <div className="flex gap-2">
        <button onClick={alternar} aria-label={rodando ? "Pausar" : "Iniciar"} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-strong">
          {rodando ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={zerar} aria-label="Zerar" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:text-foreground">
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
