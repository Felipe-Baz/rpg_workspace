"use client";

import { confirmar } from "@/components/ui/Dialogos";
import { useMemo, useRef, useState } from "react";
import Markdown from "./Markdown";
import MundoEditor from "./MundoEditor";
import {
  lerMundoJson,
  apagarMundo,
  mundoVazio,
  salvarMundo,
  useMundo,
  type Bloco,
  type ItemCartao,
  type Secao,
} from "@/lib/mundo";

/** Aba "Mundo": histórias, lendas, geografia e religiões. Cada mesa tem o seu; o mestre cadastra o conteúdo. */
export default function Mundo({ mesaId, ehMestre }: { mesaId: string; ehMestre: boolean }) {
  const { mundo, json, carregado } = useMundo(mesaId, true);
  const [ativaId, setAtivaId] = useState<string>("");
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState(false);

  if (!carregado) return <p className="text-sm text-muted">Carregando…</p>;

  if (editando) {
    return <MundoEditor mesaId={mesaId} inicial={mundo ?? mundoVazio()} onFechar={() => setEditando(false)} />;
  }

  const secao = mundo?.secoes.find((s) => s.id === ativaId) ?? mundo?.secoes[0];

  return (
    <div className="space-y-6">
      {!mundo ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center sm:p-12">
          <div className="text-5xl">📜</div>
          <h2 className="mt-3 text-xl font-bold">O mundo desta mesa ainda não foi escrito</h2>
          {ehMestre ? (
            <>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Cada mesa vive num universo próprio. Cadastre aqui o que qualquer pessoa do seu mundo sabe: lendas, lugares, povos, fé.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button onClick={() => setEditando(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
                  ✍️ Escrever o mundo
                </button>
                <button onClick={() => setImportando(true)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-border/50">
                  ⬆ Importar JSON
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Quando o mestre cadastrar o conteúdo, ele aparece aqui.</p>
          )}
        </div>
      ) : (
        <>
          <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent/20 via-card to-amber-500/10 p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-6 -top-8 select-none text-[9rem] leading-none opacity-[0.07]">📜</div>
            <div className="relative space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold sm:text-3xl">{mundo.titulo}</h2>
                  {mundo.subtitulo && <p className="mt-1 text-muted">{mundo.subtitulo}</p>}
                </div>
                {ehMestre && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditando(true)}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                    >
                      ✍️ Editar
                    </button>
                    <button onClick={() => setImportando(true)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-border/50">
                      ⬆ JSON
                    </button>
                  </div>
                )}
              </div>
              {mundo.introducao && <Markdown texto={mundo.introducao} />}
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
        </>
      )}

      {importando && (
        <EditorJson
          mesaId={mesaId}
          inicial={json ?? JSON.stringify(mundo ?? mundoVazio(), null, 2)}
          existe={!!mundo}
          onFechar={() => setImportando(false)}
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
        <aside className="rounded-xl border border-warn/40 border-l-4 border-l-amber-500 bg-warn/5 p-4">
          {bloco.titulo && <p className="mb-1 font-semibold text-warn dark:text-warn">{bloco.titulo}</p>}
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

const URL_IA = "/mcp/ia/mundo-json.txt";

const TIPOS_BLOCO: [string, string][] = [
  ["texto", "Parágrafos corridos. Campos: texto (Markdown, obrigatório), titulo."],
  ["destaque", "Caixa realçada para avisos e observações. Campos: texto (Markdown, obrigatório), titulo."],
  ["cartoes", "Grade de cartões (cidades, povos, deuses, lendas). Campos: itens (obrigatório), colunas (1, 2 ou 3), titulo, texto de abertura."],
  ["tabela", "Dados comparativos. Campos: colunas (lista de textos) e linhas (lista de listas de textos, uma por linha), titulo."],
];

function AjudaFormato() {
  const code = "rounded bg-border/50 px-1 py-0.5 text-xs";
  return (
    <div className="space-y-3 rounded-lg bg-border/30 p-3 text-sm">
      <p>
        O arquivo é <strong>um único objeto JSON</strong>: o mundo tem <strong>seções</strong> (os botões de navegação) e cada seção
        tem <strong>blocos</strong> (o conteúdo). Todos os valores são <em>texto entre aspas</em> — inclusive números em tabelas.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li><b className="text-foreground">Mundo</b>: <code className={code}>titulo</code> (obrigatório), <code className={code}>subtitulo</code>, <code className={code}>introducao</code> (Markdown), <code className={code}>secoes</code> (lista, obrigatório).</li>
        <li><b className="text-foreground">Seção</b>: <code className={code}>titulo</code> (obrigatório), <code className={code}>blocos</code> (lista, obrigatório), <code className={code}>id</code> (curto e único), <code className={code}>icone</code> (emoji), <code className={code}>resumo</code>.</li>
        <li>
          <b className="text-foreground">Bloco</b>: o campo <code className={code}>tipo</code> escolhe o formato:
          <ul className="mt-1 list-[circle] space-y-1 pl-5">
            {TIPOS_BLOCO.map(([t, d]) => (
              <li key={t}><code className={code}>{t}</code> — {d}</li>
            ))}
          </ul>
        </li>
        <li>
          <b className="text-foreground">Item de cartão</b>: <code className={code}>titulo</code> (obrigatório), <code className={code}>subtitulo</code>, <code className={code}>icone</code> (emoji),{" "}
          <code className={code}>tags</code> (lista de textos), <code className={code}>texto</code> (Markdown) e <code className={code}>detalhes</code> (lista de {"{"} rotulo, valor {"}"}).
        </li>
        <li>Campos de texto aceitam Markdown (<code className={code}>**negrito**</code>, listas com <code className={code}>-</code>). Dentro do JSON, quebra de linha vira <code className={code}>{"\\n"}</code> e aspas viram <code className={code}>{'\\"'}</code>.</li>
      </ul>
      <p className="text-muted">
        Se algo estiver errado, a importação aponta o caminho do problema (ex.: <code className={code}>secoes[2].blocos[0].titulo: deve ser texto</code>) e não salva nada.
        Dica: baixe o template, ou envie o link de instruções abaixo para uma IA converter a sua história.
      </p>
    </div>
  );
}

// Template baixável: JSON válido que passa em lerMundoJson, com um exemplo de cada tipo de bloco.
const TEMPLATE = JSON.stringify(
  {
    titulo: "Nome do seu mundo",
    subtitulo: "Frase curta (opcional)",
    introducao: "Texto de abertura em **Markdown** (opcional).",
    secoes: [
      {
        id: "lendas",
        titulo: "Lendas",
        icone: "📜",
        resumo: "Resumo curto da seção (opcional)",
        blocos: [
          { tipo: "texto", titulo: "Título do bloco (opcional)", texto: "Parágrafo em **Markdown**." },
          { tipo: "destaque", titulo: "Atenção (opcional)", texto: "Caixa de destaque para avisos e observações." },
          {
            tipo: "cartoes",
            titulo: "Lista de cartões",
            texto: "Texto de abertura (opcional)",
            colunas: 2,
            itens: [
              {
                titulo: "Nome do item",
                subtitulo: "Subtítulo (opcional)",
                icone: "🐉",
                tags: ["tag1", "tag2"],
                texto: "Descrição em **Markdown**.",
                detalhes: [{ rotulo: "Governo", valor: "Quem manda aqui" }],
              },
            ],
          },
          { tipo: "tabela", titulo: "Tabela", colunas: ["Coluna A", "Coluna B"], linhas: [["valor 1", "valor 2"]] },
        ],
      },
    ],
  },
  null,
  2,
);

function EditorJson({
  mesaId,
  inicial,
  existe,
  onFechar,
}: {
  mesaId: string;
  inicial: string; // JSON em vigor (usado só para baixar como modelo)
  existe: boolean;
  onFechar: () => void;
}) {
  // O mestre não digita JSON: ele importa um arquivo .json, confere o resumo e confirma.
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [ajuda, setAjuda] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const linkIa = typeof window === "undefined" ? URL_IA : `${window.location.origin}${URL_IA}`;

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkIa);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {}
  }

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
              <p className="text-danger">✕ {validacao.erro}</p>
            ) : (
              <>
                <p className="font-semibold text-green-600">✓ {validacao.titulo}</p>
                <p className="text-muted">{validacao.secoes.join(" · ")}</p>
              </>
            )}
          </div>
        )}
        {erroSalvar && <p className="text-sm text-danger">{erroSalvar}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <button onClick={() => baixar(TEMPLATE, "mundo-template.json")} className={botao}>⬇ Baixar template</button>
          {existe && <button onClick={() => baixar(inicial, "mundo.json")} className={botao}>Baixar mundo atual</button>}
          <button onClick={() => setAjuda((v) => !v)} className={botao}>{ajuda ? "Ocultar formato" : "Ver formato"}</button>
          {existe && (
            <button
              onClick={async () => {
                if (await confirmar({ texto: "Apagar todo o conteúdo do mundo desta mesa? Os jogadores deixarão de vê-lo.", confirmar: "Apagar", perigo: true })) {
                  await apagarMundo(mesaId);
                  onFechar();
                }
              }}
              className={`${botao} text-danger`}
            >
              Apagar mundo
            </button>
          )}
        </div>
        {ajuda && <AjudaFormato />}

        <div className="space-y-2 rounded-lg border border-accent-hover/30 bg-accent-hover/5 p-3 text-sm">
          <p className="font-medium">🤖 Converter sua história com uma IA</p>
          <p className="text-muted">
            Copie este link, envie para o ChatGPT, Claude ou outra IA junto com o seu texto e peça: “siga as instruções deste link e converta minha história”.
            Depois salve a resposta como <code>.json</code> e importe aqui.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-border/40 px-2 py-1.5 text-xs">{linkIa}</code>
            <button onClick={copiarLink} className={botao}>{copiado ? "✓ Copiado" : "Copiar link"}</button>
            <a href={URL_IA} target="_blank" rel="noopener noreferrer" className={botao}>Abrir ↗</a>
          </div>
        </div>

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
