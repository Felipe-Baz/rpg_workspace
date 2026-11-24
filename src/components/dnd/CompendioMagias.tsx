"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import { CLASSES } from "@/lib/dnd5e";
import { IconeEscola, corDaEscola } from "./ornamentos";
import { buscarMagias, carregarMagias, componentesTexto, type MagiaCat } from "@/lib/regras/dnd5e/magias";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const ESCOLAS = ["abjuração", "adivinhação", "conjuração", "encantamento", "evocação", "ilusão", "necromancia", "transmutação"];
const CLASSES_CONJ = ["bardo", "bruxo", "clerigo", "druida", "feiticeiro", "mago", "paladino", "patrulheiro"];
const MAX_LISTA = 80;

const nomeNivel = (n: number) => (n === 0 ? "Truque" : `${n}º círculo`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Compêndio de magias do Livro do Jogador: busca por nome, círculo, escola e classe, com o cartão completo.
 * Com `onAdicionar`, cada magia ganha o botão de levá-la à ficha (campos já preenchidos). Sem ele, é só leitura.
 */
export default function CompendioMagias({ classeInicial, jaNaFicha, avaliar, onAdicionar, onFechar }: {
  classeInicial?: string;
  /** ids de catálogo que a ficha já tem (o botão fica desativado). */
  jaNaFicha?: ReadonlySet<string>;
  /** Regras da ficha para a magia: se `ok` for falso, o botão fica desativado com o motivo. */
  avaliar?: (m: MagiaCat) => { ok: boolean; motivo?: string };
  onAdicionar?: (m: MagiaCat) => void;
  onFechar: () => void;
}) {
  const [todas, setTodas] = useState<MagiaCat[] | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<number | "">("");
  const [escola, setEscola] = useState("");
  const [classe, setClasse] = useState(CLASSES_CONJ.includes(classeInicial ?? "") ? classeInicial! : "");
  const [ritual, setRitual] = useState(false);
  const [concentracao, setConcentracao] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarMagias().then((l) => vivo && setTodas(l)).catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, []);

  const resultado = useMemo(
    () => (todas ? buscarMagias(todas, { texto, nivel: nivel === "" ? undefined : nivel, escola: escola || undefined, classe: classe || undefined, ritual, concentracao }) : []),
    [todas, texto, nivel, escola, classe, ritual, concentracao],
  );
  const sel = resultado.find((m) => m.id === aberta) ?? resultado[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Compêndio de magias">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-gold/50 bg-card shadow-xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold text-gold">Compêndio de magias</h2>
          <span className="text-xs text-muted">{todas ? `${resultado.length} de ${todas.length}` : ""}</span>
          <button onClick={onFechar} aria-label="Fechar" className="ml-auto rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar pelo nome…" aria-label="Buscar magia" className={`${campo} min-w-40 flex-1`} autoFocus />
          <select value={nivel} onChange={(e) => setNivel(e.target.value === "" ? "" : Number(e.target.value))} className={campo} aria-label="Círculo">
            <option value="">Todos os círculos</option>
            {Array.from({ length: 10 }, (_, n) => <option key={n} value={n}>{nomeNivel(n)}</option>)}
          </select>
          <select value={escola} onChange={(e) => setEscola(e.target.value)} className={campo} aria-label="Escola">
            <option value="">Todas as escolas</option>
            {ESCOLAS.map((e) => <option key={e} value={e}>{cap(e)}</option>)}
          </select>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} className={campo} aria-label="Classe">
            <option value="">Todas as classes</option>
            {CLASSES.filter((c) => CLASSES_CONJ.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={ritual} onChange={(e) => setRitual(e.target.checked)} />Ritual</label>
          <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={concentracao} onChange={(e) => setConcentracao(e.target.checked)} />Concentração</label>
        </div>

        {erro && <p className="p-4 text-sm text-danger">Não foi possível carregar o catálogo de magias.</p>}
        {!todas && !erro && <p className="p-4 text-sm text-muted">Carregando magias…</p>}

        {todas && (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[18rem_1fr]">
            <ul className="max-h-48 overflow-y-auto border-b border-border md:max-h-none md:border-b-0 md:border-r">
              {resultado.slice(0, MAX_LISTA).map((m) => (
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
              {resultado.length > MAX_LISTA && <li className="px-3 py-2 text-xs text-muted">Mostrando {MAX_LISTA}; refine a busca para ver as demais.</li>}
              {resultado.length === 0 && <li className="px-3 py-3 text-sm text-muted">Nenhuma magia encontrada.</li>}
            </ul>

            <article className="carta-escola overflow-y-auto border-l-4 p-4 text-sm" style={{ "--escola-base": corDaEscola(sel?.escola ?? ""), borderLeftColor: "var(--escola)" } as React.CSSProperties}>
              {sel ? (
                <>
                  <div className="flex flex-wrap items-start gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 font-display text-xl font-bold text-gold"><IconeEscola escola={sel.escola} size={18} />{sel.nome}</h3>
                      <p className="text-xs italic text-muted">{nomeNivel(sel.nivel)} de {sel.escola}{sel.ritual ? " (ritual)" : ""}</p>
                    </div>
                    {onAdicionar && (
                      <button
                        disabled={jaNaFicha?.has(sel.id) || avaliar?.(sel).ok === false}
                        title={avaliar?.(sel).motivo}
                        onClick={() => onAdicionar(sel)}
                        className="ml-auto rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/25 disabled:opacity-50"
                      >
                        {jaNaFicha?.has(sel.id) ? "Já está na ficha" : "Adicionar à ficha"}
                      </button>
                    )}
                  </div>
                  {onAdicionar && avaliar?.(sel).ok === false && <p className="mt-2 text-xs text-danger">{avaliar(sel).motivo}</p>}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <dt className="font-semibold">Tempo de conjuração</dt><dd>{sel.tempo}</dd>
                    <dt className="font-semibold">Alcance</dt><dd>{sel.alcance}</dd>
                    <dt className="font-semibold">Componentes</dt><dd>{componentesTexto(sel.componentes)}</dd>
                    <dt className="font-semibold">Duração</dt><dd>{sel.duracao}</dd>
                    <dt className="font-semibold">Classes</dt><dd>{sel.classes.map((c) => CLASSES.find((x) => x.id === c)?.nome ?? c).join(", ")}</dd>
                  </dl>
                  <div className="prose-magia mt-3 space-y-2 leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{sel.descricao}</ReactMarkdown>
                    {sel.nivelSuperior && <p><strong>Em níveis superiores.</strong> {sel.nivelSuperior}</p>}
                  </div>
                </>
              ) : <p className="text-muted">Escolha uma magia na lista.</p>}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
