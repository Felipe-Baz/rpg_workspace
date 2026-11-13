"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MecanicaLiberada } from "@/lib/marcas-data";
import { sons, tom } from "./audio";

type Props<T extends MecanicaLiberada["tipo"]> = {
  m: Extract<MecanicaLiberada, { tipo: T }>;
  valida: (v: string) => boolean;
  concluir: (v: string) => void;
};

/** Campo "diga a palavra" compartilhado pelos puzzles de decifrar. */
export function RespostaDigitada({
  valida, concluir, dica, rotulo = "A palavra é…",
}: { valida: (v: string) => boolean; concluir: (v: string) => void; dica?: string; rotulo?: string }) {
  const [v, setV] = useState("");
  const [erros, setErros] = useState(0);
  const [treme, setTreme] = useState(false);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!v.trim()) return;
    if (valida(v)) {
      sons.acerto();
      concluir(v.trim());
    } else {
      sons.erro();
      setErros((n) => n + 1);
      setTreme(true);
      setTimeout(() => setTreme(false), 450);
    }
  };

  return (
    <form onSubmit={enviar} className={`mt-4 ${treme ? "treme" : ""}`}>
      <div className="flex gap-2">
        <input aria-label={rotulo} placeholder={rotulo} value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" />
        <button className="btn shrink-0" type="submit">Selar</button>
      </div>
      {erros > 0 && <p className="mt-1 text-sm" style={{ color: "var(--m-blood-hi)" }}>Nada acontece. O selo não cede.</p>}
      {dica && erros >= 2 && <p className="dim mt-1 text-sm">Sussurro: {dica}</p>}
    </form>
  );
}

// ---------------------------------------------------------------- Cifra
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RUNAS = Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᚪᚫ");
const deslocar = (t: string, n: number) => t.replace(/[A-Z]/g, (c) => ABC[(ABC.indexOf(c) + n + 26) % 26]);
const atbash = (t: string) => t.replace(/[A-Z]/g, (c) => ABC[25 - ABC.indexOf(c)]);

export function Cifra({ m, valida, concluir }: Props<"cifra">) {
  const [n, setN] = useState(0);
  const [inverso, setInverso] = useState(false);
  const [virado, setVirado] = useState(false);

  return (
    <div>
      {m.modo === "cesar" && (
        <>
          <p className="decifra" aria-live="polite">{deslocar(m.cifrado, -n)}</p>
          <label className="dim mt-3 block text-sm">
            Gire o disco de bronze: {n} {n === 1 ? "casa" : "casas"}
            <input type="range" min={0} max={25} value={n} onChange={(e) => { setN(+e.target.value); sons.clique(); }} />
          </label>
          <p className="dim mt-1 text-xs" aria-hidden>{ABC} → {deslocar(ABC, -n)}</p>
        </>
      )}
      {m.modo === "atbash" && (
        <>
          <p className="decifra" aria-live="polite">{inverso ? atbash(m.cifrado) : m.cifrado}</p>
          <button className="btn ghost mt-3" onClick={() => { setInverso((v) => !v); sons.clique(); }}>
            {inverso ? "Voltar o alfabeto" : "Inverter o alfabeto"}
          </button>
          <p className="dim mt-2 text-xs" aria-hidden>{ABC} ↔ {Array.from(ABC).reverse().join("")}</p>
        </>
      )}
      {m.modo === "espelho" && (
        <>
          <p className={`decifra ${virado ? "" : "espelhado"}`}>{m.cifrado}</p>
          <button className="btn ghost mt-3" onClick={() => { setVirado((v) => !v); sons.clique(); }}>
            {virado ? "Devolver ao vidro" : "Virar o espelho"}
          </button>
        </>
      )}
      {m.modo === "runico" && (
        <>
          <p className="decifra runico">{m.cifrado}</p>
          <details className="mt-3">
            <summary className="dim cursor-pointer text-sm">Tábua de runas</summary>
            <div className="tabua-runas mt-2">
              {RUNAS.map((r, i) => (
                <span key={r}><b>{r}</b> {ABC[i]}</span>
              ))}
            </div>
          </details>
        </>
      )}
      <RespostaDigitada valida={valida} concluir={concluir} dica={m.dica} />
    </div>
  );
}

// ---------------------------------------------------------------- Lanterna
export function Lanterna({ m, valida, concluir }: Props<"lanterna">) {
  const ref = useRef<HTMLDivElement>(null);
  const [tudo, setTudo] = useState(false);

  const mover = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${e.clientX - r.left}px`);
    el.style.setProperty("--py", `${e.clientY - r.top}px`);
  };

  return (
    <div>
      <div ref={ref} className="lanterna" onPointerMove={mover} onPointerDown={mover} style={{ ["--px" as string]: "-300px", ["--py" as string]: "-300px" }}>
        {m.palavras.map((p, i) => (
          <span key={i} className="lanterna-palavra" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.t}</span>
        ))}
        {!tudo && <div className="lanterna-escuro" aria-hidden />}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <p className="dim text-xs">Passe a luz pela escuridão. Nem tudo que brilha é pista.</p>
        <button className="text-xs underline dim" onClick={() => setTudo((v) => !v)}>
          {tudo ? "apagar a tocha" : "acender tudo (acessibilidade)"}
        </button>
      </div>
      <RespostaDigitada valida={valida} concluir={concluir} dica={m.dica} />
    </div>
  );
}

// ---------------------------------------------------------------- Rastros
export function Rastros({ m, valida, concluir }: Props<"rastros">) {
  const partes = m.texto.split(/\[\[(.+?)\]\]/);
  const [achados, setAchados] = useState<number[]>([]);

  const achar = (k: number) => {
    sons.clique();
    setAchados((a) => (a.includes(k) ? a : [...a, k]));
  };

  return (
    <div>
      <p className="rastros-texto">
        {partes.map((t, i) => {
          if (i % 2 === 0) return <span key={i}>{t}</span>;
          const k = (i - 1) / 2;
          return (
            <button key={i} className={`rastro ${achados.includes(k) ? "achado" : ""}`} onClick={() => achar(k)}>{t}</button>
          );
        })}
      </p>
      <p className="dim mt-1 text-xs">Algumas palavras guardam mais do que dizem. Toque nelas.</p>
      {achados.length > 0 && (
        <ul className="mt-3 space-y-1">
          {achados.map((k) => (
            <li key={k} className="fragmento-achado">“{m.revelacoes[k]}”</li>
          ))}
        </ul>
      )}
      <RespostaDigitada valida={valida} concluir={concluir} dica={m.dica} />
    </div>
  );
}

// ---------------------------------------------------------------- Morse
export const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
};

export function Morse({ m, valida, concluir }: Props<"morse">) {
  const [tocando, setTocando] = useState(false);
  const [aceso, setAceso] = useState(false);
  const [linha, setLinha] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const ouvir = () => {
    if (tocando) return;
    const U = 160;
    let t = 0;
    const agenda: { em: number; fn: () => void }[] = [];
    setLinha("");
    setTocando(true);
    for (const simb of m.codigo) {
      if (simb === "." || simb === "-") {
        const d = simb === "." ? U : U * 3;
        const inicio = t;
        agenda.push({ em: inicio, fn: () => { setAceso(true); setLinha((l) => l + simb); tom(620, d / 1000, { forcar: true, vol: 0.1 }); } });
        agenda.push({ em: inicio + d, fn: () => setAceso(false) });
        t += d + U;
      } else if (simb === " ") {
        agenda.push({ em: t, fn: () => setLinha((l) => l + " ") });
        t += U * 2;
      } else if (simb === "/") {
        agenda.push({ em: t, fn: () => setLinha((l) => l + " / ") });
        t += U * 4;
      }
    }
    agenda.push({ em: t, fn: () => setTocando(false) });
    timers.current = agenda.map((a) => setTimeout(a.fn, a.em));
  };

  return (
    <div>
      <div className="morse-painel">
        <span className={`morse-lampada ${aceso ? "acesa" : ""}`} aria-hidden />
        <div>
          <button className="btn" onClick={ouvir} disabled={tocando}>{tocando ? "Transmitindo…" : "Ouvir o sinal"}</button>
          <p className="morse-linha" aria-live="off">{linha || "· · ·"}</p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="dim cursor-pointer text-sm">Código dos antigos</summary>
        <div className="tabua-runas mt-2">
          {Object.entries(MORSE).map(([l, c]) => (
            <span key={l}><b>{l}</b> {c}</span>
          ))}
        </div>
      </details>
      <RespostaDigitada valida={valida} concluir={concluir} dica={m.dica} />
    </div>
  );
}
