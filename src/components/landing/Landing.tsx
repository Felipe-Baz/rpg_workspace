"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BookOpenText, Dices, Download, EyeOff, Image as ImageIcon, KeyRound, Map as MapIcon, Scroll,
  Skull, Sparkles, Swords, UserRound, Users, WandSparkles, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import ThemeToggle from "../ThemeToggle";
import Brasas from "./Brasas";

/* ---------- utilitários ---------- */

// Revela o elemento quando entra na tela (classe .rev → .visivel).
function useRevelar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("visivel"); io.disconnect(); } },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Revelar({ children, atraso = 0, className = "" }: { children: React.ReactNode; atraso?: number; className?: string }) {
  const ref = useRevelar<HTMLDivElement>();
  return (
    <div ref={ref} className={`rev ${className}`} style={{ "--d": `${atraso}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

// Digita um texto letra a letra, em loop.
function useDigitar(frases: string[], vel = 45) {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) { const t = setTimeout(() => setTxt(frases[0]), 0); return () => clearTimeout(t); }
    let i = 0, j = 0, apagando = false, t: ReturnType<typeof setTimeout>;
    const passo = () => {
      const f = frases[i];
      if (!apagando) { j++; if (j === f.length) { apagando = true; t = setTimeout(passo, 2200); setTxt(f); return; } }
      else { j -= 2; if (j <= 0) { j = 0; apagando = false; i = (i + 1) % frases.length; } }
      setTxt(f.slice(0, Math.max(j, 0)));
      t = setTimeout(passo, apagando ? vel / 2 : vel);
    };
    t = setTimeout(passo, 600);
    return () => clearTimeout(t);
  }, [frases, vel]);
  return txt;
}

const btnPrimario = "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 hover:bg-accent-strong hover:shadow-accent/50";
const btnSecundario = "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3 font-semibold backdrop-blur hover:border-accent-hover";

/* ---------- conteúdo ---------- */

const FRASES_MAPA = [
  "Uma taverna com lareira e dois NPCs suspeitos…",
  "Uma masmorra com três salas e um altar…",
  "Um acampamento na floresta, à noite…",
];

const RECURSOS: { icone: LucideIcon; titulo: string; texto: string; cor: string }[] = [
  { icone: MapIcon, titulo: "Mapas e cenas", texto: "Monte cenas em um editor próprio, com camadas, assets e histórico de alterações. Converta uma imagem de mapa em cena editável e exporte para VTT.", cor: "text-accent-hover" },
  { icone: WandSparkles, titulo: "IA que cria o mapa", texto: "Descreva a cena em uma conversa e o agente posiciona assets, gera o que falta e ajusta ao seu pedido. Você usa a sua própria chave e define limites de gasto.", cor: "text-gold" },
  { icone: BookOpenText, titulo: "Mundo e artigos", texto: "Uma wiki da campanha em Markdown: reinos, facções, lore. Escreva uma vez e libere para os jogadores quando quiser.", cor: "text-accent-hover" },
  { icone: Scroll, titulo: "Missões em pergaminho", texto: "Diário de missões com visual de livro de RPG: objetivos, recompensas e carimbos de status.", cor: "text-gold" },
  { icone: Skull, titulo: "Fichas e NPCs", texto: "NPCs, inimigos, pessoas importantes e itens com foto e anotações. Libere cada ficha para todos ou só para um jogador.", cor: "text-accent-hover" },
  { icone: EyeOff, titulo: "Segredos do mestre", texto: "Notas por sessão, por jogador e da campanha, trancadas. Ninguém além de você vê.", cor: "text-gold" },
  { icone: Users, titulo: "Mesas e convites", texto: "Cada campanha é uma mesa, com status, sessões e jogadores. Convide por código de 6 caracteres.", cor: "text-accent-hover" },
  { icone: Dices, titulo: "Marcas de Pacto", texto: "Enigmas imersivos com cifras, morse, runas e efeitos de tela que tornam a sessão inesquecível.", cor: "text-gold" },
];

const PASSOS = [
  { n: "1", titulo: "Crie a mesa", texto: "Nome, sistema e uma cor. Dá para começar em dez segundos." },
  { n: "2", titulo: "Construa o mundo", texto: "Mapas, artigos, missões e fichas, com a IA ajudando onde você quiser." },
  { n: "3", titulo: "Convide e jogue", texto: "Passe o código. Cada jogador vê só o que você liberar." },
];

/* ---------- página ---------- */

export default function Landing() {
  const { user } = useAuth();
  const entrada = user ? "/mesas" : "/login";
  const rotuloEntrada = user ? "Abrir minhas mesas" : "Entrar";

  return (
    <div className="relative flex-1 overflow-x-clip">
      {/* Navegação */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide">
            <Sparkles size={18} className="text-gold" /> RPG Workspace
          </Link>
          <div className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#mestre-jogador" className="hover:text-foreground">Mestre e jogador</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href={entrada} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
              {rotuloEntrada}
            </Link>
          </div>
        </nav>
      </header>

      <Hero entrada={entrada} logado={!!user} />
      <Marquee />
      <ComoFunciona />
      <Recursos />
      <DemoMapa />
      <MestreJogador />
      <CtaFinal entrada={entrada} logado={!!user} />

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        <p className="font-display tracking-wide">RPG Workspace</p>
        <p>Suas mesas, campanhas e personagens em um só lugar.</p>
      </footer>
    </div>
  );
}

/* ---------- seções ---------- */

function Hero({ entrada, logado }: { entrada: string; logado: boolean }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* fundo: gradientes + brasas */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_-10%,color-mix(in_srgb,var(--accent)_38%,transparent),transparent_60%),radial-gradient(ellipse_at_85%_70%,color-mix(in_srgb,var(--gold)_16%,transparent),transparent_50%)]" />
      <Brasas />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
        <div>
          <p className="anim-surgir mb-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-card/60 px-3 py-1 text-xs font-medium uppercase tracking-widest text-gold backdrop-blur">
            <Sparkles size={12} /> O workspace do mestre de RPG
          </p>
          <h1 className="anim-surgir font-display text-4xl font-bold leading-tight tracking-wide sm:text-5xl lg:text-6xl" style={{ "--d": "100ms" } as React.CSSProperties}>
            Sua campanha inteira,{" "}
            <span className="bg-gradient-to-r from-accent-hover via-accent-soft to-gold bg-clip-text text-transparent">em um só lugar.</span>
          </h1>
          <p className="anim-surgir mt-6 max-w-xl text-lg text-muted" style={{ "--d": "220ms" } as React.CSSProperties}>
            Organize mesas, mapas, mundo, missões e fichas. Deixe a IA montar cenas por conversa e entregue aos jogadores só o que você quiser que eles vejam.
          </p>
          <div className="anim-surgir mt-8 flex flex-wrap gap-3" style={{ "--d": "340ms" } as React.CSSProperties}>
            <Link href={entrada} className={btnPrimario}>{logado ? "Abrir minhas mesas" : "Começar agora"}</Link>
            <a href="#como-funciona" className={btnSecundario}>Ver como funciona</a>
          </div>
          <ul className="anim-surgir mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted" style={{ "--d": "460ms" } as React.CSSProperties}>
            <li>✦ Para mestres e jogadores</li>
            <li>✦ Qualquer sistema</li>
            <li>✦ Entre por código de convite</li>
          </ul>
        </div>
        <HeroMock />
      </div>
    </section>
  );
}

// Maquete flutuante do produto: cards de mesa e um mini mapa.
function HeroMock() {
  return (
    <div className="relative mx-auto h-[26rem] w-full max-w-md anim-surgir" style={{ "--d": "300ms" } as React.CSSProperties} aria-hidden>
      <div className="absolute inset-0 rounded-3xl bg-accent/20 blur-3xl" />
      <div className="absolute left-0 top-4 w-64 rounded-2xl border border-border bg-card/90 p-4 shadow-2xl backdrop-blur" style={{ animation: "flutuar 7s ease-in-out infinite" }}>
        <div className="mb-3 h-2 rounded-full bg-gradient-to-r from-accent to-gold" />
        <div className="flex items-center justify-between"><b className="font-display">O Juramento de Cinzas</b><span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-semibold text-ok">Ativa</span></div>
        <p className="mt-1 text-xs text-muted">D&amp;D 5e · 4 jogadores · 12 sessões</p>
        <div className="mt-3 flex gap-1.5">{["bg-accent", "bg-gold", "bg-ok", "bg-danger"].map((c) => <span key={c} className={`h-6 w-6 rounded-full ${c} ring-2 ring-card`} />)}</div>
      </div>
      <div className="absolute right-0 top-28 w-72 rounded-2xl border border-border bg-card/90 p-3 shadow-2xl backdrop-blur" style={{ animation: "flutuar 9s ease-in-out infinite", animationDelay: "-3s" }}>
        <MiniMapa />
      </div>
      <div className="absolute bottom-2 left-6 flex items-center gap-2 rounded-xl border border-gold/40 bg-card/90 px-3 py-2 text-xs shadow-xl backdrop-blur" style={{ animation: "flutuar 8s ease-in-out infinite", animationDelay: "-5s" }}>
        <Dices size={16} className="text-gold" /> Marca revelada: <b className="text-gold">Fio Partido</b>
      </div>
    </div>
  );
}

function MiniMapa({ animar = false }: { animar?: boolean }) {
  // grade 8x5 com salas; as células aparecem em cascata
  const salas = new Set([9, 10, 11, 17, 18, 19, 20, 21, 25, 26, 27, 28, 29, 13, 14, 22, 30]);
  return (
    <div className="grid grid-cols-8 gap-0.5 rounded-lg bg-background p-1.5">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className={`aspect-square rounded-[3px] ${salas.has(i) ? "bg-gradient-to-br from-gold/70 to-accent/60" : "bg-card-2"} ${animar ? "anim-surgir" : ""}`}
          style={animar ? ({ "--d": `${i * 35}ms` } as React.CSSProperties) : undefined}
        />
      ))}
    </div>
  );
}

function Marquee() {
  const itens = ["Mapas", "Artigos", "Missões", "Fichas", "Segredos", "Sessões", "Convites", "IA", "Exportar para VTT", "Enigmas"];
  const fita = [...itens, ...itens];
  return (
    <div className="overflow-hidden border-y border-border bg-card/40 py-3" aria-hidden>
      <div className="flex w-max gap-10 font-display text-sm uppercase tracking-[0.25em] text-muted" style={{ animation: "rolar 38s linear infinite" }}>
        {fita.map((t, i) => <span key={i} className="flex items-center gap-10">{t}<span className="text-gold">✦</span></span>)}
      </div>
    </div>
  );
}

function Titulo({ sobre, titulo, texto }: { sobre: string; titulo: string; texto?: string }) {
  return (
    <Revelar className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold">{sobre}</p>
      <h2 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">{titulo}</h2>
      {texto && <p className="mt-4 text-muted">{texto}</p>}
    </Revelar>
  );
}

function ComoFunciona() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24 sm:px-6">
      <Titulo sobre="O que é" titulo="Do primeiro mapa à última sessão" texto="O RPG Workspace é onde o mestre prepara a campanha e onde os jogadores acompanham o que foi liberado. Sem planilhas, pastas soltas ou mensagens perdidas." />
      <div className="relative grid gap-6 md:grid-cols-3">
        <div className="absolute left-[16%] right-[16%] top-8 hidden border-t border-dashed border-gold/40 md:block" aria-hidden />
        {PASSOS.map((p, i) => (
          <Revelar key={p.n} atraso={i * 140}>
            <div className="elevar relative h-full rounded-2xl border border-border bg-card p-6 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-background font-display text-2xl text-gold">{p.n}</span>
              <h3 className="mb-2 text-lg font-semibold">{p.titulo}</h3>
              <p className="text-sm text-muted">{p.texto}</p>
            </div>
          </Revelar>
        ))}
      </div>
    </section>
  );
}

function Recursos() {
  return (
    <section id="recursos" className="relative scroll-mt-16 bg-card/30 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Titulo sobre="Recursos" titulo="Tudo que a sua mesa precisa" texto="Cada ferramenta vive dentro da mesa e conversa com as outras." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map((r, i) => (
            <Revelar key={r.titulo} atraso={(i % 4) * 90}>
              <article className="elevar group h-full rounded-2xl border border-border bg-card p-5">
                <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-background ${r.cor} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  <r.icone size={22} />
                </span>
                <h3 className="mb-2 font-semibold">{r.titulo}</h3>
                <p className="text-sm leading-relaxed text-muted">{r.texto}</p>
              </article>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

// Demonstração: o mestre descreve, o mapa aparece.
function DemoMapa() {
  const frases = FRASES_MAPA;
  const txt = useDigitar(frases, 38);
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <Titulo sobre="IA criadora de mapas" titulo="Descreva. A cena aparece." texto="Converse com o agente e ele monta a cena com assets, gera o que não existe e deixa tudo editável. Depois exporte para o seu VTT." />
      <Revelar>
        <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3 border-b border-border p-5 md:border-b-0 md:border-r">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold"><WandSparkles size={14} /> Chat do mestre</p>
            <div className="min-h-24 rounded-xl rounded-tl-sm bg-accent/20 p-3 text-sm">
              {txt}<span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-accent-hover" style={{ animation: "brilho 1s steps(1) infinite" }} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-ok" style={{ animation: "brilho 1.4s infinite" }} /> Posicionando assets…</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[["Biblioteca", ImageIcon], ["Sua chave", KeyRound], ["VTT", Download]].map(([t, I]) => {
                const Icone = I as LucideIcon;
                return <span key={t as string} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted"><Icone size={12} /> {t as string}</span>;
              })}
            </div>
          </div>
          <div className="bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_70%)] p-5">
            <MiniMapa animar />
          </div>
        </div>
      </Revelar>
    </section>
  );
}

function MestreJogador() {
  const [papel, setPapel] = useState<"mestre" | "jogador">("mestre");
  const dados = {
    mestre: {
      icone: Swords,
      titulo: "Para o mestre",
      itens: ["Cria e edita mapas, artigos, missões e fichas", "Decide o que cada jogador pode ver", "Guarda segredos por sessão e por jogador", "Gera cenas e assets com IA", "Exporta mapas para o VTT"],
    },
    jogador: {
      icone: UserRound,
      titulo: "Para o jogador",
      itens: ["Entra na mesa com um código de convite", "Vê só o que o mestre liberou", "Mantém suas fichas e anotações privadas", "Acompanha mapas, missões e resumos de sessão", "Nunca vê um segredo, mesmo por engano"],
    },
  }[papel];
  return (
    <section id="mestre-jogador" className="scroll-mt-16 bg-card/30 py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Titulo sobre="Duas visões" titulo="Mesmo mundo, olhares diferentes" />
        <Revelar>
          <div className="mx-auto mb-6 flex w-fit rounded-full border border-border bg-card p-1" role="tablist">
            {(["mestre", "jogador"] as const).map((p) => (
              <button key={p} role="tab" aria-selected={papel === p} onClick={() => setPapel(p)}
                className={`rounded-full px-6 py-2 text-sm font-medium capitalize ${papel === p ? "bg-accent text-white shadow-md shadow-accent/40" : "text-muted hover:text-foreground"}`}>
                {p}
              </button>
            ))}
          </div>
          <div key={papel} className="anim-surgir rounded-2xl border border-border bg-card p-8">
            <h3 className="mb-5 flex items-center gap-3 font-display text-2xl"><dados.icone className="text-gold" /> {dados.titulo}</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {dados.itens.map((t, i) => (
                <li key={t} className="anim-surgir flex gap-3 text-sm" style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
                  <span className="mt-0.5 text-gold">✦</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </Revelar>
      </div>
    </section>
  );
}

function CtaFinal({ entrada, logado }: { entrada: string; logado: boolean }) {
  return (
    <section className="relative isolate overflow-hidden py-28 text-center">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_100%,color-mix(in_srgb,var(--accent)_35%,transparent),transparent_65%)]" />
      <Brasas quantidade={30} />
      <Revelar className="mx-auto max-w-2xl px-4">
        <h2 className="font-display text-3xl font-bold tracking-wide sm:text-5xl">A próxima sessão começa aqui.</h2>
        <p className="mt-4 text-muted">Crie sua primeira mesa em segundos ou entre em uma com o código do seu mestre.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={entrada} className={btnPrimario}>{logado ? "Abrir minhas mesas" : "Criar minha conta"}</Link>
          {!logado && <Link href="/login" className={btnSecundario}>Já tenho conta</Link>}
        </div>
      </Revelar>
    </section>
  );
}
