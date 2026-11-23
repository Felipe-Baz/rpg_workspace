"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};

// Duração da sessão. Conta pelo relógio (não por ticks), então não deriva se a aba ficar em segundo plano.
export default function Cronometro() {
  const [seg, setSeg] = useState(0);
  const [rodando, setRodando] = useState(false);
  const base = useRef({ inicio: 0, acumulado: 0 });

  useEffect(() => {
    if (!rodando) return;
    base.current.inicio = Date.now();
    const id = setInterval(() => setSeg(base.current.acumulado + Math.floor((Date.now() - base.current.inicio) / 1000)), 500);
    return () => {
      clearInterval(id);
      base.current.acumulado += Math.floor((Date.now() - base.current.inicio) / 1000);
    };
  }, [rodando]);

  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`font-display text-4xl tabular-nums ${rodando ? "text-accent-soft" : ""}`}>{fmt(seg)}</span>
      <div className="flex gap-2">
        <button onClick={() => setRodando((r) => !r)} aria-label={rodando ? "Pausar" : "Iniciar"} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-strong">
          {rodando ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => { setRodando(false); base.current = { inicio: 0, acumulado: 0 }; setSeg(0); }} aria-label="Zerar" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:text-foreground">
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
