"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, BookOpen, ChevronLeft, ChevronRight, Heading1, Heading2, Italic, List, Minus, PencilLine, Plus, Quote, Trash2 } from "lucide-react";

// Livro de duas páginas para a história do personagem: pergaminho, lombada ao centro, capa de couro.
// Cada página aceita markdown (títulos, negrito, listas, citações); "Ler" mostra o texto formatado.
const pagina = "h-full min-h-[26rem] w-full resize-none bg-transparent px-6 py-5 font-serif text-[15px] leading-[1.75rem] text-[#3b2a1a] placeholder:text-[#3b2a1a]/40 focus:outline-none";
const linhas = { backgroundImage: "repeating-linear-gradient(transparent 0, transparent calc(1.75rem - 1px), rgba(120,80,30,0.18) calc(1.75rem - 1px), rgba(120,80,30,0.18) 1.75rem)", backgroundPositionY: "1.25rem" };
const ferramenta = "rounded-md border border-[#c9a45c55] p-1.5 text-[#e8d5a8] hover:bg-[#c9a45c22] disabled:opacity-40";

// Estilos do texto formatado (a página é sempre clara, então não dependem do tema do site).
const leitura = [
  "[&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:border-b [&_h1]:border-[#7a4e1e]/40 [&_h1]:pb-1 [&_h1]:text-center [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#5a2a0e]",
  "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#6b3a14]",
  "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#6b3a14]",
  "[&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#7a4e1e]/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[#5a4028]",
  "[&_hr]:my-3 [&_hr]:border-[#7a4e1e]/40 [&_strong]:font-bold [&_a]:underline [&_a]:text-[#7a2a0e]",
].join(" ");

type Formato = "h1" | "h2" | "lista" | "citacao" | "negrito" | "italico" | "linha";
const PREFIXO: Record<"h1" | "h2" | "lista" | "citacao", string> = { h1: "# ", h2: "## ", lista: "- ", citacao: "> " };

export default function LivroHistoria({
  paginas, titulo, nomePersonagem, onChange, onTitulo,
}: { paginas: string[]; titulo: string; nomePersonagem: string; onChange: (p: string[]) => void; onTitulo: (t: string) => void }) {
  const [folha, setFolha] = useState(0);
  const [lendo, setLendo] = useState(false);
  const [foco, setFoco] = useState(0);

  const total = Math.max(2, Math.ceil(paginas.length / 2) * 2);
  const lista = Array.from({ length: total }, (_, i) => paginas[i] ?? "");
  const folhas = total / 2;
  const f = Math.min(folha, folhas - 1);
  const editar = (i: number, v: string) => onChange(lista.map((t, k) => (k === i ? v : t)));
  const vazia = !lista[f * 2].trim() && !lista[f * 2 + 1].trim();

  // Aplica markdown na página em foco (limitada às duas páginas visíveis).
  function aplicar(tipo: Formato) {
    const i = Math.min(Math.max(foco, f * 2), f * 2 + 1);
    const ta = document.getElementById(`livro-pg-${i}`) as HTMLTextAreaElement | null;
    const texto = lista[i];
    const ini = ta?.selectionStart ?? texto.length;
    const fim = ta?.selectionEnd ?? texto.length;
    let novo = texto;
    let cursor = fim;
    if (tipo === "negrito" || tipo === "italico") {
      const m = tipo === "negrito" ? "**" : "*";
      const sel = texto.slice(ini, fim) || (tipo === "negrito" ? "texto em destaque" : "texto em itálico");
      novo = texto.slice(0, ini) + m + sel + m + texto.slice(fim);
      cursor = ini + m.length + sel.length + m.length;
    } else if (tipo === "linha") {
      const ins = (ini > 0 && texto[ini - 1] !== "\n" ? "\n" : "") + "\n---\n\n";
      novo = texto.slice(0, ini) + ins + texto.slice(fim);
      cursor = ini + ins.length;
    } else {
      const inicioLinha = texto.lastIndexOf("\n", ini - 1) + 1;
      const quebra = texto.indexOf("\n", inicioLinha);
      const fimLinha = quebra === -1 ? texto.length : quebra;
      const limpa = texto.slice(inicioLinha, fimLinha).replace(/^(#{1,3} |- |> )/, "");
      novo = texto.slice(0, inicioLinha) + PREFIXO[tipo] + limpa + texto.slice(fimLinha);
      cursor = inicioLinha + PREFIXO[tipo].length + limpa.length;
    }
    editar(i, novo);
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(cursor, cursor); });
  }

  const lado = (i: number, esq: boolean) => (
    <div
      className={`relative ${esq ? "rounded-l-md" : "rounded-r-md"}`}
      style={{ background: `linear-gradient(${esq ? 90 : 270}deg, #ead9b0 0%, #f4e8c8 70%, #dcc89a 100%)` }}
    >
      {lendo ? (
        <div className={`min-h-[26rem] px-6 py-5 pb-9 font-serif text-[15px] leading-[1.75rem] text-[#3b2a1a] ${leitura}`}>
          {lista[i].trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{lista[i]}</ReactMarkdown> : <p className="italic text-[#3b2a1a]/40">Página em branco.</p>}
        </div>
      ) : (
        <textarea
          id={`livro-pg-${i}`}
          value={lista[i]}
          onChange={(e) => editar(i, e.target.value)}
          onFocus={() => setFoco(i)}
          aria-label={`Página ${i + 1} da história`}
          placeholder={i === 0 ? "Era uma vez…  (use # para títulos, **negrito**, - listas)" : ""}
          className={pagina}
          style={linhas}
        />
      )}
      <span className={`pointer-events-none absolute bottom-2 text-xs italic text-[#3b2a1a]/50 ${esq ? "left-6" : "right-6"}`}>{i + 1}</span>
    </div>
  );

  const botoes: [Formato, string, React.ReactNode][] = [
    ["h1", "Título", <Heading1 key="h1" size={15} />], ["h2", "Subtítulo", <Heading2 key="h2" size={15} />],
    ["negrito", "Negrito", <Bold key="b" size={15} />], ["italico", "Itálico", <Italic key="i" size={15} />],
    ["lista", "Lista", <List key="l" size={15} />], ["citacao", "Citação", <Quote key="q" size={15} />],
    ["linha", "Linha divisória", <Minus key="m" size={15} />],
  ];

  return (
    <div>
      <div className="rounded-2xl p-3 shadow-2xl" style={{ background: "linear-gradient(135deg, #4a2a14, #2a170a)", border: "2px solid #c9a45c55" }}>
        <div className="pb-2">
          <input
            value={titulo}
            onChange={(e) => onTitulo(e.target.value)}
            placeholder={nomePersonagem ? `A Crônica de ${nomePersonagem}` : "Título do livro"}
            aria-label="Título do livro"
            className="w-full border-b border-transparent bg-transparent px-1 text-center font-display text-lg tracking-[0.2em] text-gold placeholder:text-gold/60 hover:border-gold/30 focus:border-gold focus:outline-none"
          />
        </div>
        <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
          {!lendo && botoes.map(([tipo, rotulo, icone]) => (
            <button key={tipo} onClick={() => aplicar(tipo)} title={rotulo} aria-label={rotulo} className={ferramenta}>{icone}</button>
          ))}
          <button onClick={() => setLendo(!lendo)} className={`${ferramenta} flex items-center gap-1 px-2.5 text-xs`}>
            {lendo ? <><PencilLine size={14} /> Editar</> : <><BookOpen size={14} /> Ler</>}
          </button>
        </div>
        <div className="relative grid gap-0 md:grid-cols-2" style={{ boxShadow: "inset 0 0 30px rgba(60,30,10,0.35)" }}>
          {lado(f * 2, true)}
          {lado(f * 2 + 1, false)}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-10 -translate-x-1/2 md:block" style={{ background: "linear-gradient(90deg, transparent, rgba(60,30,10,0.35) 48%, rgba(30,15,5,0.5) 50%, rgba(60,30,10,0.35) 52%, transparent)" }} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => setFolha(f - 1)} disabled={f === 0} aria-label="Folhas anteriores" className="rounded-md border border-border p-1 text-muted hover:text-foreground disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-xs text-muted">Páginas {f * 2 + 1}–{f * 2 + 2} de {total}</span>
          <button onClick={() => setFolha(f + 1)} disabled={f >= folhas - 1} aria-label="Próximas folhas" className="rounded-md border border-border p-1 text-muted hover:text-foreground disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { onChange([...lista, "", ""]); setFolha(folhas); }} className="flex items-center gap-1 text-accent-hover hover:underline"><Plus size={14} /> Novas folhas</button>
          {folhas > 1 && vazia && (
            <button onClick={() => { onChange(lista.filter((_, k) => k < f * 2 || k > f * 2 + 1)); setFolha(Math.max(0, f - 1)); }} className="flex items-center gap-1 text-muted hover:text-danger"><Trash2 size={14} /> Remover folhas vazias</button>
          )}
        </div>
      </div>
    </div>
  );
}
