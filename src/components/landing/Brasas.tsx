"use client";

import { useEffect, useRef } from "react";

type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; fase: number; ouro: boolean };

// Brasas e poeira arcana subindo. Pausa com a aba oculta e fica estática com prefers-reduced-motion.
export default function Brasas({ quantidade = 60 }: { quantidade?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cor = (n: string, f: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    let w = 0, h = 0, raf = 0, ps: P[] = [];

    const nova = (y?: number): P => ({
      x: Math.random() * w,
      y: y ?? h + 10,
      r: Math.random() * 2 + 0.6,
      vy: Math.random() * 0.5 + 0.15,
      vx: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.6 + 0.25,
      fase: Math.random() * Math.PI * 2,
      ouro: Math.random() < 0.45,
    });

    function medir() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth; h = canvas!.clientHeight;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ps = Array.from({ length: quantidade }, () => nova(Math.random() * h));
    }

    function quadro(t: number) {
      ctx!.clearRect(0, 0, w, h);
      const ouro = cor("--gold", "#c9a45c"), acento = cor("--accent-hover", "#8b5cf6");
      for (const p of ps) {
        if (!reduzido) {
          p.y -= p.vy; p.x += p.vx + Math.sin(t / 1400 + p.fase) * 0.2;
          if (p.y < -10) Object.assign(p, nova());
        }
        const brilho = p.a * (0.6 + 0.4 * Math.sin(t / 700 + p.fase));
        ctx!.globalAlpha = Math.max(0, brilho);
        ctx!.fillStyle = p.ouro ? ouro : acento;
        ctx!.shadowBlur = 12; ctx!.shadowColor = ctx!.fillStyle as string;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fill();
      }
      if (!reduzido) raf = requestAnimationFrame(quadro);
    }

    const visib = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduzido) raf = requestAnimationFrame(quadro); };
    medir(); raf = requestAnimationFrame(quadro);
    window.addEventListener("resize", medir);
    document.addEventListener("visibilitychange", visib);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", medir); document.removeEventListener("visibilitychange", visib); };
  }, [quantidade]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
