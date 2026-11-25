"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CLASSES } from "@/lib/dnd5e";
import { IconeEscola, corDaEscola } from "./ornamentos";
import { CATEGORIAS_MAGIA, buscarMagias, carregarMagias, categoriaDaMagia, componentesTexto, type CategoriaMagia, type MagiaCat } from "@/lib/regras/dnd5e/magias";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const ESCOLAS = ["abjuração", "adivinhação", "conjuração", "encantamento", "evocação", "ilusão", "necromancia", "transmutação"];
const CLASSES_CONJ = ["bardo", "bruxo", "clerigo", "druida", "feiticeiro", "mago", "paladino", "patrulheiro"];

const nomeNivel = (n: number) => (n === 0 ? "Truque" : `${n}º círculo`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Compêndio de magias do Livro do Jogador, no mesmo molde do catálogo de equipamento: ocupa a tela sem rolar a página,
 * com rolagem só na lista (à esquerda). Navega por categoria (dano, cura, suporte, controle...) e subcategoria, além de
 * busca, círculo, escola, classe, ritual e concentração. Com `onAdicionar`, cada magia ganha o botão de levá-la à
 * ficha (campos já preenchidos). Sem ele, é só leitura.
 */
export default function CompendioMagias({ classeInicial, circuloMax, jaNaFicha, avaliar, onAdicionar, onFechar, rotuloAdicionar = "Adicionar à ficha" }: {
  classeInicial?: string;
  /** Maior círculo que o personagem já conjura. Com ele aparece o filtro "só no meu nível" (ligado de início). */
  circuloMax?: number;
  /** ids de catálogo que a ficha já tem (o botão fica desativado). */
  jaNaFicha?: ReadonlySet<string>;
  /** Regras da ficha para a magia: se `ok` for falso, o botão fica desativado com o motivo. */
  avaliar?: (m: MagiaCat) => { ok: boolean; motivo?: string };
  onAdicionar?: (m: MagiaCat) => void;
  onFechar: () => void;
  rotuloAdicionar?: string;
}) {
  const [todas, setTodas] = useState<MagiaCat[] | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<number | "">("");
  const [escola, setEscola] = useState("");
  const [classe, setClasse] = useState(CLASSES_CONJ.includes(classeInicial ?? "") ? classeInicial! : "");
  const [ritual, setRitual] = useState(false);
  const [concentracao, setConcentracao] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaMagia | "">("");
  const [sub, setSub] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [soMeuNivel, setSoMeuNivel] = useState(true);
  const limite = circuloMax !== undefined && soMeuNivel ? circuloMax : undefined;
  // o portal precisa do `document`: só existe no navegador
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    let vivo = true;
    carregarMagias().then((l) => vivo && setTodas(l)).catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, []);
  // a ficha por trás não rola enquanto o compêndio está aberto (só a lista dentro dele)
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const classes = useMemo(() => new Map((todas ?? []).map((m) => [m.id, categoriaDaMagia(m)])), [todas]);

  // filtros comuns (sem a categoria): servem para contar as categorias e subcategorias
  const base = useMemo(
    () => (todas ? buscarMagias(todas, { texto, nivel: nivel === "" ? undefined : nivel, escola: escola || undefined, classe: classe || undefined, ritual, concentracao }).filter((m) => limite === undefined || m.nivel <= limite) : []),
    [todas, texto, nivel, escola, classe, ritual, concentracao, limite],
  );
  const contagem = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of base) { const k = classes.get(m.id)!.categoria; c.set(k, (c.get(k) ?? 0) + 1); }
    return c;
  }, [base, classes]);
  const subs = useMemo(() => {
    const c = new Map<string, number>();
    if (categoria) for (const m of base) { const k = classes.get(m.id)!; if (k.categoria === categoria) c.set(k.sub, (c.get(k.sub) ?? 0) + 1); }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [base, classes, categoria]);

  const resultado = useMemo(
    () => base.filter((m) => { const k = classes.get(m.id)!; return (!categoria || k.categoria === categoria) && (!sub || k.sub === sub); }),
    [base, classes, categoria, sub],
  );
  const grupos = useMemo(() => {
    // sem categoria escolhida agrupa por categoria; com ela, por subcategoria
    const m = new Map<string, MagiaCat[]>();
    const ordem = categoria ? subs.map(([s]) => s) : [...CATEGORIAS_MAGIA];
    for (const g of ordem) m.set(g, []);
    for (const x of resultado) {
      const k = classes.get(x.id)!;
      const chave: string = categoria ? k.sub : k.categoria;
      if (!m.has(chave)) m.set(chave, []);
      m.get(chave)!.push(x);
    }
    return [...m.entries()].filter(([, l]) => l.length > 0).map(([nome, l]) => [nome, l.sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, "pt-BR"))] as const);
  }, [resultado, classes, categoria, subs]);

  const sel = resultado.find((m) => m.id === aberta) ?? resultado[0];
  const selClasse = sel ? classes.get(sel.id) : undefined;
  const avaliacao = sel && onAdicionar ? avaliar?.(sel) : undefined;

  if (!montado) return null;
  // Portal no body: ancestrais com transform/animação (a ficha) prendem o "fixed" ao próprio bloco e cortam o diálogo.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Compêndio de magias">
      <div className="ficha-rpg flex h-full max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-gold/50 bg-card shadow-xl sm:h-[92dvh]">
        <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <h2 className="font-display text-lg font-bold text-gold">Compêndio de magias</h2>
          <span className="text-xs text-muted">{todas ? `${resultado.length} de ${todas.length}` : ""}</span>
          <button onClick={onFechar} aria-label="Fechar" className="ml-auto rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar pelo nome…" aria-label="Buscar magia" className={`${campo} min-w-40 flex-1`} autoFocus />
          <select value={nivel} onChange={(e) => setNivel(e.target.value === "" ? "" : Number(e.target.value))} className={campo} aria-label="Círculo">
            <option value="">Todos os círculos</option>
            {Array.from({ length: 10 }, (_, n) => <option key={n} value={n} disabled={limite !== undefined && n > limite}>{nomeNivel(n)}</option>)}
          </select>
          {circuloMax !== undefined && (
            <label className="flex items-center gap-1 text-xs text-muted" title={`Mostra só truques e magias até o ${circuloMax}º círculo, o máximo que o personagem conjura agora.`}>
              <input type="checkbox" checked={soMeuNivel} onChange={(e) => { setSoMeuNivel(e.target.checked); if (e.target.checked && nivel !== "" && nivel > circuloMax) setNivel(""); }} />Só no meu nível
            </label>
          )}
          <select value={escola} onChange={(e) => setEscola(e.target.value)} className={campo} aria-label="Escola">
            <option value="">Todas as escolas</option>
            {ESCOLAS.map((e) => <option key={e} value={e}>{cap(e)}</option>)}
          </select>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} className={campo} aria-label="Classe">
            <option value="">Todas as classes</option>
            {CLASSES.filter((c) => CLASSES_CONJ.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-muted" title="Ritual: a magia pode ser conjurada como ritual (leva 10 minutos a mais) sem gastar espaço de magia, se a classe permitir."><input type="checkbox" checked={ritual} onChange={(e) => setRitual(e.target.checked)} />Ritual</label>
          <label className="flex items-center gap-1 text-xs text-muted" title="Concentração: a magia dura enquanto você se concentra; conjurar outra magia de concentração ou sofrer dano pode encerrá-la."><input type="checkbox" checked={concentracao} onChange={(e) => setConcentracao(e.target.checked)} />Concentração</label>
        </div>

        <nav role="tablist" aria-label="Categorias de magia" className="flex flex-wrap gap-1 border-b border-border px-4 pt-2">
          <button role="tab" aria-selected={categoria === ""} onClick={() => { setCategoria(""); setSub(""); }} className={`rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${categoria === "" ? "border-gold/60 bg-card-2 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}>
            Todas <span className="text-[10px] opacity-70">{base.length}</span>
          </button>
          {CATEGORIAS_MAGIA.map((c) => (
            <button key={c} role="tab" aria-selected={categoria === c} onClick={() => { setCategoria(c); setSub(""); }} className={`rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${categoria === c ? "border-gold/60 bg-card-2 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}>
              {c} <span className="text-[10px] opacity-70">{contagem.get(c) ?? 0}</span>
            </button>
          ))}
        </nav>
        {categoria && subs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5 text-xs" aria-label={`Subcategorias de ${categoria}`}>
            <button aria-pressed={sub === ""} onClick={() => setSub("")} className={`rounded-full border px-2.5 py-0.5 ${sub === "" ? "border-gold bg-gold/20 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}>Todas</button>
            {subs.map(([s, n]) => (
              <button key={s} aria-pressed={sub === s} onClick={() => setSub(s)} className={`rounded-full border px-2.5 py-0.5 ${sub === s ? "border-gold bg-gold/20 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}>{s} <span className="opacity-70">{n}</span></button>
            ))}
          </div>
        )}

        {erro && <p className="p-4 text-sm text-danger">Não foi possível carregar o catálogo de magias.</p>}
        {!todas && !erro && <p className="p-4 text-sm text-muted">Carregando magias…</p>}

        {todas && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            <div className="min-h-0 flex-[2] overflow-y-auto overscroll-contain border-b border-border md:w-80 md:flex-none md:border-b-0 md:border-r">
              {grupos.map(([nome, lista]) => (
                <section key={nome}>
                  <h3 className="sticky top-0 z-10 border-b border-gold/20 bg-card px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.18em] text-gold">{nome} <span className="font-normal text-muted">({lista.length})</span></h3>
                  <ul>
                    {lista.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => setAberta(m.id)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gold/10 ${sel?.id === m.id ? "bg-gold/15 font-semibold text-gold" : ""}`}
                        >
                          <span className="truncate">{m.nome}</span>
                          <span className="shrink-0 text-xs text-muted">{m.nivel === 0 ? "T" : `${m.nivel}º`}{m.concentracao ? " · C" : ""}{m.ritual ? " · R" : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {resultado.length === 0 && <p className="px-3 py-3 text-sm text-muted">Nenhuma magia encontrada.</p>}
            </div>

            <article className="carta-escola min-h-0 flex-[3] overflow-hidden border-l-4 p-4 text-sm md:flex-1" style={{ "--escola-base": corDaEscola(sel?.escola ?? ""), borderLeftColor: "var(--escola)" } as React.CSSProperties}>
              {sel ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex flex-wrap items-start gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 font-display text-xl font-bold text-gold"><IconeEscola escola={sel.escola} size={18} />{sel.nome}</h3>
                      <p className="text-xs italic text-muted">{nomeNivel(sel.nivel)} de {sel.escola}{sel.ritual ? " (ritual)" : ""}{selClasse ? ` · ${selClasse.categoria}: ${selClasse.sub}` : ""}</p>
                    </div>
                    {onAdicionar && (
                      <button
                        disabled={jaNaFicha?.has(sel.id) || avaliacao?.ok === false}
                        title={avaliacao?.motivo}
                        onClick={() => onAdicionar(sel)}
                        className="ml-auto rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/25 disabled:opacity-50"
                      >
                        {jaNaFicha?.has(sel.id) ? "Já está na ficha" : rotuloAdicionar}
                      </button>
                    )}
                  </div>
                  {avaliacao?.ok === false && <p className="mt-2 text-xs text-danger">{avaliacao.motivo}</p>}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <dt className="font-semibold">Tempo de conjuração</dt><dd>{sel.tempo}</dd>
                    <dt className="font-semibold">Alcance</dt><dd>{sel.alcance}</dd>
                    <dt className="font-semibold">Componentes</dt><dd>{componentesTexto(sel.componentes)}</dd>
                    <dt className="font-semibold">Duração</dt><dd>{sel.duracao}</dd>
                    <dt className="font-semibold">Classes</dt><dd>{sel.classes.map((c) => CLASSES.find((x) => x.id === c)?.nome ?? c).join(", ")}</dd>
                  </dl>
                  {/* só a descrição rola, e apenas quando o texto não cabe: o cabeçalho da magia fica sempre visível */}
                  <div className="prose-magia mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{sel.descricao}</ReactMarkdown>
                    {sel.nivelSuperior && <p><strong>Em níveis superiores.</strong> {sel.nivelSuperior}</p>}
                  </div>
                </div>
              ) : <p className="text-muted">Escolha uma magia na lista.</p>}
            </article>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
