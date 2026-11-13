"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AMBIENTE_PADRAO, AMBIENTES, type Particula } from "./ambientes";
import { definirSom, drone } from "./audio";

type Grao = { x: number; y: number; r: number; v: number; d: number; ch: string };

function Particulas({ cfg }: { cfg: Particula }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let w = 0;
    let h = 0;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const letras = "ABCDEFGHIJLMNOPRSTUVZ";
    const novo = (cheio: boolean): Grao => ({
      x: rnd(0, w),
      y: cheio ? rnd(0, h) : cfg.sobe ? h + 10 : -10,
      r: rnd(cfg.tam[0], cfg.tam[1]),
      v: rnd(cfg.vel[0], cfg.vel[1]),
      d: rnd(-0.3, 0.3),
      ch: letras[Math.floor(Math.random() * letras.length)],
    });
    let gr: Grao[] = [];
    const ajustar = () => {
      const r = cv.getBoundingClientRect();
      w = cv.width = Math.max(1, Math.floor(r.width));
      h = cv.height = Math.max(1, Math.floor(r.height));
      gr = Array.from({ length: cfg.qtd }, () => novo(true));
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(cv);
    let raf = 0;
    const quadro = () => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = cfg.cor;
      g.strokeStyle = cfg.cor;
      g.font = "14px serif";
      for (let i = 0; i < gr.length; i++) {
        const p = gr[i];
        p.y += cfg.sobe ? -p.v : p.v;
        p.x += p.d;
        g.globalAlpha = 0.25 + (p.r / cfg.tam[1]) * 0.45;
        if (cfg.forma === "ponto") {
          g.beginPath();
          g.arc(p.x, p.y, p.r, 0, 6.2832);
          g.fill();
        } else if (cfg.forma === "risco") {
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x + p.d * p.r, p.y + p.r * 2);
          g.stroke();
        } else {
          g.font = `${Math.round(p.r)}px serif`;
          g.fillText(p.ch, p.x, p.y);
        }
        if (p.y < -20 || p.y > h + 20) gr[i] = novo(false);
      }
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [cfg]);

  return <canvas ref={ref} className="cena-canvas" aria-hidden />;
}

/** Atmosfera da Marca em volta dos enigmas: partículas, efeito de tela e zumbido opcional. */
export default function Cena({ ambiente, children }: { ambiente?: string; children: ReactNode }) {
  const amb = (ambiente && AMBIENTES[ambiente]) || AMBIENTE_PADRAO;
  const [som, setSom] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    definirSom(som);
    if (!som) return;
    const parar = drone(amb.drone);
    return () => {
      parar();
      definirSom(false);
    };
  }, [som, amb.drone]);

  const seguir = (e: React.PointerEvent) => {
    if (amb.fx !== "treva" || !raiz.current) return;
    const r = raiz.current.getBoundingClientRect();
    raiz.current.style.setProperty("--lx", `${e.clientX - r.left}px`);
    raiz.current.style.setProperty("--ly", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={raiz}
      className={`cena fx-${amb.fx}`}
      style={{ ["--amb" as string]: amb.cor }}
      onPointerMove={seguir}
    >
      <Particulas cfg={amb.particula} />
      <div className="cena-vinheta" aria-hidden />
      <div className="cena-conteudo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl">Enigmas</h2>
          <button className="btn ghost" onClick={() => setSom((v) => !v)} aria-pressed={som}>
            {som ? "Som: ligado" : "Som: desligado"}
          </button>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}
