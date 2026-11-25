"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Backpack, BookOpen, BookUser, ChevronLeft, ChevronRight, Medal, ScrollText, Search, Sparkles, Swords, Users, WandSparkles, X, Zap, type LucideIcon } from "lucide-react";
import {
  buscarNoLivro, carregarCapitulo, extrairSumario, indexarSecoes, semAcento,
  type CapituloLivro, type EntradaBusca, type Livro, type SecaoLivro,
} from "@/lib/livros";
import { carregarMagias, type MagiaCat } from "@/lib/regras/dnd5e/magias";
import LivroMarkdown from "./LivroMarkdown";
import NavegadorMagias from "./NavegadorMagias";

const ICONES: Record<string, LucideIcon> = {
  regras: ScrollText, magias: Sparkles, conjuracao: WandSparkles, classes: Swords,
  racas: Users, antecedentes: BookUser, talentos: Medal, equipamento: Backpack,
};
/** Ícone do capítulo; fica fora do render para o React não recriar o componente a cada passada. */
function IconeCapitulo({ id, className }: { id: string; className?: string }) {
  const Icone = ICONES[id] ?? BookOpen;
  return <Icone aria-hidden className={className} />;
}

const campo = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** Local atual no livro: capítulo (ou início) e a seção/magia aberta. Vai no hash da URL para poder ser compartilhado. */
type Lugar = { cap: string | null; sec?: string };

function lerHash(livro: Livro): Lugar {
  if (typeof window === "undefined") return { cap: null };
  const [c, s] = decodeURIComponent(window.location.hash.slice(1)).split("/");
  return livro.capitulos.some((x) => x.id === c) ? { cap: c, sec: s || undefined } : { cap: null };
}

/** Leitor de um livro: início com consulta rápida, capítulos com lista de seções, busca no livro todo. */
export default function LeitorLivro({ livro }: { livro: Livro }) {
  const [lugar, setLugar] = useState<Lugar>(() => lerHash(livro));
  const [dados, setDados] = useState<Record<string, SecaoLivro[]>>({});
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState<{ entradas: EntradaBusca[]; magias: MagiaCat[] } | null>(null);
  const [filtroLista, setFiltroLista] = useState("");
  const topo = useRef<HTMLDivElement>(null);

  const capitulo = livro.capitulos.find((c) => c.id === lugar.cap);
  const secoes = capitulo ? dados[capitulo.id] : undefined;
  const termo = busca.trim();
  const buscando = termo.length >= 2;

  function ir(cap: string | null, sec?: string) {
    setLugar({ cap, sec });
    setFiltroLista("");
    setBusca("");
    window.history.replaceState(null, "", cap ? `#${cap}${sec ? `/${sec}` : ""}` : window.location.pathname + window.location.search);
    requestAnimationFrame(() => topo.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  // Carrega o capítulo aberto (um import por capítulo; o resto do livro não pesa).
  useEffect(() => {
    if (!capitulo || capitulo.tipo !== "texto" || dados[capitulo.id]) return;
    let vivo = true;
    carregarCapitulo(livro.id, capitulo.id).then((s) => vivo && setDados((d) => ({ ...d, [capitulo.id]: s })));
    return () => { vivo = false; };
  }, [capitulo, dados, livro.id]);

  // A busca precisa de todos os capítulos: indexa uma vez, na primeira digitação.
  useEffect(() => {
    if (!buscando || indice) return;
    let vivo = true;
    (async () => {
      const textos = livro.capitulos.filter((c) => c.tipo === "texto");
      const [listas, magias] = await Promise.all([Promise.all(textos.map((c) => carregarCapitulo(livro.id, c.id))), carregarMagias()]);
      if (!vivo) return;
      setIndice({ entradas: textos.flatMap((c, i) => indexarSecoes(c.id, listas[i])), magias });
    })();
    return () => { vivo = false; };
  }, [buscando, indice, livro]);

  return (
    <div className="space-y-5">
      <div ref={topo} className="scroll-mt-20" />
      <Capa livro={livro} busca={busca} onBusca={setBusca} />

      <nav aria-label="Capítulos" className="sticky top-14 z-10 -mx-4 border-b border-border bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-8 sm:px-8">
        <ul className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          <li><ChipCapitulo ativo={!lugar.cap && !buscando} onClick={() => ir(null)} icone={<BookOpen aria-hidden className="h-4 w-4" />} rotulo="Início" /></li>
          {livro.capitulos.map((c) => (
            <li key={c.id}><ChipCapitulo ativo={lugar.cap === c.id && !buscando} onClick={() => ir(c.id)} icone={<IconeCapitulo id={c.id} className="h-4 w-4" />} rotulo={c.titulo} /></li>
          ))}
        </ul>
      </nav>

      {buscando ? (
        <Resultados termo={termo} indice={indice} livro={livro} onAbrir={ir} />
      ) : !capitulo ? (
        <Inicio livro={livro} onAbrir={ir} />
      ) : capitulo.tipo === "magias" ? (
        <div className="space-y-4">
          <CabecalhoCapitulo capitulo={capitulo} />
          <NavegadorMagias aberta={lugar.sec} onAbrir={(id) => ir(capitulo.id, id)} />
        </div>
      ) : !secoes ? (
        <p className="text-sm text-muted">Carregando {capitulo.titulo.toLowerCase()}…</p>
      ) : (
        <Capitulo
          capitulo={capitulo}
          secoes={secoes}
          atualId={lugar.sec}
          filtro={filtroLista}
          onFiltro={setFiltroLista}
          onAbrir={(sec) => ir(capitulo.id, sec)}
        />
      )}
    </div>
  );
}

// ---------- capa e navegação ----------
function Capa({ livro, busca, onBusca }: { livro: Livro; busca: string; onBusca: (v: string) => void }) {
  return (
    <section className="livro-capa relative overflow-hidden rounded-3xl border-2 border-gold/40 p-5 sm:p-7">
      <BookOpen aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-gold opacity-10" strokeWidth={1} />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{livro.subtitulo}</p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-wide sm:text-4xl">{livro.titulo}</h2>
          <span aria-hidden className="filete mt-3 block w-40" />
        </div>
        <div className="relative w-full sm:w-96">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar no livro: regra, classe, magia, item…"
            aria-label={`Buscar em ${livro.titulo}`}
            className={`${campo} w-full pl-9 pr-9`}
          />
          {busca && (
            <button onClick={() => onBusca("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    </section>
  );
}

function ChipCapitulo({ ativo, onClick, icone, rotulo }: { ativo: boolean; onClick: () => void; icone: React.ReactNode; rotulo: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${ativo ? "border-gold bg-gold/20 text-gold" : "border-border text-muted hover:border-gold/60 hover:text-foreground"}`}
    >
      {icone}{rotulo}
    </button>
  );
}

function CabecalhoCapitulo({ capitulo }: { capitulo: CapituloLivro }) {
  return (
    <header className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/50 bg-gold/10 text-gold"><IconeCapitulo id={capitulo.id} className="h-6 w-6" /></span>
      <div>
        <h3 className="font-display text-2xl font-bold">{capitulo.titulo}</h3>
        <p className="text-sm text-muted">{capitulo.resumo}</p>
      </div>
    </header>
  );
}

// ---------- início ----------
function Inicio({ livro, onAbrir }: { livro: Livro; onAbrir: (cap: string, sec?: string) => void }) {
  return (
    <div className="space-y-7">
      {livro.atalhos.length > 0 && (
        <section aria-labelledby="consulta-rapida">
          <h3 id="consulta-rapida" className="mb-2 flex items-center gap-2 font-display text-lg font-bold"><Zap aria-hidden className="h-4 w-4 text-gold" />Consulta rápida</h3>
          <div className="flex flex-wrap gap-2">
            {livro.atalhos.map((a) => (
              <button key={`${a.capitulo}/${a.secao}`} onClick={() => onAbrir(a.capitulo, a.secao)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-gold hover:text-gold">
                {a.rotulo}
              </button>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="capitulos">
        <h3 id="capitulos" className="mb-3 font-display text-lg font-bold">Capítulos</h3>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {livro.capitulos.map((c, i) => {
            return (
              <li key={c.id} className="anim-surgir" style={{ "--d": `${i * 40}ms` } as React.CSSProperties}>
                <button onClick={() => onAbrir(c.id)} className="livro-cartao flex h-full w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/50 bg-gold/10 text-gold"><IconeCapitulo id={c.id} className="h-6 w-6" /></span>
                  <span className="min-w-0">
                    <span className="block font-display text-base font-bold">{c.titulo}</span>
                    <span className="mt-0.5 block text-sm text-muted">{c.resumo}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------- capítulo de texto ----------
function Capitulo({ capitulo, secoes, atualId, filtro, onFiltro, onAbrir }: {
  capitulo: CapituloLivro;
  secoes: SecaoLivro[];
  atualId?: string;
  filtro: string;
  onFiltro: (v: string) => void;
  onAbrir: (sec: string) => void;
}) {
  const idx = Math.max(0, secoes.findIndex((s) => s.id === atualId));
  const atual = secoes[idx];
  const sumario = useMemo(() => (atual ? extrairSumario(atual.md).filter((i) => i.nivel >= 3) : []), [atual]);

  const q = semAcento(filtro).trim();
  const grupos = useMemo(() => {
    const lista: { grupo?: string; itens: SecaoLivro[] }[] = [];
    for (const s of secoes) {
      if (q && !semAcento(s.titulo).includes(q)) continue;
      const ultimo = lista.at(-1);
      if (ultimo && ultimo.grupo === s.grupo) ultimo.itens.push(s);
      else lista.push({ grupo: s.grupo, itens: [s] });
    }
    return lista;
  }, [secoes, q]);

  if (!atual) return <p className="text-sm text-muted">Este capítulo está vazio.</p>;
  const anterior = secoes[idx - 1];
  const proxima = secoes[idx + 1];

  return (
    <div className="space-y-4">
      <CabecalhoCapitulo capitulo={capitulo} />

      {/* Celular: um seletor no lugar da lista lateral. */}
      <select value={atual.id} onChange={(e) => onAbrir(e.target.value)} aria-label="Seção" className={`${campo} w-full lg:hidden`}>
        {grupos.length > 0 && secoes.some((s) => s.grupo)
          ? [...new Set(secoes.map((s) => s.grupo))].map((g) => (
              <optgroup key={g ?? "_"} label={g ?? "Geral"}>{secoes.filter((s) => s.grupo === g).map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}</optgroup>
            ))
          : secoes.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
      </select>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden self-start lg:sticky lg:top-28 lg:block" aria-label="Seções do capítulo">
          <div className="flex max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
            {secoes.length > 10 && (
              <div className="border-b border-border p-2">
                <input value={filtro} onChange={(e) => onFiltro(e.target.value)} placeholder="Filtrar seções…" aria-label="Filtrar seções" className={`${campo} w-full !py-1.5`} />
              </div>
            )}
            <ul className="flex-1 overflow-y-auto py-1">
              {grupos.map((g, gi) => (
                <li key={`${g.grupo ?? "_"}-${gi}`}>
                  {g.grupo && <p className="px-3 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-gold">{g.grupo}</p>}
                  <ul>
                    {g.itens.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => onAbrir(s.id)}
                          aria-current={s.id === atual.id ? "true" : undefined}
                          className={`block w-full border-l-2 px-3 py-1.5 text-left text-sm ${s.id === atual.id ? "border-gold bg-gold/15 font-semibold text-gold" : "border-transparent text-muted hover:bg-gold/5 hover:text-foreground"}`}
                        >{s.titulo}</button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {grupos.length === 0 && <li className="px-3 py-3 text-sm text-muted">Nenhuma seção.</li>}
            </ul>
          </div>
        </aside>

        <article className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <header>
            {atual.grupo && <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{atual.grupo}</p>}
            <h3 className="font-display text-2xl font-bold sm:text-3xl">{atual.titulo}</h3>
            <span aria-hidden className="filete mt-3 block w-32" />
          </header>

          {sumario.length >= 3 && (
            <details open={sumario.length <= 16} className="mt-4 rounded-xl border border-border bg-background/50 px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-wider text-muted">Nesta seção ({sumario.length})</summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {sumario.map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => document.getElementById(i.id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
                      className={`rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-gold hover:text-gold ${i.nivel >= 4 ? "text-muted" : "font-semibold"}`}
                    >{i.titulo}</button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-5"><LivroMarkdown texto={atual.md} /></div>

          <footer className="mt-8 flex items-stretch justify-between gap-3 border-t border-border pt-4 text-sm">
            {anterior ? (
              <button onClick={() => onAbrir(anterior.id)} className="flex min-w-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-left hover:border-gold hover:text-gold">
                <ChevronLeft aria-hidden className="h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block text-[0.65rem] uppercase text-muted">Anterior</span><span className="block truncate">{anterior.titulo}</span></span>
              </button>
            ) : <span />}
            {proxima && (
              <button onClick={() => onAbrir(proxima.id)} className="flex min-w-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-right hover:border-gold hover:text-gold">
                <span className="min-w-0"><span className="block text-[0.65rem] uppercase text-muted">Próxima</span><span className="block truncate">{proxima.titulo}</span></span><ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
              </button>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}

// ---------- resultados da busca ----------
function Resultados({ termo, indice, livro, onAbrir }: { termo: string; indice: { entradas: EntradaBusca[]; magias: MagiaCat[] } | null; livro: Livro; onAbrir: (cap: string, sec?: string) => void }) {
  const termos = useMemo(() => semAcento(termo).split(/\s+/).filter((t) => t.length > 1), [termo]);
  const textos = useMemo(() => (indice ? buscarNoLivro(indice.entradas, termo) : []), [indice, termo]);
  const magias = useMemo(() => (indice ? indice.magias.filter((m) => termos.every((t) => semAcento(m.nome).includes(t))).slice(0, 8) : []), [indice, termos]);
  const nomeCap = (id: string) => livro.capitulos.find((c) => c.id === id)?.titulo ?? id;

  if (!indice) return <p className="text-sm text-muted">Procurando em todo o livro…</p>;
  if (!textos.length && !magias.length) return <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted">Nada encontrado para “{termo}”. Tente menos palavras.</p>;

  return (
    <div className="space-y-5" role="region" aria-label="Resultados da busca" aria-live="polite">
      {magias.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold"><Sparkles aria-hidden className="h-4 w-4 text-gold" />Magias</h3>
          <ul className="flex flex-wrap gap-2">
            {magias.map((m) => (
              <li key={m.id}>
                <button onClick={() => onAbrir("magias", m.id)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-gold hover:text-gold">
                  {m.nome} <span className="text-xs text-muted">· {m.nivel === 0 ? "truque" : `${m.nivel}º círculo`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {textos.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-lg font-bold">No texto ({textos.length})</h3>
          <ul className="space-y-2">
            {textos.map(({ entrada: e, previa }) => {
              return (
                <li key={`${e.capitulo}/${e.secao}`}>
                  <button onClick={() => onAbrir(e.capitulo, e.secao)} className="livro-cartao flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left">
                    <IconeCapitulo id={e.capitulo} className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{e.titulo} <span className="text-xs font-normal text-muted">· {nomeCap(e.capitulo)}{e.grupo && e.grupo !== e.titulo ? ` · ${e.grupo}` : ""}</span></span>
                      <span className="livro-previa mt-0.5 block text-sm text-muted"><Destacar texto={previa} termos={termos} /></span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Marca os termos na prévia, ignorando acentos e maiúsculas (a prévia tem o mesmo comprimento do texto normalizado). */
function Destacar({ texto, termos }: { texto: string; termos: string[] }) {
  const normal = semAcento(texto);
  if (normal.length !== texto.length) return <>{texto}</>;
  const marcado = new Array<boolean>(texto.length).fill(false);
  for (const t of termos) for (let i = normal.indexOf(t); i >= 0; i = normal.indexOf(t, i + t.length)) marcado.fill(true, i, i + t.length);
  const partes: { t: string; m: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ult = partes.at(-1);
    if (ult && ult.m === marcado[i]) ult.t += texto[i];
    else partes.push({ t: texto[i], m: marcado[i] });
  }
  return <>{partes.map((p, i) => (p.m ? <mark key={i}>{p.t}</mark> : p.t))}</>;
}
