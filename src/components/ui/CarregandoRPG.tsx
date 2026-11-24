"use client";

import { useEffect, useRef, useState } from "react";

// Poliedros clássicos que se alternam a cada giro.
const DADOS = [
  { nome: "d4", lados: 4, pontos: "50,8 93,86 7,86", y: 64 },
  { nome: "d6", lados: 6, pontos: "16,16 84,16 84,84 16,84", y: 58 },
  { nome: "d8", lados: 8, pontos: "50,4 92,50 50,96 8,50", y: 57 },
  { nome: "d10", lados: 10, pontos: "50,4 90,40 50,96 10,40", y: 55 },
  { nome: "d12", lados: 12, pontos: "50,5 94,37 77,90 23,90 6,37", y: 59 },
  { nome: "d20", lados: 20, pontos: "50,4 92,28 92,72 50,96 8,72 8,28", y: 57 },
];

// Frases de vários cenários (fantasia, ficção científica, terror, investigação...).
const FRASES = [
  "Rolando a iniciativa…",
  "Consultando o grimório…",
  "Calibrando o hiperpropulsor…",
  "Acendendo as tochas da taverna…",
  "Hackeando o terminal da estação…",
  "Decifrando runas antigas…",
  "Interrogando testemunhas…",
  "Afiando as espadas…",
  "Escaneando a nave em busca de anomalias…",
  "Rolando a tabela de encontros aleatórios…",
  "Conferindo a mochila de aventureiro…",
  "Apagando as luzes da mansão assombrada…",
];

const LADOS_3D = [
  { nome: "d4", lados: 4 },
  { nome: "d6", lados: 6 },
  { nome: "d8", lados: 8 },
  { nome: "d10", lados: 10 },
  { nome: "d12", lados: 12 },
  { nome: "d20", lados: 20 },
];

const CAMADAS = 9; // fatias empilhadas em Z: dão espessura ao dado quando ele gira
const ESPESSURA = 1.6; // px entre fatias

/** Carregando: um dado 3D de verdade gira no lugar, em vários eixos, e para mostrando um número; depois vem outro poliedro. */
export default function CarregandoRPG({ mensagem }: { mensagem?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [modo, setModo] = useState<"3d" | "svg">("3d");
  const [nome, setNome] = useState(LADOS_3D[0].nome);
  const [f, setF] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setF((v) => (v + 1) % FRASES.length), 2400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let morto = false;
    let vitrine: { mostrar(l: number, ms?: number): void; destruir(): void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function iniciar() {
      const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduz || !canvas.current) { if (!morto) setModo("svg"); return; }
      try {
        const { VitrineDado } = await import("@/lib/cena-dados");
        if (morto || !canvas.current) return;
        vitrine = new VitrineDado(canvas.current, 160);
        let k = 0;
        const proximo = () => {
          const d = LADOS_3D[k % LADOS_3D.length];
          k++;
          vitrine?.mostrar(d.lados, 1600);
          setNome(d.nome);
        };
        proximo();
        timer = setInterval(proximo, 2400);
      } catch (e) {
        console.warn("Dado 3D indisponível no carregamento, usando versão simples.", e);
        if (!morto) setModo("svg");
      }
    }
    void iniciar();

    return () => {
      morto = true;
      if (timer) clearInterval(timer);
      vitrine?.destruir();
    };
  }, []);

  if (modo === "svg") return <CarregandoSvg mensagem={mensagem} />;

  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-5 py-24">
      <canvas ref={canvas} className="h-40 w-40" aria-hidden />
      <p className="font-[family-name:var(--font-cinzel)] text-xs uppercase tracking-[0.25em] text-gold">{nome}</p>
      <p key={f} className="texto-trocando h-5 text-sm text-muted">{mensagem ?? FRASES[f]}</p>
      <div className="relative h-1 w-48 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="barra-correndo absolute inset-y-0 left-0 w-1/3 rounded-full bg-accent" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Versão reserva (sem WebGL / movimento reduzido): fatias de SVG girando em CSS 3D. */
function CarregandoSvg({ mensagem }: { mensagem?: string }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(20);
  const [f, setF] = useState(0);

  useEffect(() => {
    const dado = setInterval(() => setI((v) => (v + 1) % DADOS.length), 2200);
    const frase = setInterval(() => setF((v) => (v + 1) % FRASES.length), 2400);
    return () => { clearInterval(dado); clearInterval(frase); };
  }, []);

  // O número muda enquanto o dado gira e assenta quando ele para.
  useEffect(() => {
    const lados = DADOS[i].lados;
    let k = 0;
    const t = setInterval(() => {
      k++;
      setN(1 + Math.floor(Math.random() * lados));
      if (k >= 14) clearInterval(t);
    }, 95);
    return () => clearInterval(t);
  }, [i]);

  const d = DADOS[i];

  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-5 py-24">
      <div className="flex h-36 items-center justify-center" style={{ perspective: 600 }}>
        <div
          key={d.nome}
          className="dado-tombando relative h-24 w-24"
          style={{ transformStyle: "preserve-3d" }}
        >
          {Array.from({ length: CAMADAS }, (_, k) => {
            const frente = k === CAMADAS - 1;
            return (
              <svg
                key={k}
                viewBox="0 0 100 100"
                width="96"
                height="96"
                className="absolute inset-0"
                style={{ transform: `translateZ(${(k - (CAMADAS - 1) / 2) * ESPESSURA}px)`, backfaceVisibility: frente ? "hidden" : "visible" }}
              >
                <polygon
                  points={d.pontos}
                  fill={frente ? "var(--card-2)" : "var(--card)"}
                  stroke="var(--accent)"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                {frente && (
                  <text x="50" y={d.y} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--gold)" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                    {n}
                  </text>
                )}
              </svg>
            );
          })}
        </div>
      </div>
      <div key={`s${d.nome}`} className="dado-sombra -mt-4 h-2 w-16 rounded-full bg-black/60 blur-[3px]" aria-hidden />

      <p className="font-[family-name:var(--font-cinzel)] text-xs uppercase tracking-[0.25em] text-gold">{d.nome}</p>

      <p key={f} className="texto-trocando h-5 text-sm text-muted">{mensagem ?? FRASES[f]}</p>

      <div className="relative h-1 w-48 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="barra-correndo absolute inset-y-0 left-0 w-1/3 rounded-full bg-accent" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
