"use client";

import { confirmar, perguntar } from "@/components/ui/Dialogos";
import { useRef, useState } from "react";
import EditorMarkdown from "./EditorMarkdown";
import Markdown from "./Markdown";
import {
  STATUS_ETAPA,
  STATUS_MISSAO,
  adicionarImagemMissao,
  atualizarLegendaImagem,
  avancarEtapa,
  definirStatusEtapa,
  excluirImagemMissao,
  excluirMissao,
  novaEtapa,
  novaMissao,
  salvarMissao,
  useImagensMissoes,
  useMissoesMestre,
  useMissoesPublicas,
  type Etapa,
  type ImagemMissao,
  type MissaoMestre,
  type MissaoPublica,
  type StatusEtapa,
  type StatusMissao,
} from "@/lib/missoes";

const campo = "w-full rounded-sm border border-border bg-background px-3 py-2 text-sm";
const botao = "shrink-0 rounded-sm bg-(--acento) px-4 py-2 text-sm font-medium text-amber-50 hover:brightness-125";
const PLURAL: Record<StatusMissao, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluídas",
  fracassada: "Fracassadas",
};
const CATEGORIAS_PADRAO = ["Arco principal", "Missão secundária", "Missão pessoal", "Contrato", "Rumor"];
const NOVA = "__nova__";
const infoStatus = (s: StatusMissao) => STATUS_MISSAO.find((x) => x.id === s)!;

/** Aba "Missões": um diário em papiro. O mestre vê tudo; o jogador só vê etapas concluídas e a atual. */
export default function Missoes({ mesaId, ehMestre }: { mesaId: string; ehMestre: boolean }) {
  return (
    <div className="papiro">
      <div className="mb-5 space-y-1 text-center">
        <h2 className="titulo-papiro text-2xl font-bold">Diário de Missões</h2>
        <div className="regua" />
      </div>
      {ehMestre ? <VisaoMestre mesaId={mesaId} /> : <VisaoJogador mesaId={mesaId} />}
    </div>
  );
}

// ---------------------------------------------------------------- Jogador

function VisaoJogador({ mesaId }: { mesaId: string }) {
  const { missoes, carregado } = useMissoesPublicas(mesaId, true);
  const { imagens } = useImagensMissoes(mesaId, true);
  const [sel, setSel] = useState<string | null>(null);
  const [aba, setAba] = useState<StatusMissao>("em_andamento");

  if (!carregado) return <p className="text-muted">Carregando…</p>;
  if (missoes.length === 0) return <p className="text-center italic text-muted">O mestre ainda não registrou missões.</p>;

  const daAba = missoes.filter((m) => m.status === aba);
  const missao = daAba.find((m) => m.id === sel) ?? daAba[0];

  return (
    <section className="space-y-4">
      <div className="flex border-b border-border" role="tablist">
        {STATUS_MISSAO.map((s) => {
          const ativa = s.id === aba;
          const n = missoes.filter((m) => m.status === s.id).length;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(s.id)}
              className={`-mb-px flex-1 border-b-2 px-2 py-2 text-sm font-semibold sm:flex-none sm:px-5 ${
                ativa ? "border-(--acento) text-(--acento)" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {s.icone} {PLURAL[s.id]} ({n})
            </button>
          );
        })}
      </div>

      {missao ? (
        <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
          <ListaMissoes missoes={daAba} selecionada={missao.id} onSelecionar={setSel} />
          <DetalheJogador missao={missao} imagens={imagens.filter((i) => i.missaoId === missao.id)} />
        </div>
      ) : (
        <p className="text-center italic text-muted">Nenhuma missão nesta aba.</p>
      )}
    </section>
  );
}

function DetalheJogador({ missao, imagens }: { missao: MissaoPublica; imagens: ImagemMissao[] }) {
  const s = infoStatus(missao.status);
  const concluidas = missao.etapas.filter((e) => e.status === "concluida");
  const atual = missao.etapas.find((e) => e.status === "atual");

  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            {missao.categoria && <p className="text-xs uppercase tracking-[0.2em] text-muted">{missao.categoria}</p>}
            <h3 className="text-2xl font-bold leading-tight">{missao.titulo}</h3>
          </div>
          <span className={`carimbo shrink-0 ${s.cor}`}>{s.rotulo}</span>
        </div>
        <div className="regua" />
      </header>

      {missao.descricaoPublica.trim() && <Markdown texto={missao.descricaoPublica} />}

      <Galeria imagens={imagens} />

      {atual && (
        <div className="caixa-dnd rounded-sm p-3">
          <p className="titulo-papiro text-sm font-bold">Objetivo atual</p>
          <p className="mt-1 font-medium">{atual.texto}</p>
        </div>
      )}

      {concluidas.length > 0 && (
        <ul className="space-y-1.5">
          {concluidas.map((e) => (
            <li key={e.id} className="flex gap-2 text-sm text-muted">
              <span className="text-emerald-800">✔</span>
              <span className="line-through">{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

// ----------------------------------------------------------------- Mestre

function VisaoMestre({ mesaId }: { mesaId: string }) {
  const { missoes, carregado } = useMissoesMestre(mesaId, true);
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusMissao | "todas">("todas");
  const [titulo, setTitulo] = useState("");

  const visiveis = missoes.filter((m) => filtro === "todas" || m.status === filtro);
  const missao = missoes.find((m) => m.id === sel) ?? visiveis[0];
  // Opções = padrões + toda categoria já usada em alguma missão (é assim que as novas persistem).
  const opcoesCategoria = [...new Set([...CATEGORIAS_PADRAO, ...missoes.map((m) => m.categoria).filter(Boolean)])];

  async function adicionar() {
    const t = titulo.trim();
    if (!t) return;
    setTitulo("");
    const m = novaMissao(t);
    setSel(m.id);
    setFiltro("todas");
    await salvarMissao(mesaId, m);
  }

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          placeholder="Título da nova missão"
          className={campo}
        />
        <button onClick={adicionar} className={botao}>
          + Missão
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ id: "todas" as const, rotulo: "Todas" }, ...STATUS_MISSAO].map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-sm border border-border px-3 py-1 text-sm ${
              filtro === f.id ? "bg-(--acento) text-amber-50" : "hover:bg-border/50"
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregado && missoes.length === 0 && <p className="italic text-muted">Nenhuma missão ainda.</p>}
      {carregado && missoes.length > 0 && visiveis.length === 0 && <p className="italic text-muted">Nenhuma missão neste filtro.</p>}

      {missao && (
        <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
          <ListaMissoes missoes={visiveis} selecionada={missao.id} onSelecionar={setSel} />
          <DetalheMestre key={missao.id} mesaId={mesaId} missao={missao} opcoesCategoria={opcoesCategoria} />
        </div>
      )}
    </section>
  );
}

/** Campo que só grava ao perder o foco (evita uma escrita por tecla). */
function CampoTexto({
  valor,
  onSalvar,
  ...props
}: { valor: string; onSalvar: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(valor);
  return <input {...props} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== valor && onSalvar(v)} />;
}

function DetalheMestre({
  mesaId,
  missao,
  opcoesCategoria,
}: {
  mesaId: string;
  missao: MissaoMestre;
  opcoesCategoria: string[];
}) {
  const [editandoPub, setEditandoPub] = useState(false);
  const [editandoMestre, setEditandoMestre] = useState(false);
  const [pub, setPub] = useState(missao.descricaoPublica);
  const [priv, setPriv] = useState(missao.descricaoMestre);
  const [textoNovo, setTextoNovo] = useState("");
  const { imagens } = useImagensMissoes(mesaId, true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const minhas = imagens.filter((i) => i.missaoId === missao.id);

  async function subir(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    setEnviando(true);
    try {
      for (const f of Array.from(arquivos)) await adicionarImagemMissao(mesaId, missao.id, f);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  const salvar = (patch: Partial<MissaoMestre>) => salvarMissao(mesaId, { ...missao, ...patch });
  const salvarEtapa = (id: string, patch: Partial<Etapa>) =>
    salvar({ etapas: missao.etapas.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  function adicionarEtapa() {
    const t = textoNovo.trim();
    if (!t) return;
    setTextoNovo("");
    // A primeira etapa de uma missão já nasce como atual.
    salvar({ etapas: [...missao.etapas, novaEtapa(t, missao.etapas.length === 0 ? "atual" : "pendente")] });
  }

  const temAtual = missao.etapas.some((e) => e.status === "atual");
  const temPendente = missao.etapas.some((e) => e.status === "pendente");

  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <CampoTexto
          valor={missao.titulo}
          onSalvar={(v) => salvar({ titulo: v.trim() || missao.titulo })}
          className="titulo-papiro w-full bg-transparent text-2xl font-bold outline-none"
          aria-label="Título"
        />
        <div className="regua" />
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={missao.categoria}
            onChange={async (e) => {
              if (e.target.value !== NOVA) return salvar({ categoria: e.target.value });
              const nome = await perguntar({ titulo: "Nova categoria", rotulo: "Nome da categoria", confirmar: "Criar" });
              if (nome) salvar({ categoria: nome });
            }}
            className={campo}
            aria-label="Categoria"
          >
            <option value="">Sem categoria</option>
            {opcoesCategoria.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NOVA}>+ Nova categoria…</option>
          </select>
          <CampoTexto
            valor={missao.dificuldade}
            onSalvar={(v) => salvar({ dificuldade: v })}
            placeholder="Dificuldade (só você vê)"
            className={campo}
          />
          <select
            value={missao.status}
            onChange={(e) => salvar({ status: e.target.value as StatusMissao })}
            className={campo}
            aria-label="Situação da missão"
          >
            {STATUS_MISSAO.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icone} {s.rotulo}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">👁 Descrição pública</p>
          {editandoPub ? (
            <EditorMarkdown valor={pub} onChange={setPub} placeholder="O que os jogadores sabem…" />
          ) : missao.descricaoPublica.trim() ? (
            <Markdown texto={missao.descricaoPublica} />
          ) : (
            <p className="text-sm italic text-muted">Sem descrição.</p>
          )}
          <button
            onClick={() => {
              if (editandoPub) salvar({ descricaoPublica: pub });
              setEditandoPub((v) => !v);
            }}
            className="text-sm text-(--acento) hover:underline"
          >
            {editandoPub ? "Salvar" : "Editar"}
          </button>
        </div>
        <div className="caixa-dnd space-y-2 rounded-sm p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">🔒 Notas do mestre</p>
          {editandoMestre ? (
            <EditorMarkdown valor={priv} onChange={setPriv} placeholder="Segredos, ganchos, desfechos possíveis…" />
          ) : missao.descricaoMestre.trim() ? (
            <Markdown texto={missao.descricaoMestre} />
          ) : (
            <p className="text-sm italic text-muted">Sem notas.</p>
          )}
          <button
            onClick={() => {
              if (editandoMestre) salvar({ descricaoMestre: priv });
              setEditandoMestre((v) => !v);
            }}
            className="text-sm text-(--acento) hover:underline"
          >
            {editandoMestre ? "Salvar" : "Editar"}
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">🖼 Ilustrações (públicas)</p>
          <button
            onClick={() => input.current?.click()}
            disabled={enviando}
            className="rounded-sm border border-border px-3 py-1 text-sm hover:bg-border/50 disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "+ Imagem"}
          </button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => subir(e.target.files)} />
        </div>
        {erro && <p className="text-sm text-red-800">{erro}</p>}
        <Galeria
          imagens={minhas}
          onLegenda={(id, v) => atualizarLegendaImagem(mesaId, id, v)}
          onExcluir={async (id) => { if (await confirmar({ texto: "Remover esta imagem?", confirmar: "Remover", perigo: true })) excluirImagemMissao(mesaId, id); }}
        />
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Etapas</p>
          {missao.status === "em_andamento" && (temAtual || temPendente) && (
            <button onClick={() => salvarMissao(mesaId, avancarEtapa(missao))} className={`${botao} !px-3 !py-1`}>
              {temAtual ? "Concluir atual e avançar" : "Revelar próxima etapa"}
            </button>
          )}
        </div>

        {missao.etapas.length === 0 && <p className="text-sm italic text-muted">Nenhuma etapa. A primeira vira a etapa atual.</p>}

        {missao.etapas.map((e) => (
          <div
            key={e.id}
            className={`space-y-2 rounded-sm border p-2 ${e.status === "atual" ? "caixa-dnd" : "border-border"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <CampoTexto
                valor={e.texto}
                onSalvar={(v) => salvarEtapa(e.id, { texto: v })}
                className={`${campo} flex-1 ${e.status === "concluida" ? "line-through opacity-70" : ""}`}
                aria-label="Texto da etapa"
              />
              <select
                value={e.status}
                onChange={(ev) => salvarMissao(mesaId, definirStatusEtapa(missao, e.id, ev.target.value as StatusEtapa))}
                className="rounded-sm border border-border bg-background px-2 py-2 text-sm"
                aria-label="Situação da etapa"
              >
                {STATUS_ETAPA.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
              <button
                onClick={() => salvar({ etapas: missao.etapas.filter((x) => x.id !== e.id) })}
                aria-label="Remover etapa"
                className="px-1 text-muted hover:text-red-800"
              >
                ✕
              </button>
            </div>
            <CampoTexto
              valor={e.notaMestre}
              onSalvar={(v) => salvarEtapa(e.id, { notaMestre: v })}
              placeholder="🔒 Nota privada da etapa"
              className="w-full rounded-sm border border-dashed border-border bg-transparent px-2 py-1 text-xs"
            />
            {(e.status === "pendente" || (e.status === "atual" && missao.status !== "em_andamento")) && (
              <p className="text-xs text-amber-800">🙈 Oculta dos jogadores</p>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <input
            value={textoNovo}
            onChange={(e) => setTextoNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarEtapa()}
            placeholder="Nova etapa"
            className={campo}
          />
          <button onClick={adicionarEtapa} className="shrink-0 rounded-sm border border-border px-3 py-2 text-sm hover:bg-border/50">
            + Etapa
          </button>
        </div>
      </div>

      <button
        onClick={async () => { if (await confirmar({ texto: `Excluir a missão "${missao.titulo}"?`, confirmar: "Excluir", perigo: true })) excluirMissao(mesaId, missao.id); }}
        className="text-sm text-muted hover:text-red-800"
      >
        Excluir missão
      </button>
    </article>
  );
}

// ------------------------------------------------------------ Compartilhado

/** Ilustrações em molduras de papel; clique para ampliar. Com onLegenda/onExcluir, vira editável. */
function Galeria({
  imagens,
  onLegenda,
  onExcluir,
}: {
  imagens: ImagemMissao[];
  onLegenda?: (id: string, legenda: string) => void;
  onExcluir?: (id: string) => void;
}) {
  const [aberta, setAberta] = useState<ImagemMissao | null>(null);
  if (imagens.length === 0) return null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {imagens.map((i) => (
          <figure key={i.id} className="space-y-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={i.imagem}
              alt={i.legenda || "Ilustração da missão"}
              onClick={() => setAberta(i)}
              className="moldura max-h-72 w-full cursor-zoom-in object-cover"
            />
            {onLegenda ? (
              <div className="flex items-center gap-2">
                <CampoTexto
                  valor={i.legenda}
                  onSalvar={(v) => onLegenda(i.id, v)}
                  placeholder="Legenda"
                  className="w-full border-b border-border bg-transparent text-sm italic outline-none"
                />
                <button onClick={() => onExcluir?.(i.id)} aria-label="Remover imagem" className="px-1 text-muted hover:text-red-800">
                  ✕
                </button>
              </div>
            ) : (
              i.legenda && <figcaption className="text-center text-sm italic text-muted">{i.legenda}</figcaption>
            )}
          </figure>
        ))}
      </div>
      {aberta && (
        <div
          onClick={() => setAberta(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aberta.imagem} alt={aberta.legenda} className="max-h-full max-w-full" />
        </div>
      )}
    </>
  );
}

function ListaMissoes({
  missoes,
  selecionada,
  onSelecionar,
}: {
  missoes: { id: string; titulo: string; status: StatusMissao; categoria: string }[];
  selecionada: string;
  onSelecionar: (id: string) => void;
}) {
  const [fechadas, setFechadas] = useState<string[]>([]);
  const alternar = (c: string) => setFechadas((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]));
  // Agrupa por categoria: padrões primeiro, depois as do mestre, "Sem categoria" por último.
  const nomes = [...new Set(missoes.map((m) => m.categoria))];
  const ordem = (c: string) => (c === "" ? 2000 : CATEGORIAS_PADRAO.indexOf(c) >= 0 ? CATEGORIAS_PADRAO.indexOf(c) : 1000);
  nomes.sort((x, y) => ordem(x) - ordem(y) || x.localeCompare(y));

  return (
    <nav className="space-y-4" aria-label="Missões">
      {nomes.map((cat) => (
        <div key={cat} className="space-y-2">
          <h4 className="border-b border-border pb-1 text-sm font-bold">
            <button
              onClick={() => alternar(cat)}
              aria-expanded={!fechadas.includes(cat)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span>{cat || "Sem categoria"}</span>
              <span className="text-xs font-normal text-muted">
                {missoes.filter((m) => m.categoria === cat).length} {fechadas.includes(cat) ? "▸" : "▾"}
              </span>
            </button>
          </h4>
          <div
            className={`flex gap-2 overflow-x-auto md:flex-col md:overflow-visible ${fechadas.includes(cat) ? "hidden" : ""}`}
          >
            {missoes
              .filter((m) => m.categoria === cat)
              .map((m) => {
                const s = infoStatus(m.status);
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelecionar(m.id)}
                    className={`shrink-0 rounded-sm border border-border px-3 py-2 text-left text-sm ${
                      m.id === selecionada ? "caixa-dnd" : "hover:bg-border/50"
                    }`}
                  >
                    <span className="block font-semibold">{m.titulo}</span>
                    <span className={`text-xs ${s.cor}`}>
                      {s.icone} {s.rotulo}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}
