"use client";

import { useEffect, useRef, useState } from "react";
import type { MecanicaLiberada } from "@/lib/marcas-data";
import { sons } from "./audio";

type Props<T extends MecanicaLiberada["tipo"]> = {
  m: Extract<MecanicaLiberada, { tipo: T }>;
  valida: (v: string) => boolean;
  concluir: (v: string) => void;
};

function useTreme() {
  const [treme, setTreme] = useState(false);
  const disparar = () => {
    setTreme(true);
    setTimeout(() => setTreme(false), 450);
  };
  return [treme, disparar] as const;
}

// ---------------------------------------------------------------- Fragmentos
export function Fragmentos({ m, valida, concluir }: Props<"fragmentos">) {
  const [ordem, setOrdem] = useState(() => m.pecas.map((_, i) => i));
  const [treme, tremer] = useTreme();
  const [erros, setErros] = useState(0);

  const mover = (pos: number, d: -1 | 1) => {
    const alvo = pos + d;
    if (alvo < 0 || alvo >= ordem.length) return;
    sons.clique();
    setOrdem((o) => {
      const n = [...o];
      [n[pos], n[alvo]] = [n[alvo], n[pos]];
      return n;
    });
  };

  const selar = () => {
    const v = ordem.join(",");
    if (valida(v)) {
      sons.acerto();
      concluir(v);
    } else {
      sons.erro();
      tremer();
      setErros((n) => n + 1);
    }
  };

  return (
    <div className={treme ? "treme" : ""}>
      <ol className="space-y-2">
        {ordem.map((idx, pos) => (
          <li key={idx} className="fragmento">
            <span className="fragmento-texto">{m.pecas[idx]}</span>
            <span className="fragmento-botoes">
              <button className="btn ghost" aria-label="Subir" onClick={() => mover(pos, -1)} disabled={pos === 0}>▲</button>
              <button className="btn ghost" aria-label="Descer" onClick={() => mover(pos, 1)} disabled={pos === ordem.length - 1}>▼</button>
            </span>
          </li>
        ))}
      </ol>
      <button className="btn mt-3" onClick={selar}>Selar a ordem</button>
      {erros > 0 && <p className="mt-1 text-sm" style={{ color: "var(--m-blood-hi)" }}>As peças não se encaixam assim.</p>}
      {m.dica && erros >= 2 && <p className="dim mt-1 text-sm">Sussurro: {m.dica}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Relógio
export function Relogio({ m, valida, concluir }: Props<"relogio">) {
  const [h, setH] = useState(6);
  const [min, setMin] = useState(30);
  const [treme, tremer] = useTreme();
  const [erros, setErros] = useState(0);

  const angMin = min * 6;
  const angHora = (h % 12) * 30 + min * 0.5;
  const mao = (ang: number, len: number, w: number) => {
    const r = ((ang - 90) * Math.PI) / 180;
    return <line x1="100" y1="100" x2={100 + Math.cos(r) * len} y2={100 + Math.sin(r) * len} strokeWidth={w} strokeLinecap="round" />;
  };

  const selar = () => {
    const v = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    if (valida(v)) {
      sons.acerto();
      concluir(v);
    } else {
      sons.erro();
      tremer();
      setErros((n) => n + 1);
    }
  };

  return (
    <div className={treme ? "treme" : ""}>
      <div className="relogio">
        <svg viewBox="0 0 200 200" role="img" aria-label={`Relógio marcando ${h} horas e ${min} minutos`}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="var(--m-gold)" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => {
            const r = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={100 + Math.sin(r) * 80} y1={100 - Math.cos(r) * 80} x2={100 + Math.sin(r) * 88} y2={100 - Math.cos(r) * 88} stroke="var(--m-gold)" strokeWidth="2" />;
          })}
          <g stroke="var(--m-bone)">{mao(angHora, 48, 5)}</g>
          <g stroke="var(--m-blood-hi)">{mao(angMin, 72, 3)}</g>
          <circle cx="100" cy="100" r="5" fill="var(--m-gold)" />
        </svg>
        <div className="relogio-controles">
          <div>
            <span className="dim text-sm">Hora</span>
            <div className="flex gap-1">
              <button className="btn ghost" onClick={() => { sons.tique(); setH((x) => (x === 1 ? 12 : x - 1)); }}>−</button>
              <output className="relogio-num">{h}</output>
              <button className="btn ghost" onClick={() => { sons.tique(); setH((x) => (x === 12 ? 1 : x + 1)); }}>+</button>
            </div>
          </div>
          <div>
            <span className="dim text-sm">Minuto</span>
            <div className="flex gap-1">
              <button className="btn ghost" onClick={() => { sons.tique(); setMin((x) => (x + 55) % 60); }}>−</button>
              <output className="relogio-num">{String(min).padStart(2, "0")}</output>
              <button className="btn ghost" onClick={() => { sons.tique(); setMin((x) => (x + 5) % 60); }}>+</button>
            </div>
          </div>
          <button className="btn" onClick={selar}>Parar o tempo</button>
        </div>
      </div>
      {erros > 0 && <p className="mt-1 text-sm" style={{ color: "var(--m-blood-hi)" }}>O tempo se recusa a parar nesse instante.</p>}
      {m.dica && erros >= 2 && <p className="dim mt-1 text-sm">Sussurro: {m.dica}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Runas (cadeado de anéis)
export function Runas({ m, valida, concluir }: Props<"runas">) {
  const [pos, setPos] = useState(() => m.aneis.map(() => 0));
  const [aberto, setAberto] = useState(false);

  const girar = (i: number, d: number) => {
    if (aberto) return;
    sons.clique();
    const n = pos.map((p, k) => (k === i ? (p + d + m.aneis[i].length) % m.aneis[i].length : p));
    setPos(n);
    const v = n.map((p, k) => m.aneis[k][p]).join("");
    if (valida(v)) {
      setAberto(true);
      sons.acerto();
      setTimeout(() => concluir(v), 900);
    }
  };

  return (
    <div>
      <div className={`runas ${aberto ? "aberto" : ""}`}>
        {m.aneis.map((anel, i) => (
          <div key={i} className="runas-anel">
            <button aria-label={`Girar anel ${i + 1} para cima`} onClick={() => girar(i, -1)}>▲</button>
            <span className="runas-letra">{anel[pos[i]]}</span>
            <button aria-label={`Girar anel ${i + 1} para baixo`} onClick={() => girar(i, 1)}>▼</button>
          </div>
        ))}
      </div>
      <p className="dim mt-2 text-sm">{aberto ? "O fecho cede." : "Gire os anéis até que algo ceda."}</p>
      {m.dica && <p className="dim mt-1 text-sm">Sussurro: {m.dica}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Escolha (barganha / diálogo)
export function Escolha({ m, valida, concluir }: Props<"escolha">) {
  const [picks, setPicks] = useState<number[]>([]);
  const [aviso, setAviso] = useState("");
  const [treme, tremer] = useTreme();
  const rodada = m.rodadas[picks.length];

  const escolher = (i: number) => {
    const prox = [...picks, i];
    const v = prox.join(",");
    if (!valida(v)) {
      sons.erro();
      tremer();
      setPicks([]);
      setAviso("Algo se partiu na conversa. Tudo recomeça.");
      return;
    }
    sons.clique();
    setAviso("");
    if (prox.length === m.rodadas.length) {
      sons.acerto();
      setPicks(prox);
      concluir(v);
    } else setPicks(prox);
  };

  return (
    <div className={treme ? "treme" : ""}>
      <ol className="mb-3 space-y-1">
        {picks.map((p, k) => (
          <li key={k} className="dim text-sm">
            <i>{m.rodadas[k].fala}</i> — <span className="gold">{m.rodadas[k].opcoes[p]}</span>
          </li>
        ))}
      </ol>
      {rodada && (
        <div>
          <p className="italic">{rodada.fala}</p>
          <div className="mt-2 grid gap-2">
            {rodada.opcoes.map((o, i) => (
              <button key={i} className="btn ghost text-left" onClick={() => escolher(i)}>{o}</button>
            ))}
          </div>
        </div>
      )}
      {aviso && <p className="mt-2 text-sm" style={{ color: "var(--m-blood-hi)" }}>{aviso}</p>}
      {m.dica && <p className="dim mt-2 text-sm">Sussurro: {m.dica}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Espera (ritual)
export function Espera({ m, concluir }: Props<"espera">) {
  return m.modo === "segurar" ? <Segurar m={m} concluir={concluir} /> : <Quietude m={m} concluir={concluir} />;
}

function Barra({ prog }: { prog: number }) {
  return (
    <div className="espera-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog * 100)}>
      <div style={{ width: `${prog * 100}%` }} />
    </div>
  );
}

function Segurar({ m, concluir }: { m: Extract<MecanicaLiberada, { tipo: "espera" }>; concluir: (v: string) => void }) {
  const [prog, setProg] = useState(0);
  const [soltou, setSoltou] = useState(0);
  const ini = useRef<number | null>(null);
  const raf = useRef(0);
  const cb = useRef(concluir);
  useEffect(() => {
    cb.current = concluir;
  });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function quadro() {
    if (ini.current == null) return;
    const p = (performance.now() - ini.current) / (m.segundos * 1000);
    if (p >= 1) {
      ini.current = null;
      setProg(1);
      sons.acerto();
      cb.current("ok");
      return;
    }
    setProg(p);
    raf.current = requestAnimationFrame(quadro);
  }
  const comecar = () => {
    if (ini.current != null) return;
    ini.current = performance.now();
    raf.current = requestAnimationFrame(quadro);
  };
  const soltar = () => {
    if (ini.current == null) return;
    ini.current = null;
    cancelAnimationFrame(raf.current);
    setProg(0);
    setSoltou((n) => n + 1);
    sons.erro();
  };

  const t = m.tentacoes ?? [];
  const tentacao = prog > 0 && t.length ? t[Math.min(t.length - 1, Math.floor(prog * t.length))] : "";

  return (
    <div className="text-center">
      <button
        className={`espera-botao ${prog > 0 ? "ativo" : ""}`}
        style={{ ["--p" as string]: prog }}
        onPointerDown={comecar}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerCancel={soltar}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); comecar(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") soltar(); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {m.rotulo ?? "Segure"}
      </button>
      <Barra prog={prog} />
      <p className="mt-2 min-h-[1.5rem] italic" style={{ color: "var(--m-blood-hi)" }} aria-live="polite">{tentacao}</p>
      <p className="dim text-sm">
        Mantenha pressionado por {m.segundos}s. {soltou > 0 && `Você cedeu ${soltou}×; a contagem recomeça.`}
      </p>
    </div>
  );
}

function Quietude({ m, concluir }: { m: Extract<MecanicaLiberada, { tipo: "espera" }>; concluir: (v: string) => void }) {
  const [ativa, setAtiva] = useState(false);
  const [prog, setProg] = useState(0);
  const [falhas, setFalhas] = useState(0);
  const cb = useRef(concluir);
  useEffect(() => {
    cb.current = concluir;
  });

  useEffect(() => {
    if (!ativa) return;
    const t0 = performance.now();
    let ini = t0;
    let seg = -1;
    const mexeu = (e: Event) => {
      if (performance.now() - t0 < 800) return; // folga: o próprio clique que começou a vigília
      if (e instanceof PointerEvent && Math.abs(e.movementX) + Math.abs(e.movementY) < 3) return;
      ini = performance.now();
      setProg(0);
      setFalhas((n) => n + 1);
      sons.erro();
    };
    const id = setInterval(() => {
      const p = (performance.now() - ini) / (m.segundos * 1000);
      if (p >= 1) {
        clearInterval(id);
        setAtiva(false);
        setProg(1);
        sons.acerto();
        cb.current("ok");
      } else {
        setProg(p);
        const s = Math.floor(p * m.segundos);
        if (s !== seg) {
          seg = s;
          sons.tique();
        }
      }
    }, 100);
    const ev = ["pointermove", "keydown", "wheel", "touchmove"] as const;
    ev.forEach((e) => window.addEventListener(e, mexeu));
    return () => {
      clearInterval(id);
      ev.forEach((e) => window.removeEventListener(e, mexeu));
    };
  }, [ativa, m.segundos]);

  return (
    <div className="text-center">
      {!ativa && prog < 1 && (
        <button className="btn" onClick={() => { setProg(0); setAtiva(true); }}>{m.rotulo ?? "Começar a vigília"}</button>
      )}
      {ativa && <p className="italic">Não se mova. Não toque em nada.</p>}
      <Barra prog={prog} />
      {falhas > 0 && <p className="mt-2 text-sm" style={{ color: "var(--m-blood-hi)" }}>Você se mexeu {falhas}×. O tempo recomeça.</p>}
      <p className="dim mt-1 text-sm">Fique imóvel por {m.segundos}s — mouse, teclado e toque parados.</p>
    </div>
  );
}
