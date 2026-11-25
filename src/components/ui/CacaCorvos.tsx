"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { MAX_NICK, lerRanking, limparNick, salvarPontuacao, type EntradaRanking } from "@/lib/rankingJogo";

// "Caça aos Corvos": corvos cruzam o céu e você atira neles com uma besta. Rodada de 45 s;
// a melhor pontuação pode ser salva no ranking (Nick - Pontuação).
const W = 640;
const H = 300;
const CHAO = 274;
const DURACAO = 45;
const MUNICAO = 6;
const RECARGA = 1.1;
const CHAVE_NICK = "cacaCorvos-nick";
const CHAVE_RECORDE = "cacaCorvos-recorde";

type Tipo = "corvo" | "grande" | "dourado";
type Ave = {
  x: number; y: number; y0: number; vx: number; fase: number; tipo: Tipo; r: number; base: number;
  morta: boolean; vy: number; rot: number;
};
type Pena = { x: number; y: number; vx: number; vy: number; vida: number };
type Texto = { x: number; y: number; txt: string; vida: number; cor: string };

const ler = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

export default function CacaCorvos() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const est = useRef({
    fase: "parado" as "parado" | "jogando" | "fim",
    tempo: DURACAO, pontos: 0, municao: MUNICAO, recarga: 0, combo: 0, acertos: 0, tiros: 0,
    aves: [] as Ave[], penas: [] as Pena[], textos: [] as Texto[], spawn: 0.6,
    mira: { x: W / 2, y: 110 }, recuo: 0, tremor: 0,
  });

  const [fim, setFim] = useState<{ pontos: number; acertos: number; tiros: number } | null>(null);
  const [recordeLocal, setRecordeLocal] = useState(0);
  const [ranking, setRanking] = useState<EntradaRanking[] | null>(null);
  const [erroRanking, setErroRanking] = useState(false);
  const [nick, setNick] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  const carregarRanking = useCallback(async () => {
    try {
      setRanking(await lerRanking());
      setErroRanking(false);
    } catch {
      setErroRanking(true);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setRecordeLocal(Number(ler(CHAVE_RECORDE)) || 0);
      setNick(ler(CHAVE_NICK) || limparNick((user?.displayName ?? "").split(" ")[0] ?? ""));
      void carregarRanking();
    }, 0);
    return () => clearTimeout(t);
  }, [user, carregarRanking]);

  const iniciar = useCallback(() => {
    Object.assign(est.current, {
      fase: "jogando", tempo: DURACAO, pontos: 0, municao: MUNICAO, recarga: 0, combo: 0, acertos: 0, tiros: 0,
      aves: [], penas: [], textos: [], spawn: 0.5, recuo: 0, tremor: 0,
    });
    setFim(null);
    setMsg(null);
  }, []);

  const atirar = useCallback(() => {
    const e = est.current;
    if (e.fase !== "jogando" || e.recarga > 0) return;
    if (e.municao <= 0) { e.recarga = RECARGA; return; }
    e.municao -= 1;
    e.tiros += 1;
    e.recuo = 1;
    e.tremor = 0.12;
    if (e.municao === 0) e.recarga = RECARGA;

    const { x, y } = e.mira;
    let idx = -1;
    let melhor = Infinity;
    e.aves.forEach((a, i) => {
      if (a.morta) return;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d <= a.r + 7 && d < melhor) { melhor = d; idx = i; }
    });
    if (idx >= 0) {
      const alvo = e.aves[idx];
      e.acertos += 1;
      e.combo += 1;
      const mult = Math.min(1 + Math.floor(e.combo / 3), 5);
      const pts = (alvo.base) * mult;
      e.pontos += pts;
      e.aves[idx] = { ...alvo, morta: true, vy: -60 };
      e.textos.push({ x: alvo.x, y: alvo.y - 12, txt: `+${pts}${mult > 1 ? ` x${mult}` : ""}`, vida: 1, cor: alvo.tipo === "dourado" ? "ouro" : "fg" });
      for (let i = 0; i < 9; i++) {
        e.penas.push({ x: alvo.x, y: alvo.y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 90, vida: 0.8 + Math.random() * 0.6 });
      }
    } else {
      e.combo = 0;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const css = getComputedStyle(document.documentElement);
    const cor = (v: string, f: string) => css.getPropertyValue(v).trim() || f;
    const C = {
      card: cor("--card", "#1c1a22"),
      card2: cor("--card-2", "#242130"),
      texto: cor("--muted", "#a39db3"),
      fg: cor("--foreground", "#f1eef7"),
      acc: cor("--accent", "#7c3aed"),
      soft: cor("--accent-soft", "#c4b5fd"),
      ouro: cor("--gold", "#c9a45c"),
      perigo: cor("--danger", "#ef4444"),
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== "KeyR") return;
      const alvo = ev.target as HTMLElement | null;
      if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;
      const e = est.current;
      if (e.fase === "jogando" && e.recarga <= 0 && e.municao < MUNICAO) e.recarga = RECARGA;
    };
    window.addEventListener("keydown", onKey);

    const nova = (): Ave => {
      const sorte = Math.random();
      const tipo: Tipo = sorte < 0.1 ? "dourado" : sorte < 0.35 ? "grande" : "corvo";
      const r = tipo === "grande" ? 22 : tipo === "dourado" ? 11 : 15;
      const vel = tipo === "grande" ? 70 + Math.random() * 40 : tipo === "dourado" ? 220 + Math.random() * 80 : 110 + Math.random() * 90;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y0 = 40 + Math.random() * (CHAO - 130);
      return {
        x: dir > 0 ? -30 : W + 30, y: y0, y0, vx: vel * dir, fase: Math.random() * 6, tipo, r,
        base: tipo === "grande" ? 10 : tipo === "dourado" ? 100 : 25, morta: false, vy: 0, rot: 0,
      };
    };

    const desenharAve = (a: Ave, t: number) => {
      const dir = a.vx >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.morta ? a.rot : 0);
      ctx.scale(dir, 1);
      const s = a.r / 15;
      ctx.scale(s, s);
      const asa = a.morta ? 0.2 : Math.sin(t / 90 + a.fase);
      ctx.fillStyle = a.tipo === "dourado" ? C.ouro : "#0d0b12";
      ctx.strokeStyle = a.tipo === "dourado" ? "#fff6" : C.soft + "88";
      ctx.lineWidth = 1;
      // corpo
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // asas
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.quadraticCurveTo(-6, -22 * asa - 6, 8, -20 * asa - 4);
      ctx.quadraticCurveTo(4, -6, 4, -2);
      ctx.fill();
      ctx.stroke();
      // cabeça e bico
      ctx.beginPath();
      ctx.arc(12, -4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ouro;
      if (a.tipo === "dourado") ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(16.5, -5);
      ctx.lineTo(23, -3);
      ctx.lineTo(16.5, -2);
      ctx.fill();
      // olho
      ctx.fillStyle = a.morta ? C.perigo : C.soft;
      ctx.fillRect(13, -6, 2, 2);
      ctx.restore();
    };

    const desenharBesta = (e: typeof est.current) => {
      const gx = W / 2;
      const gy = H - 6;
      const ang = Math.max(-Math.PI + 0.25, Math.min(-0.25, Math.atan2(e.mira.y - gy, e.mira.x - gx)));
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(ang);
      const rec = e.recuo * 6;
      ctx.fillStyle = "#4a3320";
      ctx.fillRect(-14 - rec, -4, 40, 8); // coronha
      ctx.fillStyle = C.texto;
      ctx.fillRect(10 - rec, -3, 34, 6); // cano
      ctx.fillRect(28 - rec, -16, 4, 32); // arco
      ctx.strokeStyle = C.fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30 - rec, -16);
      ctx.lineTo(8 - rec, 0);
      ctx.lineTo(30 - rec, 16);
      ctx.stroke();
      if (e.recarga <= 0 && e.municao > 0) {
        ctx.fillStyle = C.ouro;
        ctx.fillRect(8 - rec, -1, 34, 2); // virote
      }
      ctx.restore();
      ctx.fillStyle = "#2a2230";
      ctx.beginPath();
      ctx.arc(gx, gy + 6, 14, Math.PI, 0);
      ctx.fill();
    };

    let raf = 0;
    let ultimo = performance.now();

    const quadro = (agora: number) => {
      const dt = Math.min((agora - ultimo) / 1000, 0.05);
      ultimo = agora;
      const e = est.current;

      if (e.fase === "jogando") {
        e.tempo -= dt;
        if (e.recarga > 0) {
          e.recarga -= dt;
          if (e.recarga <= 0) { e.recarga = 0; e.municao = MUNICAO; }
        }
        e.spawn -= dt;
        if (e.spawn <= 0 && e.aves.length < 9) {
          e.aves.push(nova());
          e.spawn = 0.45 + Math.random() * 0.7;
        }
        if (e.tempo <= 0) {
          e.tempo = 0;
          e.fase = "fim";
          const resumo = { pontos: e.pontos, acertos: e.acertos, tiros: e.tiros };
          if (e.pontos > (Number(ler(CHAVE_RECORDE)) || 0)) {
            gravar(CHAVE_RECORDE, String(e.pontos));
            setRecordeLocal(e.pontos);
          }
          setFim(resumo);
        }
      }

      for (const a of e.aves) {
        if (a.morta) {
          a.vy += 900 * dt;
          a.y += a.vy * dt;
          a.x += a.vx * 0.15 * dt;
          a.rot += 6 * dt;
        } else {
          a.x += a.vx * dt;
          a.y = a.y0 + Math.sin(agora / 420 + a.fase) * 14;
        }
      }
      e.aves = e.aves.filter((a) => (a.morta ? a.y < CHAO + 30 : a.x > -50 && a.x < W + 50));
      for (const p of e.penas) { p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt; }
      e.penas = e.penas.filter((p) => p.vida > 0);
      for (const t of e.textos) { t.y -= 30 * dt; t.vida -= dt; }
      e.textos = e.textos.filter((t) => t.vida > 0);
      e.recuo = Math.max(0, e.recuo - dt * 6);
      e.tremor = Math.max(0, e.tremor - dt);

      // ---- desenho ----
      ctx.save();
      if (e.tremor > 0) ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
      const ceu = ctx.createLinearGradient(0, 0, 0, H);
      ceu.addColorStop(0, C.card);
      ceu.addColorStop(1, C.card2);
      ctx.fillStyle = ceu;
      ctx.fillRect(-4, -4, W + 8, H + 8);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = C.ouro;
      ctx.beginPath();
      ctx.arc(520, 62, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // colinas e árvores secas
      ctx.fillStyle = "#17131d";
      ctx.beginPath();
      ctx.moveTo(0, CHAO);
      ctx.quadraticCurveTo(160, CHAO - 50, 320, CHAO - 12);
      ctx.quadraticCurveTo(480, CHAO - 55, W, CHAO - 10);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      ctx.strokeStyle = "#17131d";
      ctx.lineWidth = 3;
      for (const tx of [70, 560]) {
        ctx.beginPath();
        ctx.moveTo(tx, CHAO - 14);
        ctx.lineTo(tx, CHAO - 70);
        ctx.moveTo(tx, CHAO - 48);
        ctx.lineTo(tx - 18, CHAO - 68);
        ctx.moveTo(tx, CHAO - 38);
        ctx.lineTo(tx + 16, CHAO - 58);
        ctx.stroke();
      }

      for (const a of e.aves) desenharAve(a, agora);
      for (const p of e.penas) {
        ctx.globalAlpha = Math.max(0, p.vida);
        ctx.fillStyle = "#0d0b12";
        ctx.fillRect(p.x, p.y, 3, 2);
      }
      ctx.globalAlpha = 1;
      desenharBesta(e);

      ctx.textAlign = "center";
      ctx.font = "bold 13px system-ui, sans-serif";
      for (const t of e.textos) {
        ctx.globalAlpha = Math.max(0, t.vida);
        ctx.fillStyle = t.cor === "ouro" ? C.ouro : C.fg;
        ctx.fillText(t.txt, t.x, t.y);
      }
      ctx.globalAlpha = 1;

      // HUD
      ctx.textAlign = "left";
      ctx.font = "bold 15px ui-monospace, monospace";
      ctx.fillStyle = C.fg;
      ctx.fillText(`${e.pontos}`, 12, 24);
      const mult = Math.min(1 + Math.floor(e.combo / 3), 5);
      if (e.combo > 0) {
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = C.ouro;
        ctx.fillText(`combo ${e.combo} · x${mult}`, 12, 42);
      }
      ctx.textAlign = "right";
      ctx.font = "bold 15px ui-monospace, monospace";
      ctx.fillStyle = e.tempo <= 10 && e.fase === "jogando" ? C.perigo : C.fg;
      ctx.fillText(`${Math.ceil(e.tempo)}s`, W - 12, 24);
      // munição
      for (let i = 0; i < MUNICAO; i++) {
        ctx.fillStyle = i < e.municao ? C.ouro : C.card2;
        ctx.strokeStyle = C.texto;
        ctx.lineWidth = 1;
        ctx.fillRect(W - 14 - i * 10, 34, 6, 14);
        ctx.strokeRect(W - 14 - i * 10, 34, 6, 14);
      }
      if (e.recarga > 0) {
        ctx.textAlign = "center";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = C.texto;
        ctx.fillText("recarregando…", W / 2, H - 40);
      }

      ctx.textAlign = "center";
      if (e.fase === "parado" || e.fase === "fim") {
        ctx.fillStyle = "rgba(10,8,14,0.62)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.ouro;
        ctx.font = "bold 24px Georgia, serif";
        ctx.fillText(e.fase === "parado" ? "Caça aos Corvos" : "Fim da caçada", W / 2, 100);
        ctx.fillStyle = C.fg;
        ctx.font = "14px system-ui, sans-serif";
        if (e.fase === "parado") {
          ctx.fillText("Mire com o mouse, clique para atirar (R recarrega)", W / 2, 132);
          ctx.fillText("Dourados valem 100 · acertos seguidos aumentam o combo", W / 2, 154);
        } else {
          ctx.font = "bold 20px system-ui, sans-serif";
          ctx.fillText(`${e.pontos} pontos`, W / 2, 134);
          ctx.font = "13px system-ui, sans-serif";
          const prec = e.tiros ? Math.round((e.acertos / e.tiros) * 100) : 0;
          ctx.fillText(`${e.acertos} corvos · precisão ${prec}%`, W / 2, 156);
        }
        ctx.fillStyle = C.soft;
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillText(e.fase === "parado" ? "Clique para começar" : "Clique para jogar de novo", W / 2, 190);
      } else {
        // mira
        const { x, y } = e.mira;
        ctx.strokeStyle = e.recarga > 0 ? C.texto : C.perigo;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.moveTo(x - 16, y); ctx.lineTo(x - 5, y);
        ctx.moveTo(x + 5, y); ctx.lineTo(x + 16, y);
        ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 5);
        ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 16);
        ctx.stroke();
      }
      ctx.restore();

      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);

    const onVis = () => { ultimo = performance.now(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function posicao(ev: React.PointerEvent<HTMLCanvasElement>) {
    const r = ev.currentTarget.getBoundingClientRect();
    est.current.mira = { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }

  function aoPressionar(ev: React.PointerEvent<HTMLCanvasElement>) {
    posicao(ev);
    const e = est.current;
    if (e.fase === "jogando") atirar();
    else iniciar();
  }

  async function salvar() {
    if (!user || !fim || salvando) return;
    const limpo = limparNick(nick);
    if (!limpo) { setMsg({ ok: false, txt: "Digite um nick." }); return; }
    setSalvando(true);
    setMsg(null);
    try {
      gravar(CHAVE_NICK, limpo);
      const gravou = await salvarPontuacao(user.uid, limpo, fim.pontos);
      setMsg(gravou
        ? { ok: true, txt: "Pontuação salva no ranking!" }
        : { ok: false, txt: "Você já tem uma pontuação maior ou igual no ranking." });
      await carregarRanking();
    } catch {
      setMsg({ ok: false, txt: "Não foi possível salvar agora (sem conexão ou sem permissão). Tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        onPointerMove={posicao}
        onPointerDown={aoPressionar}
        role="img"
        aria-label="Minijogo Caça aos Corvos: clique nos corvos para atirar"
        className="mx-auto block w-full max-w-[640px] cursor-none touch-none select-none rounded-xl border border-border"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      <p className="mt-2 text-xs text-muted">
        Mouse ou toque para mirar e atirar · R recarrega
        {recordeLocal > 0 && <span className="ml-2 text-gold">· Seu melhor aqui: {recordeLocal}</span>}
      </p>

      {fim && fim.pontos > 0 && (
        <div className="mx-auto mt-4 max-w-[640px] rounded-xl border border-border bg-card p-4 text-left">
          <p className="text-sm font-semibold text-foreground">Entrar no ranking com {fim.pontos} pontos</p>
          <form
            className="mt-2 flex flex-wrap gap-2"
            onSubmit={(ev) => { ev.preventDefault(); void salvar(); }}
          >
            <input
              value={nick}
              onChange={(ev) => setNick(ev.target.value.slice(0, MAX_NICK))}
              placeholder="Seu nick"
              maxLength={MAX_NICK}
              aria-label="Nick para o ranking"
              className="min-w-0 flex-1 rounded-lg border border-border bg-card-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={salvando || !user}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar pontuação"}
            </button>
          </form>
          {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-warn"}`}>{msg.txt}</p>}
        </div>
      )}

      <div className="mx-auto mt-4 max-w-[640px] rounded-xl border border-border bg-card p-4 text-left">
        <p className="text-sm font-semibold text-gold">Ranking</p>
        {erroRanking && <p className="mt-2 text-xs text-muted">Ranking indisponível no momento (sem conexão?).</p>}
        {!erroRanking && ranking === null && <p className="mt-2 text-xs text-muted">Carregando…</p>}
        {ranking && ranking.length === 0 && <p className="mt-2 text-xs text-muted">Ninguém pontuou ainda. Seja o primeiro!</p>}
        {ranking && ranking.length > 0 && (
          <ol className="mt-2 space-y-1">
            {ranking.map((r, i) => (
              <li
                key={r.uid}
                className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${r.uid === user?.uid ? "bg-accent/15 text-foreground" : "text-muted"}`}
              >
                <span className="min-w-0 truncate">
                  <span className="mr-2 inline-block w-5 text-right font-mono text-xs">{i + 1}.</span>
                  {r.nick}
                </span>
                <span className="font-mono text-gold">{r.pontos}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
