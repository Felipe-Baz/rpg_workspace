"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CLASSES } from "@/lib/dnd5e";
import { buscarMagias, carregarMagias, componentesTexto, type MagiaCat } from "@/lib/regras/dnd5e/magias";
import { IconeEscola, corDaEscola } from "../dnd/ornamentos";
import LivroMarkdown from "./LivroMarkdown";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const ESCOLAS = ["abjuração", "adivinhação", "conjuração", "encantamento", "evocação", "ilusão", "necromancia", "transmutação"];
const CLASSES_CONJ = ["bardo", "bruxo", "clerigo", "druida", "feiticeiro", "mago", "paladino", "patrulheiro"];
const POR_PAGINA = 60;
const FILTROS_NIVEL: [number | "", string][] = [["", "Todos"], [0, "Truques"], ...Array.from({ length: 9 }, (_, i): [number, string] => [i + 1, `${i + 1}º`])];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nomeNivel = (n: number) => (n === 0 ? "Truque" : `${n}º círculo`);

/** Compêndio de magias do Livro do Jogador, embutido na página (não é janela): lista filtrável + cartão da magia. */
export default function NavegadorMagias({ aberta, onAbrir }: { aberta?: string; onAbrir: (id: string) => void }) {
  const [todas, setTodas] = useState<MagiaCat[] | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<number | "">("");
  const [escola, setEscola] = useState("");
  const [classe, setClasse] = useState("");
  const [ritual, setRitual] = useState(false);
  const [concentracao, setConcentracao] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    let vivo = true;
    carregarMagias().then((l) => vivo && setTodas(l)).catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, []);

  const resultado = useMemo(
    () => (todas ? buscarMagias(todas, { texto, nivel: nivel === "" ? undefined : nivel, escola: escola || undefined, classe: classe || undefined, ritual, concentracao }) : []),
    [todas, texto, nivel, escola, classe, ritual, concentracao],
  );
  const sel = todas?.find((m) => m.id === aberta) ?? resultado[0];
  const filtrando = !!(texto || nivel !== "" || escola || classe || ritual || concentracao);
  const mudou = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimite(POR_PAGINA); };
  const limpar = () => { setTexto(""); setNivel(""); setEscola(""); setClasse(""); setRitual(false); setConcentracao(false); setLimite(POR_PAGINA); };

  if (erro) return <p className="text-sm text-danger">Não foi possível carregar o catálogo de magias.</p>;
  if (!todas) return <p className="text-sm text-muted">Carregando magias…</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={texto} onChange={(e) => mudou(setTexto)(e.target.value)} placeholder="Buscar magia pelo nome…" aria-label="Buscar magia" className={`${campo} w-full pl-9`} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Círculo">
          {FILTROS_NIVEL.map(([n, rotulo]) => (
            <button
              key={String(n)}
              onClick={() => mudou(setNivel)(n)}
              aria-pressed={nivel === n}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${nivel === n ? "border-gold bg-gold/20 text-gold" : "border-border text-muted hover:border-gold/60 hover:text-foreground"}`}
            >{rotulo}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={escola} onChange={(e) => mudou(setEscola)(e.target.value)} className={campo} aria-label="Escola">
            <option value="">Todas as escolas</option>
            {ESCOLAS.map((e) => <option key={e} value={e}>{cap(e)}</option>)}
          </select>
          <select value={classe} onChange={(e) => mudou(setClasse)(e.target.value)} className={campo} aria-label="Classe">
            <option value="">Todas as classes</option>
            {CLASSES.filter((c) => CLASSES_CONJ.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={ritual} onChange={(e) => mudou(setRitual)(e.target.checked)} />Ritual</label>
          <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={concentracao} onChange={(e) => mudou(setConcentracao)(e.target.checked)} />Concentração</label>
          <span className="ml-auto text-xs text-muted">{resultado.length} de {todas.length} magias</span>
          {filtrando && <button onClick={limpar} className="text-xs text-accent underline">Limpar filtros</button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <ul className="max-h-80 self-start overflow-y-auto rounded-2xl border border-border bg-card lg:sticky lg:top-28 lg:max-h-[calc(100dvh-9rem)]" aria-label="Magias">
          {resultado.slice(0, limite).map((m) => (
            <li key={m.id}>
              <button
                onClick={() => onAbrir(m.id)}
                aria-current={sel?.id === m.id}
                className={`carta-escola flex w-full items-center gap-2.5 border-l-4 px-3 py-2 text-left text-sm hover:bg-gold/10 ${sel?.id === m.id ? "bg-gold/15 font-semibold" : ""}`}
                style={{ "--escola-base": corDaEscola(m.escola), borderLeftColor: "var(--escola)" } as React.CSSProperties}
              >
                <span className="selo-circulo" aria-hidden>{m.nivel === 0 ? "T" : m.nivel}</span>
                <span className="min-w-0 flex-1 truncate">{m.nome}</span>
                <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-muted">{m.concentracao ? "C" : ""}{m.ritual ? " R" : ""}</span>
              </button>
            </li>
          ))}
          {resultado.length > limite && (
            <li><button onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full px-3 py-2 text-center text-xs font-semibold text-accent hover:bg-accent/10">Mostrar mais ({resultado.length - limite})</button></li>
          )}
          {resultado.length === 0 && <li className="px-3 py-4 text-sm text-muted">Nenhuma magia encontrada.</li>}
        </ul>

        {sel ? <CartaMagia magia={sel} /> : <p className="text-muted">Escolha uma magia na lista.</p>}
      </div>
    </div>
  );
}

function CartaMagia({ magia: m }: { magia: MagiaCat }) {
  return (
    <article className="carta-magia min-w-0 rounded-2xl border border-border p-5 shadow-sm sm:p-6" style={{ "--escola-base": corDaEscola(m.escola) } as React.CSSProperties}>
      <header className="flex flex-wrap items-start gap-3">
        <span className="selo-circulo !h-9 !w-9 !text-base" aria-hidden>{m.nivel === 0 ? "T" : m.nivel}</span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-gold"><IconeEscola escola={m.escola} size={20} />{m.nome}</h2>
          <p className="text-sm italic text-muted">{nomeNivel(m.nivel)} de {m.escola}{m.ritual ? " (ritual)" : ""}</p>
        </div>
        <div className="flex gap-1.5">
          {m.concentracao && <span className="selo-badge">Concentração</span>}
          {m.ritual && <span className="selo-badge">Ritual</span>}
        </div>
      </header>
      <span aria-hidden className="filete my-4 block" />
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <Dado rotulo="Tempo de conjuração" valor={m.tempo} />
        <Dado rotulo="Alcance" valor={m.alcance} />
        <Dado rotulo="Componentes" valor={componentesTexto(m.componentes)} />
        <Dado rotulo="Duração" valor={m.duracao} />
      </dl>
      <div className="mt-4"><LivroMarkdown texto={m.descricao} /></div>
      {m.nivelSuperior && <div className="mt-4"><LivroMarkdown texto={`> **Em níveis superiores.** ${m.nivelSuperior}`} /></div>}
      <footer className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-border pt-3 text-xs">
        <span className="text-muted">Classes:</span>
        {m.classes.map((c) => <span key={c} className="rounded-full border border-border px-2 py-0.5">{CLASSES.find((x) => x.id === c)?.nome ?? c}</span>)}
      </footer>
    </article>
  );
}

const Dado = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div className="rounded-lg bg-background/50 px-3 py-1.5">
    <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">{rotulo}</dt>
    <dd className="font-medium">{valor}</dd>
  </div>
);
