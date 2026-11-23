"use client";

import { useMemo, useRef, useState } from "react";
import Markdown from "./Markdown";
import {
  lerMundoJson,
  restaurarMundoPadrao,
  salvarMundo,
  useMundo,
  type Bloco,
  type ItemCartao,
  type Secao,
} from "@/lib/mundo";

/** Aba "Mundo": histórias, lendas, geografia e religiões. O mestre cadastra o conteúdo como JSON. */
export default function Mundo({ mesaId, ehMestre }: { mesaId: string; ehMestre: boolean }) {
  const { mundo, personalizado, json, carregado } = useMundo(mesaId, true);
  const [ativaId, setAtivaId] = useState<string>("");
  const [editando, setEditando] = useState(false);

  const secao = mundo.secoes.find((s) => s.id === ativaId) ?? mundo.secoes[0];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent/20 via-card to-amber-500/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-6 -top-8 select-none text-[9rem] leading-none opacity-[0.07]">📜</div>
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{mundo.titulo}</h2>
              {mundo.subtitulo && <p className="mt-1 text-muted">{mundo.subtitulo}</p>}
            </div>
            {ehMestre && (
              <button
                onClick={() => setEditando(true)}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                ⬆ Importar JSON
              </button>
            )}
          </div>
          {mundo.introducao && <Markdown texto={mundo.introducao} />}
          {ehMestre && carregado && (
            <p className="text-xs text-muted">
              {personalizado ? "Conteúdo personalizado da sua mesa." : "Exibindo o conteúdo padrão de Valgreth."}
            </p>
          )}
        </div>
      </header>

      {mundo.secoes.length > 1 && (
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label="Seções do mundo">
          {mundo.secoes.map((s) => {
            const ativa = s.id === secao?.id;
            return (
              <button
                key={s.id}
                onClick={() => setAtivaId(s.id)}
                aria-current={ativa}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                  ativa
                    ? "border-accent-hover bg-accent-hover/10 text-accent-hover"
                    : "border-border bg-card text-foreground hover:border-accent-hover/60"
                }`}
              >
                <span className="text-lg">{s.icone ?? "•"}</span>
                <span className="leading-tight">{s.titulo}</span>
              </button>
            );
          })}
        </nav>
      )}

      {secao && <SecaoView key={secao.id} secao={secao} />}

      {editando && (
        <EditorJson
          mesaId={mesaId}
          inicial={json ?? JSON.stringify(mundo, null, 2)}
          personalizado={personalizado}
          onFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}

function SecaoView({ secao }: { secao: Secao }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-hover/15 text-2xl">
          {secao.icone ?? "📖"}
        </span>
        <div>
          <h3 className="text-xl font-bold">{secao.titulo}</h3>
          {secao.resumo && <p className="text-sm text-muted">{secao.resumo}</p>}
        </div>
      </div>
      {secao.blocos.map((b, i) => (
        <BlocoView key={i} bloco={b} />
      ))}
    </section>
  );
}

const COLUNAS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
} as const;

function Titulo({ titulo }: { titulo?: string }) {
  return titulo ? (
    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-accent-hover">
      <span className="h-px w-4 bg-accent-hover/60" />
      {titulo}
    </h4>
  ) : null;
}

function BlocoView({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case "texto":
      return (
        <div>
          <Titulo titulo={bloco.titulo} />
          <Markdown texto={bloco.texto} />
        </div>
      );
    case "destaque":
      return (
        <aside className="rounded-xl border border-amber-500/40 border-l-4 border-l-amber-500 bg-amber-500/5 p-4">
          {bloco.titulo && <p className="mb-1 font-semibold text-amber-600 dark:text-amber-400">{bloco.titulo}</p>}
          <Markdown texto={bloco.texto} />
        </aside>
      );
    case "cartoes":
      return (
        <div>
          <Titulo titulo={bloco.titulo} />
          {bloco.texto && <p className="mb-3 text-sm text-muted">{bloco.texto}</p>}
          <div className={`grid gap-3 ${COLUNAS[bloco.colunas ?? 2]}`}>
            {bloco.itens.map((it, i) => (
              <Cartao key={i} item={it} />
            ))}
          </div>
        </div>
      );
    case "tabela":
      return (
        <div>
          <Titulo titulo={bloco.titulo} />
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-accent-hover/10 text-xs uppercase tracking-wider text-accent-hover">
                <tr>
                  {bloco.colunas.map((c, i) => (
                    <th key={i} className="px-3 py-2 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {bloco.linhas.map((l, i) => (
                  <tr key={i}>
                    {l.map((c, j) => (
                      <td key={j} className={`px-3 py-2 align-top ${j === 0 ? "font-semibold" : "text-muted"}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
}

function Cartao({ item }: { item: ItemCartao }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-accent-hover/50">
      <div className="flex items-start gap-3">
        {item.icone && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-hover/10 text-xl">
            {item.icone}
          </span>
        )}
        <div className="min-w-0">
          <h5 className="font-semibold leading-snug">{item.titulo}</h5>
          {item.subtitulo && <p className="text-sm text-muted">{item.subtitulo}</p>}
        </div>
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t, i) => (
            <span key={i} className="rounded-full bg-accent-hover/10 px-2 py-0.5 text-xs font-medium text-accent-hover">
              {t}
            </span>
          ))}
        </div>
      )}
      {item.detalhes && item.detalhes.length > 0 && (
        <dl className="space-y-1 rounded-lg bg-border/30 p-3 text-sm">
          {item.detalhes.map((d, i) => (
            <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted sm:pt-0.5">{d.rotulo}</dt>
              <dd>{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.texto && <Markdown texto={item.texto} />}
    </article>
  );
}

const EXEMPLO = `{
  "titulo": "Nome do mundo",
  "subtitulo": "opcional",
  "introducao": "Markdown opcional",
  "secoes": [
    {
      "id": "lendas",
      "titulo": "Lendas",
      "icone": "📜",
      "resumo": "opcional",
      "blocos": [
        { "tipo": "texto", "titulo": "opcional", "texto": "Markdown" },
        { "tipo": "destaque", "titulo": "opcional", "texto": "Markdown" },
        {
          "tipo": "cartoes", "colunas": 2,
          "itens": [
            { "titulo": "Título", "subtitulo": "opc.", "icone": "🐉", "tags": ["a", "b"],
              "texto": "Markdown", "detalhes": [{ "rotulo": "Governo", "valor": "..." }] }
          ]
        },
        { "tipo": "tabela", "colunas": ["A", "B"], "linhas": [["1", "2"]] }
      ]
    }
  ]
}`;

function EditorJson({
  mesaId,
  inicial,
  personalizado,
  onFechar,
}: {
  mesaId: string;
  inicial: string; // JSON em vigor (usado só para baixar como modelo)
  personalizado: boolean;
  onFechar: () => void;
}) {
  // O mestre não digita JSON: ele importa um arquivo .json, confere o resumo e confirma.
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [ajuda, setAjuda] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const validacao = useMemo(() => {
    if (!texto) return null;
    try {
      const m = lerMundoJson(texto);
      return { erro: "", titulo: m.titulo, secoes: m.secoes.map((s) => `${s.icone ?? "•"} ${s.titulo}`) };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : String(e), titulo: "", secoes: [] as string[] };
    }
  }, [texto]);

  async function importar(f?: File) {
    if (!f) return;
    setErroSalvar("");
    setNomeArquivo(f.name);
    setTexto(await f.text());
    if (arquivo.current) arquivo.current.value = "";
  }

  async function salvar() {
    setErroSalvar("");
    setSalvando(true);
    try {
      await salvarMundo(mesaId, texto);
      onFechar();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setSalvando(false);
    }
  }

  function baixar(conteudo: string, nome: string) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  const botao = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Importar conteúdo do mundo</h3>
          <button onClick={onFechar} aria-label="Fechar" className="px-2 text-muted hover:text-foreground">✕</button>
        </div>
        <p className="text-sm text-muted">
          Escolha um arquivo <code>.json</code>. Ele substitui o conteúdo atual para todos os jogadores da mesa.
        </p>

        <button
          onClick={() => arquivo.current?.click()}
          className="rounded-xl border-2 border-dashed border-border px-4 py-6 text-sm hover:border-accent-hover"
        >
          {nomeArquivo ? `📄 ${nomeArquivo} — escolher outro` : "📂 Escolher arquivo .json"}
        </button>
        <input ref={arquivo} type="file" accept=".json,application/json" hidden onChange={(e) => importar(e.target.files?.[0])} />

        {validacao && (
          <div className="space-y-2 rounded-lg bg-border/30 p-3 text-sm">
            {validacao.erro ? (
              <p className="text-red-500">✕ {validacao.erro}</p>
            ) : (
              <>
                <p className="font-semibold text-green-600">✓ {validacao.titulo}</p>
                <p className="text-muted">{validacao.secoes.join(" · ")}</p>
              </>
            )}
          </div>
        )}
        {erroSalvar && <p className="text-sm text-red-500">{erroSalvar}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <button onClick={() => baixar(inicial, "mundo.json")} className={botao}>Baixar atual (modelo)</button>
          <button onClick={() => setAjuda((v) => !v)} className={botao}>{ajuda ? "Ocultar formato" : "Ver formato"}</button>
          {personalizado && (
            <button
              onClick={async () => {
                if (confirm("Descartar o conteúdo importado e voltar ao padrão de Valgreth?")) {
                  await restaurarMundoPadrao(mesaId);
                  onFechar();
                }
              }}
              className={`${botao} text-red-500`}
            >
              Restaurar padrão
            </button>
          )}
        </div>
        {ajuda && <pre className="max-h-48 overflow-auto rounded-lg bg-border/30 p-3 text-xs">{EXEMPLO}</pre>}

        <div className="flex justify-end gap-2">
          <button onClick={onFechar} className={botao}>Cancelar</button>
          <button
            onClick={salvar}
            disabled={!validacao || !!validacao.erro || salvando}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {salvando ? "Importando…" : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
