// Sons sintetizados (sem arquivos). O navegador só libera áudio após um gesto do usuário,
// então tudo é criado sob demanda. `ligado` é o botão "Som" da cena; `forcar` é para quando
// o som É o puzzle (morse).
let ctx: AudioContext | null = null;
let ligado = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export const definirSom = (v: boolean) => {
  ligado = v;
};

export function tom(freq: number, dur: number, o: { tipo?: OscillatorType; vol?: number; atraso?: number; forcar?: boolean } = {}) {
  if (!ligado && !o.forcar) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (o.atraso ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.tipo ?? "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.06, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sons = {
  acerto: () => {
    tom(523, 0.3);
    tom(659, 0.3, { atraso: 0.12 });
    tom(784, 0.6, { atraso: 0.24 });
  },
  erro: () => tom(130, 0.4, { tipo: "sawtooth", vol: 0.05 }),
  clique: () => tom(900, 0.05, { tipo: "triangle", vol: 0.04 }),
  tique: () => tom(1800, 0.03, { tipo: "square", vol: 0.025 }),
  batida: () => {
    tom(60, 0.2, { vol: 0.2 });
    tom(52, 0.25, { vol: 0.15, atraso: 0.2 });
  },
};

/** Zumbido grave contínuo de fundo. Devolve a função que o desliga. */
export function drone(freq: number): () => void {
  if (!ligado) return () => {};
  const c = ac();
  if (!c) return () => {};
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 2);
  osc.connect(g).connect(c.destination);
  osc.start();
  return () => {
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.stop(t + 0.6);
  };
}
