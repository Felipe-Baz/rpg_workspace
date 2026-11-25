"use client";

import { useEffect, useRef, useState } from "react";

/** D20 clicável: gira sorteando números e sempre "teima" em voltar ao valor final. */
export default function DadoD20({ final = 1, legenda }: { final?: number; legenda?: string }) {
  const [n, setN] = useState(final);
  const [girando, setGirando] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function rolar() {
    if (girando) return;
    setGirando(true);
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      setN(1 + Math.floor(Math.random() * 20));
      if (i >= 12) {
        if (timer.current) clearInterval(timer.current);
        setN(final);
        setGirando(false);
      }
    }, 70);
  }

  return (
    <button type="button" onClick={rolar} aria-label={`Rolar d20${legenda ? `: ${legenda}` : ""}`} className="group mx-auto block">
      <svg
        viewBox="0 0 100 100"
        width="112"
        height="112"
        style={{ animation: girando ? "dado-girar 0.8s linear infinite" : "dado-flutuar 4s ease-in-out infinite" }}
        className="drop-shadow-[0_0_14px_rgba(124,58,237,0.5)]"
      >
        <polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill="var(--card-2)" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
        <polygon points="50,18 78,64 22,64" fill="none" stroke="var(--accent-soft)" strokeWidth="1.5" opacity="0.6" />
        <path d="M50 4 L50 18 M92 28 L78 64 M8 28 L22 64 M92 72 L78 64 M8 72 L22 64 M50 96 L50 64" stroke="var(--accent-soft)" strokeWidth="1.5" opacity="0.4" />
        <text x="50" y="56" textAnchor="middle" fontSize="24" fontWeight="700" fill={n === final && !girando ? "var(--gold)" : "var(--foreground)"} style={{ fontFamily: "var(--font-cinzel), serif" }}>
          {n}
        </text>
      </svg>
      {legenda && <span className="mt-1 block text-xs text-muted group-hover:text-foreground">{legenda}</span>}
    </button>
  );
}
