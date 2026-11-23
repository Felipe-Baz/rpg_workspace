"use client";

import { useEffect, useMemo, useState } from "react";
import { chamarIa } from "@/lib/ia-cliente";
import { excluirAsset, useJob } from "@/lib/cena/cenas";
import type { Asset, TipoAsset } from "@/lib/cena/tipos";
import { TIPOS_ASSET, sugerirReuso, tipoDe } from "@/lib/mapas-ia/assets/biblioteca";
import { MAX_VARIACOES, STATUS_ROTULO, jobExpirado, type StatusJob } from "@/lib/mapas-ia/assets/jobs";
import { estimarLote } from "@/lib/mapas-ia/limites";
import type { Tema } from "@/lib/mapas-ia/temas/tipos";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted";
const btn = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50 disabled:opacity-40";
const btnPrim = "rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50";

const COR_STATUS: Record<StatusJob, string> = {
  "na-fila": "bg-border text-foreground",
  gerando: "bg-accent/30 text-accent-soft",
  pronto: "bg-emerald-600/30 text-emerald-300",
  falhou: "bg-danger/30 text-red-300",
};

interface Uso {
  uso: { total: number };
  teto: number;
}

export interface Props {
  mesaId: string;
  assets: Asset[];
  temas: Tema[];
  perspectivaId: string;
  temaIdInicial?: string;
  /** Regeneração/variação a partir deste asset. */
  base?: Asset;
  modoBase?: "variacoes" | "regenerar";
  /** Instrução já preenchida (ex.: completar um objeto convertido incompleto). */
  instrucaoInicial?: string;
  onUsar: (assetId: string) => void;
  onFechar: () => void;
}

export default function GerarAsset({ mesaId, assets, temas, perspectivaId, temaIdInicial, base, modoBase, instrucaoInicial, onUsar, onFechar }: Props) {
  const [tipo, setTipo] = useState<TipoAsset>(base ? tipoDe(base) : "sprite");
  const [descricao, setDescricao] = useState(base?.nome ?? "");
  const [nome, setNome] = useState("");
  const [tags, setTags] = useState("");
  const [escalaBase, setEscalaBase] = useState(String(base?.escalaBase ?? 1));
  const [temaId, setTemaId] = useState(base?.temaId ?? temaIdInicial ?? "");
  const [quantidade, setQuantidade] = useState(modoBase === "variacoes" ? "3" : "1");
  const [instrucao, setInstrucao] = useState(instrucaoInicial ?? "");

  const [uso, setUso] = useState<Uso | null>(null);
  const [fase, setFase] = useState<"form" | "confirmar" | "enviando" | "job">("form");
  const [jobId, setJobId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [descartando, setDescartando] = useState(false);
  const job = useJob(mesaId, jobId);

  useEffect(() => {
    chamarIa<Uso>(`uso?mesaId=${encodeURIComponent(mesaId)}`)
      .then(setUso)
      .catch(() => setUso(null)); // sem a estimativa, o servidor ainda aplica o teto
  }, [mesaId]);

  const n = Math.min(MAX_VARIACOES, Math.max(1, Math.round(Number(quantidade) || 1)));
  const est = uso ? estimarLote(uso.uso, uso.teto, n) : null;
  const regenerando = modoBase === "regenerar";

  // 4.3: antes de gerar, oferece o que já existe (só em pedido novo).
  const sugestoes = useMemo(
    () => (base ? [] : sugerirReuso(assets, descricao, { temaId: temaId || undefined, perspectivaId, tipo })),
    [assets, base, descricao, temaId, perspectivaId, tipo],
  );

  const pedido = {
    tipo,
    descricao: descricao.trim(),
    nome: nome.trim(),
    tags: base ? (base.tags ?? []).join(",") : tags,
    escalaBase: Number(escalaBase) || 1,
    quantidade: n,
    temaId: temaId || undefined,
    perspectivaId: base ? (base.perspectivaId ?? "topdown") : perspectivaId,
    baseAssetId: base && regenerando ? base.id : undefined,
    instrucao: instrucao.trim() || undefined,
  };

  async function enviar() {
    setFase("enviando");
    setErro("");
    try {
      const r = await chamarIa<{ jobId: string }>("gerar-asset", { corpo: { mesaId, pedido, confirmado: true } });
      setJobId(r.jobId);
      setFase("job");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao iniciar a geração.");
      setFase("form");
    }
  }

  const geradosIds = job?.resultado?.assetIds ?? [];
  const gerados = geradosIds.map((id) => assets.find((a) => a.id === id)).filter((a): a is Asset => !!a);
  const expirado = job ? jobExpirado(job) : false;
  const emAndamento = !!job && (job.status === "na-fila" || job.status === "gerando") && !expirado;

  async function descartar(a: Asset, substitutoId?: string) {
    setDescartando(true);
    setErro("");
    try {
      const r = await excluirAsset(mesaId, a, substitutoId);
      if (!r.ok) setErro(r.motivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setDescartando(false);
    }
  }

  const titulo = regenerando ? "Regenerar asset" : modoBase === "variacoes" ? "Variações do asset" : "Gerar asset";

  return (
    <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="max-h-full w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button className={btn} onClick={onFechar}>Fechar</button>
        </div>

        {fase !== "job" && (
          <>
            {base && (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={base.url} alt={base.nome} className="h-14 w-14 object-contain" />
                <span className="text-muted">{regenerando ? "Nova versão de" : "Variações de"} <strong className="text-foreground">{base.nome}</strong>. A atual permanece até você descartá-la.</span>
              </div>
            )}

            {!base && (
              <>
                <label className="block text-xs text-muted">
                  Tipo
                  <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAsset)}>
                    {TIPOS_ASSET.map((t) => <option key={t.tipo} value={t.tipo}>{t.nome}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-muted">
                  O que gerar
                  <input className={campo} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: barril de madeira" maxLength={500} />
                </label>
                {sugestoes.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-accent/60 bg-accent/10 p-2">
                    <p className="text-xs">Já existe na biblioteca. Reutilize em vez de gerar:</p>
                    <div className="flex flex-wrap gap-2">
                      {sugestoes.map(({ asset }) => (
                        <button key={asset.id} className="rounded-lg border border-border p-1 hover:bg-border/50" title={`Usar ${asset.nome}`} onClick={() => { onUsar(asset.id); onFechar(); }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.url} alt={asset.nome} className="h-14 w-14 object-contain" />
                          <span className="block max-w-14 truncate text-[10px]">{asset.nome}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted">Ou continue abaixo para gerar um novo (use “Variações” para gerar vários parecidos).</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-muted">
                    Nome (opcional)
                    <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
                  </label>
                  <label className="block text-xs text-muted">
                    Tags (vírgulas)
                    <input className={campo} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="árvore, carvalho" />
                  </label>
                  <label className="block text-xs text-muted">
                    Tamanho ao carimbar (células)
                    <input className={campo} type="number" min={0.25} max={10} step={0.25} value={escalaBase} onChange={(e) => setEscalaBase(e.target.value)} />
                  </label>
                  <label className="block text-xs text-muted">
                    Tema
                    <select className={campo} value={temaId} onChange={(e) => setTemaId(e.target.value)}>
                      <option value="">Sem tema</option>
                      {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}

            {(regenerando || base) && (
              <label className="block text-xs text-muted">
                {regenerando ? "Nova instrução" : "Instrução extra (opcional)"}
                <input className={campo} value={instrucao} onChange={(e) => setInstrucao(e.target.value)} placeholder="ex.: mais desgastado, com musgo" maxLength={500} />
              </label>
            )}

            {!regenerando && (
              <label className="block text-xs text-muted">
                Quantidade (variações do mesmo pedido, 1–{MAX_VARIACOES})
                <input className={campo} type="number" min={1} max={MAX_VARIACOES} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              </label>
            )}

            <p className="text-xs text-muted">
              {est
                ? `Estimativa: ${n} geração(ões). Restam ${Math.max(0, uso!.teto - uso!.uso.total)} de ${uso!.teto} neste período${est.cabeNoTeto ? "" : " — não cabe no teto"}.`
                : "Estimativa indisponível; o teto de gasto é aplicado pelo servidor."}
            </p>
            {erro && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">{erro}</p>}

            {fase === "confirmar" ? (
              <div className="space-y-2 rounded-lg border border-border p-2">
                <p className="text-sm">Confirmar {n} geração(ões)? Cada imagem gerada conta no teto de gasto; falhas não contam.</p>
                <div className="flex gap-2">
                  <button className={btnPrim} onClick={enviar}>Confirmar e gerar</button>
                  <button className={btn} onClick={() => setFase("form")}>Voltar</button>
                </div>
              </div>
            ) : (
              <button
                className={btnPrim}
                disabled={fase === "enviando" || (!base && !descricao.trim()) || (regenerando && !instrucao.trim()) || (est ? !est.cabeNoTeto : false)}
                onClick={() => setFase("confirmar")}
              >
                {fase === "enviando" ? "Enviando…" : `Gerar (${n})`}
              </button>
            )}
          </>
        )}

        {fase === "job" && (
          <div className="space-y-3" aria-live="polite">
            {!job && <p className="text-sm text-muted">Aguardando o servidor…</p>}
            {job && (
              <>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${expirado ? COR_STATUS.falhou : COR_STATUS[job.status]}`}>{expirado ? "Expirado" : STATUS_ROTULO[job.status]}</span>
                  {job.etapa && emAndamento && <span className="text-xs text-muted">{job.etapa}</span>}
                </div>
                <div className="h-2 overflow-hidden rounded bg-border" role="progressbar" aria-valuenow={job.progresso} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${job.status === "falhou" ? 0 : job.progresso}%` }} />
                </div>
                {expirado && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">A geração parou de responder. Tente de novo; nada foi cobrado além das imagens já salvas.</p>}
                {job.erro && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">{job.erro}</p>}
                {erro && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">{erro}</p>}
              </>
            )}

            {job?.status === "pronto" && (
              <div className="space-y-2">
                {regenerando && base && gerados[0] ? (
                  <>
                    <p className="text-xs text-muted">Compare as versões. O que você não descartar continua na biblioteca.</p>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      {[{ a: base, r: "Anterior" }, { a: gerados[0], r: "Nova" }].map(({ a, r }) => (
                        <div key={a.id} className="rounded-lg border border-border p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={`${r}: ${a.nome}`} className="mx-auto h-32 w-full object-contain" />
                          <p className="mt-1 text-muted">{r}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={btn} disabled={descartando} onClick={() => descartar(base, gerados[0].id)} title="As cenas que usam a anterior passam a usar a nova">Manter a nova, descartar a anterior</button>
                      <button className={btn} disabled={descartando} onClick={() => descartar(gerados[0])}>Descartar a nova</button>
                      <button className={btn} onClick={() => { onUsar(gerados[0].id); onFechar(); }}>Usar a nova</button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {gerados.map((a) => (
                      <button key={a.id} className="rounded-lg border border-border p-1 hover:bg-border/50" title={`Usar ${a.nome}`} onClick={() => { onUsar(a.id); onFechar(); }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.nome} className="h-20 w-20 object-contain" />
                        <span className="block max-w-20 truncate text-[10px]">{a.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
                {gerados.some((a) => a.naoRepetivel) && <p className="text-xs text-warn">Textura marcada como “não repetível”: a emenda continua visível. Considere regerar.</p>}
              </div>
            )}

            {!emAndamento && (
              <div className="flex gap-2">
                <button className={btn} onClick={() => { setJobId(null); setFase("form"); setErro(""); }}>Gerar outro</button>
                <button className={btn} onClick={onFechar}>Fechar</button>
              </div>
            )}
            {emAndamento && <p className="text-xs text-muted">Pode fechar esta janela: a geração continua e o asset aparece na biblioteca quando ficar pronto.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
