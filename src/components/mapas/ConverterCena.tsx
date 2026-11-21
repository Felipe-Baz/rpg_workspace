"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chamarIa } from "@/lib/ia-cliente";
import { uid } from "@/lib/mesas";
import type { Colecao, Mapa } from "@/lib/mapas";
import { useJob } from "@/lib/cena/cenas";
import {
  aceitos,
  atualizarSegmento,
  dividirSegmento,
  estimarConversao,
  juntarSegmentos,
  mascaraDe,
  MAX_OBJETOS_CONVERSAO,
  type JobConversao,
  type Revisao,
} from "@/lib/mapas-ia/conversao/conversao";
import { area, type Mascara } from "@/lib/mapas-ia/conversao/mascaras";
import { STATUS_ROTULO, jobExpirado } from "@/lib/mapas-ia/assets/jobs";
import { estimarLote } from "@/lib/mapas-ia/limites";

const btn = "rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-border/50 disabled:opacity-40";
const btnPrim = "rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50";
const campo = "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground";

const CORES: [number, number, number][] = [
  [239, 68, 68], [59, 130, 246], [234, 179, 8], [34, 197, 94], [217, 70, 239], [249, 115, 22], [20, 184, 166], [168, 85, 247],
];
const corCss = (i: number) => `rgb(${CORES[i % CORES.length].join(",")})`;

type RespSegmentar = { revisao: Revisao; inpainting: boolean; uso: { total: number }; teto: number };

/** Índice do segmento visível em cada pixel (os menores por cima), -1 = fundo. */
function rotular(rev: Revisao, mascaras: Map<string, Mascara>): Int16Array {
  const r = new Int16Array(rev.largura * rev.altura).fill(-1);
  const ordem = rev.segmentos.map((s, i) => ({ i, n: area(mascaras.get(s.id)!) })).sort((a, b) => b.n - a.n);
  for (const { i } of ordem) {
    const m = mascaras.get(rev.segmentos[i].id)!;
    for (let p = 0; p < m.bits.length; p++) if (m.bits[p]) r[p] = i;
  }
  return r;
}

/** Sobreposição da revisão: objetos aceitos coloridos, descartados apagados, selecionados realçados. */
function pintarRevisao(cv: HTMLCanvasElement, rev: Revisao, rot: Int16Array, sel: Set<string>) {
  cv.width = rev.largura;
  cv.height = rev.altura;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(rev.largura, rev.altura);
  for (let p = 0; p < rot.length; p++) {
    const i = rot[p];
    if (i < 0) continue;
    const s = rev.segmentos[i];
    const [r, g, b] = s.aceito ? CORES[i % CORES.length] : [120, 120, 120];
    img.data[p * 4] = r;
    img.data[p * 4 + 1] = g;
    img.data[p * 4 + 2] = b;
    img.data[p * 4 + 3] = sel.has(s.id) ? 200 : s.aceito ? 110 : 40;
  }
  ctx.putImageData(img, 0, 0);
}

/** Prévia do fundo: onde os objetos aceitos saem fica xadrez (será reconstruído) ou contornado (conversão parcial). */
function pintarPrevia(cv: HTMLCanvasElement, rev: Revisao, rot: Int16Array, inpainting: boolean) {
  cv.width = rev.largura;
  cv.height = rev.altura;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(rev.largura, rev.altura);
  const w = rev.largura;
  for (let p = 0; p < rot.length; p++) {
    const i = rot[p];
    if (i < 0 || !rev.segmentos[i].aceito) continue;
    const x = p % w, y = Math.floor(p / w);
    if (inpainting) {
      const claro = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      img.data.set(claro ? [230, 230, 230, 255] : [170, 170, 170, 255], p * 4);
    } else {
      const borda = rot[p - 1] !== i || rot[p + 1] !== i || rot[p - w] !== i || rot[p + w] !== i;
      if (borda) img.data.set([250, 204, 21, 255], p * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function ConverterCena({
  mesaId,
  mapa,
  colecao,
  onConvertido,
  onFechar,
}: {
  mesaId: string;
  mapa: Mapa;
  colecao: Colecao;
  onConvertido: (mapaId: string) => void;
  onFechar: () => void;
}) {
  const [fase, setFase] = useState<"segmentando" | "revisao" | "enviando" | "job">("segmentando");
  const [dados, setDados] = useState<Omit<RespSegmentar, "revisao"> | null>(null);
  const [rev, setRev] = useState<Revisao | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob<JobConversao>(mesaId, jobId);
  const sobreposicao = useRef<HTMLCanvasElement>(null);
  const previa = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let vivo = true;
    chamarIa<RespSegmentar>("segmentar", { corpo: { mesaId, mapaId: mapa.id, colecao } })
      .then(({ revisao, ...resto }) => {
        if (!vivo) return;
        setRev(revisao);
        setDados(resto);
        setFase("revisao");
      })
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [mesaId, mapa.id, colecao]);

  const mascaras = useMemo(() => new Map((rev?.segmentos ?? []).map((s) => [s.id, mascaraDe(rev!, s)])), [rev]);
  const rot = useMemo(() => (rev ? rotular(rev, mascaras) : null), [rev, mascaras]);

  useEffect(() => {
    if (!rev || !rot || fase !== "revisao") return;
    if (sobreposicao.current) pintarRevisao(sobreposicao.current, rev, rot, sel);
    if (previa.current) pintarPrevia(previa.current, rev, rot, !!dados?.inpainting);
  }, [rev, rot, sel, dados, fase]);

  const lista = rev ? aceitos(rev) : [];
  const est = estimarConversao(lista.length, !!dados?.inpainting);
  const lote = dados ? estimarLote(dados.uso, dados.teto, est.geracoes) : null;
  const podeConverter = lista.length > 0 && !est.excedeLimite && (lote?.cabeNoTeto ?? true);

  const alternarSel = (id: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  function clicarImagem(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!rev || !rot) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * rev.largura);
    const y = Math.floor(((e.clientY - r.top) / r.height) * rev.altura);
    const i = rot[y * rev.largura + x];
    if (i >= 0) alternarSel(rev.segmentos[i].id);
  }

  async function converter() {
    if (!rev) return;
    setFase("enviando");
    setErro("");
    try {
      const pedido = { mapaId: mapa.id, colecao, largura: rev.largura, altura: rev.altura, objetos: lista.map((s) => ({ nome: s.nome, rle: s.rle, incompleto: s.incompleto })) };
      const r = await chamarIa<{ jobId: string }>("inpaint", { corpo: { mesaId, pedido, confirmado: true } });
      setJobId(r.jobId);
      setFase("job");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao iniciar a conversão.");
      setFase("revisao");
    }
  }

  const expirado = job ? jobExpirado(job) : false;
  const emAndamento = !!job && (job.status === "na-fila" || job.status === "gerando") && !expirado;

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Converter em cena">
      <div className="flex max-h-full w-full max-w-6xl flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Converter “{mapa.nome}” em cena</h2>
          <button className={btn} onClick={onFechar} disabled={fase === "enviando"}>Fechar</button>
        </div>
        <p className="text-xs text-muted">
          Melhor esforço: a IA sugere os objetos e reconstrói o fundo; você revisa antes. Um <strong>novo</strong> mapa de cena é criado com as mesmas zonas, coberturas e pinos; este mapa não é alterado.
        </p>
        {erro && <p className="rounded-lg bg-red-500/10 p-2 text-sm text-red-500">{erro}</p>}

        {fase === "segmentando" && !erro && <p className="text-sm text-muted" aria-live="polite">Procurando objetos no mapa…</p>}

        {fase !== "segmentando" && fase !== "job" && rev && (
          <>
            {rev.segmentos.length === 0 && <p className="text-sm text-muted">A IA não encontrou objetos separáveis neste mapa.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              <figure className="space-y-1">
                <div className="relative leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mapa.imagem} alt={mapa.nome} className="block w-full rounded-lg" />
                  <canvas ref={sobreposicao} onClick={clicarImagem} className="absolute inset-0 h-full w-full cursor-pointer rounded-lg" aria-label="Máscaras sugeridas: clique para selecionar" />
                </div>
                <figcaption className="text-xs text-muted">Original com as máscaras (clique para selecionar).</figcaption>
              </figure>
              <figure className="space-y-1">
                <div className="relative leading-[0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mapa.imagem} alt="" className="block w-full rounded-lg" />
                  <canvas ref={previa} className="pointer-events-none absolute inset-0 h-full w-full rounded-lg" />
                </div>
                <figcaption className="text-xs text-muted">
                  {dados?.inpainting ? "Prévia do fundo: as áreas em xadrez viram objetos e serão reconstruídas." : "Prévia: os objetos contornados viram objetos, mas também continuam no fundo."}
                </figcaption>
              </figure>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className={btn} disabled={sel.size < 2} onClick={() => { setRev(juntarSegmentos(rev, [...sel], uid)); setSel(new Set()); }}>
                Juntar selecionados ({sel.size})
              </button>
              <button className={btn} disabled={sel.size === 0} onClick={() => setSel(new Set())}>Limpar seleção</button>
              <span className={`ml-auto text-sm ${est.excedeLimite ? "text-red-500" : "text-muted"}`}>
                {lista.length} de {MAX_OBJETOS_CONVERSAO} objetos aceitos
              </span>
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border">
              {rev.segmentos.map((s, i) => (
                <li key={s.id} className={`flex flex-wrap items-center gap-2 p-2 text-sm ${s.aceito ? "" : "opacity-60"}`}>
                  <input type="checkbox" checked={sel.has(s.id)} onChange={() => alternarSel(s.id)} aria-label={`Selecionar ${s.nome}`} />
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.aceito ? corCss(i) : "rgb(120,120,120)" }} />
                  <input className={`${campo} max-w-56 flex-1`} value={s.nome} onChange={(e) => setRev(atualizarSegmento(rev, s.id, { nome: e.target.value }))} aria-label="Nome do objeto" />
                  <button className={s.aceito ? btn : `${btn} border-emerald-600 text-emerald-400`} onClick={() => setRev(atualizarSegmento(rev, s.id, { aceito: !s.aceito }))}>
                    {s.aceito ? "Descartar" : "Aceitar"}
                  </button>
                  <button className={btn} onClick={() => setRev(dividirSegmento(rev, s.id, uid))} title="Separa partes soltas ou corta ao meio">Dividir</button>
                  <label className="flex items-center gap-1 text-xs text-muted" title="Cortado ou encoberto: pode ser completado por IA depois">
                    <input type="checkbox" checked={s.incompleto} onChange={(e) => setRev(atualizarSegmento(rev, s.id, { incompleto: e.target.checked }))} />
                    incompleto
                  </label>
                </li>
              ))}
            </ul>

            <div className="space-y-1 rounded-lg border border-border p-2 text-sm">
              {dados?.inpainting ? (
                <p>
                  Custo estimado: <strong>{est.geracoes}</strong> geração(ões) de imagem para reconstruir o fundo (uma a cada 4 objetos).
                  {lote && ` Restam ${Math.max(0, dados!.teto - dados!.uso.total)} de ${dados!.teto} no período.`}
                </p>
              ) : (
                <p className="text-amber-500">O provedor de imagem ativo não reconstrói o fundo: a conversão será parcial, sem custo de imagem, e os objetos continuam desenhados no fundo.</p>
              )}
              {est.excedeLimite && <p className="text-red-500">Há mais objetos aceitos que o limite. Descarte ou junte alguns antes de converter.</p>}
              {lote && !lote.cabeNoTeto && <p className="text-red-500">A conversão passa do teto de gastos da mesa. Aumente o teto ou converta menos objetos.</p>}
            </div>

            <div className="flex justify-end gap-2">
              <button className={btn} onClick={onFechar}>Cancelar</button>
              <button className={btnPrim} disabled={!podeConverter || fase === "enviando"} onClick={converter}>
                {fase === "enviando" ? "Iniciando…" : `Converter ${lista.length} objeto(s)`}
              </button>
            </div>
          </>
        )}

        {fase === "job" && (
          <div className="space-y-3" aria-live="polite">
            {!job && <p className="text-sm text-muted">Aguardando o servidor…</p>}
            {job && (
              <>
                <p className="text-sm">
                  {expirado ? "Expirado" : STATUS_ROTULO[job.status]}
                  {job.etapa && emAndamento ? ` · ${job.etapa}` : ""}
                </p>
                <div className="h-2 overflow-hidden rounded bg-border" role="progressbar" aria-valuenow={job.progresso} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-violet-600 transition-all" style={{ width: `${job.status === "falhou" ? 0 : job.progresso}%` }} />
                </div>
                {(job.erro || expirado) && (
                  <p className="rounded-lg bg-red-500/10 p-2 text-sm text-red-500">
                    {job.erro ?? "A conversão parou de responder."} Nenhum mapa novo foi criado e o original não mudou.
                  </p>
                )}
                {job.status === "pronto" && job.resultado && (
                  <div className="space-y-2">
                    <p className="text-sm text-emerald-500">Pronto: {job.resultado.assetIds.length - 1} objeto(s) e o fundo foram para a biblioteca da mesa.</p>
                    {job.resultado.avisos.map((a) => <p key={a} className="text-sm text-amber-500">{a}</p>)}
                    <p className="text-xs text-muted">O novo mapa ainda não está liberado para os jogadores.</p>
                    <button className={btnPrim} onClick={() => onConvertido(job.resultado!.mapaId)}>Abrir no editor</button>
                  </div>
                )}
                {(job.status === "falhou" || expirado) && (
                  <button className={btn} onClick={() => { setJobId(null); setFase("revisao"); }}>Voltar à revisão</button>
                )}
              </>
            )}
            {emAndamento && <p className="text-xs text-muted">Pode fechar: a conversão continua e o novo mapa aparece na lista quando ficar pronto.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
