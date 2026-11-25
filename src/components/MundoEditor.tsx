"use client";

import { useState } from "react";
import { salvarMundo, type Bloco, type ItemCartao, type Mundo, type Secao } from "@/lib/mundo";

/** Editor do mestre: cadastra título, seções e blocos do Mundo sem escrever JSON. */

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent-hover focus:outline-none";
const botao = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50 disabled:opacity-40";
const mini = "rounded-md border border-border px-2 py-1 text-xs hover:bg-border/50 disabled:opacity-30";

const TIPOS: { tipo: Bloco["tipo"]; rotulo: string; icone: string }[] = [
  { tipo: "texto", rotulo: "Texto", icone: "📝" },
  { tipo: "destaque", rotulo: "Destaque", icone: "💡" },
  { tipo: "cartoes", rotulo: "Cartões", icone: "🗂️" },
  { tipo: "tabela", rotulo: "Tabela", icone: "▦" },
];

const novoBloco = (tipo: Bloco["tipo"]): Bloco => {
  switch (tipo) {
    case "texto":
    case "destaque":
      return { tipo, texto: "" };
    case "cartoes":
      return { tipo, colunas: 2, itens: [{ titulo: "" }] };
    case "tabela":
      return { tipo, colunas: ["Coluna 1", "Coluna 2"], linhas: [["", ""]] };
  }
};

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const c = [...lista];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}
const trocar = <T,>(lista: T[], i: number, v: T) => lista.map((x, k) => (k === i ? v : x));
const remover = <T,>(lista: T[], i: number) => lista.filter((_, k) => k !== i);

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{texto}</span>
      {children}
    </label>
  );
}

function Controles({ i, total, onMover, onRemover }: { i: number; total: number; onMover: (d: -1 | 1) => void; onRemover: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button className={mini} disabled={i === 0} onClick={() => onMover(-1)} aria-label="Subir">↑</button>
      <button className={mini} disabled={i === total - 1} onClick={() => onMover(1)} aria-label="Descer">↓</button>
      <button className={`${mini} text-danger`} onClick={onRemover} aria-label="Remover">✕</button>
    </div>
  );
}

export default function MundoEditor({
  mesaId,
  inicial,
  onFechar,
}: {
  mesaId: string;
  inicial: Mundo;
  onFechar: () => void;
}) {
  const [m, setM] = useState<Mundo>(inicial);
  const [ativa, setAtiva] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const secao = m.secoes[ativa] as Secao | undefined;
  const setSecao = (s: Secao) => setM({ ...m, secoes: trocar(m.secoes, ativa, s) });

  function novaSecao() {
    const s: Secao = { id: `s${Date.now().toString(36)}`, titulo: "Nova seção", icone: "📖", blocos: [] };
    setM({ ...m, secoes: [...m.secoes, s] });
    setAtiva(m.secoes.length);
  }

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      await salvarMundo(mesaId, JSON.stringify(m));
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-hover/40 bg-accent/10 p-4">
        <div>
          <h2 className="text-lg font-bold">✍️ Editando o mundo</h2>
          <p className="text-sm text-muted">O que você salvar aqui é o que os jogadores desta mesa leem.</p>
        </div>
        <div className="flex gap-2">
          <button className={botao} onClick={onFechar}>Cancelar</button>
          <button
            onClick={salvar}
            disabled={salvando || !m.titulo.trim()}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar mundo"}
          </button>
        </div>
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Rotulo texto="Título do mundo">
          <input className={campo} value={m.titulo} onChange={(e) => setM({ ...m, titulo: e.target.value })} placeholder="Ex.: Conhecimento Público de Valgreth" />
        </Rotulo>
        <Rotulo texto="Subtítulo (opcional)">
          <input className={campo} value={m.subtitulo ?? ""} onChange={(e) => setM({ ...m, subtitulo: e.target.value })} />
        </Rotulo>
        <Rotulo texto="Introdução (Markdown, opcional)">
          <textarea className={`${campo} min-h-24`} value={m.introducao ?? ""} onChange={(e) => setM({ ...m, introducao: e.target.value })} />
        </Rotulo>
      </section>

      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <aside className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Seções</p>
          {m.secoes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setAtiva(i)}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                i === ativa ? "border-accent-hover bg-accent-hover/10 text-accent-hover" : "border-border bg-card hover:border-accent-hover/60"
              }`}
            >
              <span className="text-lg">{s.icone ?? "•"}</span>
              <span className="truncate">{s.titulo || "(sem título)"}</span>
            </button>
          ))}
          <button className={`${botao} w-full`} onClick={novaSecao}>+ Nova seção</button>
        </aside>

        {secao ? (
          <div className="min-w-0 space-y-4">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-[5rem_1fr]">
                  <Rotulo texto="Ícone">
                    <input className={campo} value={secao.icone ?? ""} onChange={(e) => setSecao({ ...secao, icone: e.target.value })} placeholder="📖" />
                  </Rotulo>
                  <Rotulo texto="Título da seção">
                    <input className={campo} value={secao.titulo} onChange={(e) => setSecao({ ...secao, titulo: e.target.value })} />
                  </Rotulo>
                </div>
                <Controles
                  i={ativa}
                  total={m.secoes.length}
                  onMover={(d) => {
                    setM({ ...m, secoes: mover(m.secoes, ativa, d) });
                    setAtiva(ativa + d);
                  }}
                  onRemover={() => {
                    setM({ ...m, secoes: remover(m.secoes, ativa) });
                    setAtiva(Math.max(0, ativa - 1));
                  }}
                />
              </div>
              <Rotulo texto="Resumo (opcional)">
                <input className={campo} value={secao.resumo ?? ""} onChange={(e) => setSecao({ ...secao, resumo: e.target.value })} />
              </Rotulo>
            </div>

            {secao.blocos.map((b, i) => (
              <BlocoEditor
                key={i}
                bloco={b}
                i={i}
                total={secao.blocos.length}
                onChange={(nb) => setSecao({ ...secao, blocos: trocar(secao.blocos, i, nb) })}
                onMover={(d) => setSecao({ ...secao, blocos: mover(secao.blocos, i, d) })}
                onRemover={() => setSecao({ ...secao, blocos: remover(secao.blocos, i) })}
              />
            ))}

            <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-border p-3">
              <span className="text-sm text-muted">Adicionar bloco:</span>
              {TIPOS.map((t) => (
                <button key={t.tipo} className={botao} onClick={() => setSecao({ ...secao, blocos: [...secao.blocos, novoBloco(t.tipo)] })}>
                  {t.icone} {t.rotulo}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted">
            Nenhuma seção ainda. Crie a primeira em “+ Nova seção”.
          </p>
        )}
      </div>
    </div>
  );
}

function BlocoEditor({
  bloco,
  i,
  total,
  onChange,
  onMover,
  onRemover,
}: {
  bloco: Bloco;
  i: number;
  total: number;
  onChange: (b: Bloco) => void;
  onMover: (d: -1 | 1) => void;
  onRemover: () => void;
}) {
  const info = TIPOS.find((t) => t.tipo === bloco.tipo)!;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-accent-hover/10 px-2.5 py-0.5 text-xs font-semibold text-accent-hover">
          {info.icone} {info.rotulo}
        </span>
        <Controles i={i} total={total} onMover={onMover} onRemover={onRemover} />
      </div>
      <Rotulo texto="Título do bloco (opcional)">
        <input className={campo} value={bloco.titulo ?? ""} onChange={(e) => onChange({ ...bloco, titulo: e.target.value })} />
      </Rotulo>

      {(bloco.tipo === "texto" || bloco.tipo === "destaque") && (
        <Rotulo texto="Texto (Markdown)">
          <textarea className={`${campo} min-h-28`} value={bloco.texto} onChange={(e) => onChange({ ...bloco, texto: e.target.value })} />
        </Rotulo>
      )}

      {bloco.tipo === "cartoes" && (
        <>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <Rotulo texto="Colunas">
              <select className={campo} value={bloco.colunas ?? 2} onChange={(e) => onChange({ ...bloco, colunas: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </Rotulo>
            <Rotulo texto="Texto de abertura (opcional)">
              <input className={campo} value={bloco.texto ?? ""} onChange={(e) => onChange({ ...bloco, texto: e.target.value })} />
            </Rotulo>
          </div>
          {bloco.itens.map((it, k) => (
            <CartaoEditor
              key={k}
              item={it}
              k={k}
              total={bloco.itens.length}
              onChange={(n) => onChange({ ...bloco, itens: trocar(bloco.itens, k, n) })}
              onMover={(d) => onChange({ ...bloco, itens: mover(bloco.itens, k, d) })}
              onRemover={() => onChange({ ...bloco, itens: remover(bloco.itens, k) })}
            />
          ))}
          <button className={botao} onClick={() => onChange({ ...bloco, itens: [...bloco.itens, { titulo: "" }] })}>+ Cartão</button>
        </>
      )}

      {bloco.tipo === "tabela" && <TabelaEditor bloco={bloco} onChange={onChange} />}
    </div>
  );
}

function CartaoEditor({
  item,
  k,
  total,
  onChange,
  onMover,
  onRemover,
}: {
  item: ItemCartao;
  k: number;
  total: number;
  onChange: (i: ItemCartao) => void;
  onMover: (d: -1 | 1) => void;
  onRemover: () => void;
}) {
  const detalhes = item.detalhes ?? [];
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-[4rem_1fr_1fr]">
          <input className={campo} placeholder="🐉" value={item.icone ?? ""} onChange={(e) => onChange({ ...item, icone: e.target.value })} aria-label="Ícone" />
          <input className={campo} placeholder="Título" value={item.titulo} onChange={(e) => onChange({ ...item, titulo: e.target.value })} aria-label="Título" />
          <input className={campo} placeholder="Subtítulo" value={item.subtitulo ?? ""} onChange={(e) => onChange({ ...item, subtitulo: e.target.value })} aria-label="Subtítulo" />
        </div>
        <Controles i={k} total={total} onMover={onMover} onRemover={onRemover} />
      </div>
      <input
        className={campo}
        placeholder="Tags separadas por vírgula"
        value={(item.tags ?? []).join(", ")}
        onChange={(e) => onChange({ ...item, tags: e.target.value ? e.target.value.split(",").map((t) => t.trimStart()) : undefined })}
        onBlur={(e) => onChange({ ...item, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
        aria-label="Tags"
      />
      <textarea className={`${campo} min-h-20`} placeholder="Texto (Markdown)" value={item.texto ?? ""} onChange={(e) => onChange({ ...item, texto: e.target.value })} />
      {detalhes.map((d, j) => (
        <div key={j} className="flex gap-2">
          <input className={`${campo} max-w-40`} placeholder="Rótulo" value={d.rotulo} onChange={(e) => onChange({ ...item, detalhes: trocar(detalhes, j, { ...d, rotulo: e.target.value }) })} />
          <input className={campo} placeholder="Valor" value={d.valor} onChange={(e) => onChange({ ...item, detalhes: trocar(detalhes, j, { ...d, valor: e.target.value }) })} />
          <button className={`${mini} text-danger`} onClick={() => onChange({ ...item, detalhes: remover(detalhes, j) })} aria-label="Remover detalhe">✕</button>
        </div>
      ))}
      <button className={mini} onClick={() => onChange({ ...item, detalhes: [...detalhes, { rotulo: "", valor: "" }] })}>+ Detalhe (rótulo/valor)</button>
    </div>
  );
}

function TabelaEditor({ bloco, onChange }: { bloco: Extract<Bloco, { tipo: "tabela" }>; onChange: (b: Bloco) => void }) {
  const { colunas, linhas } = bloco;
  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="flex gap-2">
        {colunas.map((c, j) => (
          <div key={j} className="flex min-w-32 flex-1 gap-1">
            <input
              className={`${campo} font-semibold`}
              value={c}
              onChange={(e) => onChange({ ...bloco, colunas: trocar(colunas, j, e.target.value) })}
              aria-label={`Coluna ${j + 1}`}
            />
            {colunas.length > 1 && (
              <button
                className={`${mini} text-danger`}
                onClick={() => onChange({ ...bloco, colunas: remover(colunas, j), linhas: linhas.map((l) => remover(l, j)) })}
                aria-label="Remover coluna"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button className={mini} onClick={() => onChange({ ...bloco, colunas: [...colunas, ""], linhas: linhas.map((l) => [...l, ""]) })}>+ Col.</button>
      </div>
      {linhas.map((l, i) => (
        <div key={i} className="flex gap-2">
          {colunas.map((_, j) => (
            <input
              key={j}
              className={`${campo} min-w-32 flex-1`}
              value={l[j] ?? ""}
              onChange={(e) => onChange({ ...bloco, linhas: trocar(linhas, i, colunas.map((__, x) => (x === j ? e.target.value : (l[x] ?? "")))) })}
            />
          ))}
          <button className={`${mini} text-danger`} onClick={() => onChange({ ...bloco, linhas: remover(linhas, i) })} aria-label="Remover linha">✕</button>
        </div>
      ))}
      <button className={botao} onClick={() => onChange({ ...bloco, linhas: [...linhas, colunas.map(() => "")] })}>+ Linha</button>
    </div>
  );
}
