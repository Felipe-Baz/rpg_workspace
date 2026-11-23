"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chamarIa, streamIa } from "@/lib/ia-cliente";
import { aguardarJob } from "@/lib/cena/cenas";
import type { Cena } from "@/lib/cena/tipos";
import type { MensagemChat } from "@/lib/mapas-ia/agente/agente";
import { PREFIXO_PROVISORIO } from "@/lib/mapas-ia/agente/ferramentas";
import { objetosDoPasso, provisoriosUsados, substituirIds } from "@/lib/mapas-ia/agente/passos";
import type { EventoAgente, GeracaoPendente, Passo, Plano } from "@/lib/mapas-ia/agente/tipos";
import { estimarLote, type Estimativa } from "@/lib/mapas-ia/limites";

const btn = "rounded-lg border border-border px-2 py-1 text-xs hover:bg-border/50 disabled:opacity-40";
const btnPrim = "rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50";
const CHAVE_SO_SUGERIR = "chatIa.soSugerir";

const ehProvisorio = (id: string) => id.startsWith(PREFIXO_PROVISORIO);

type Mensagem =
  | { papel: "usuario"; texto: string }
  | { papel: "assistente"; plano: Plano; descartados: string[] }
  | { papel: "erro"; texto: string };

interface Confirmacao {
  passos: Passo[];
  geracoes: GeracaoPendente[];
  estimativa?: Estimativa;
  erro?: string;
  progresso?: string;
}

export interface Props {
  mesaId: string;
  cena: Cena;
  selecao: string[];
  /** Passos da IA no histórico (aplicados) e os revertidos depois. */
  aplicados: Set<string>;
  revertidos: Set<string>;
  /** Pedido feito ao criar o mapa (enviado uma vez ao abrir). */
  pedidoInicial?: string;
  onPrevia: (passos: Passo[], destaque: string[]) => void;
  /** Aplica cada passo como uma entrada de undo; devolve quantas ações foram ignoradas. */
  onAplicar: (passos: Passo[]) => number;
  onReverter: (ids: string[]) => void;
}

export default function ChatIA({ mesaId, cena, selecao, aplicados, revertidos, pedidoInicial, onPrevia, onAplicar, onReverter }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [atividade, setAtividade] = useState<string[]>([]);
  const [parcial, setParcial] = useState<Passo[]>([]);
  // Só roda no cliente (o editor é carregado com ssr: false).
  const [soSugerir, setSoSugerir] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_SO_SUGERIR) !== "0";
    } catch {
      return true;
    }
  });
  const [idsReais, setIdsReais] = useState<Record<string, string>>({});
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [destaquePasso, setDestaquePasso] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const abortar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const enviouInicial = useRef(false);

  const alternarSoSugerir = (v: boolean) => {
    setSoSugerir(v);
    try {
      localStorage.setItem(CHAVE_SO_SUGERIR, v ? "1" : "0");
    } catch {}
  };

  // Com chaves: navegadores recentes fazem scrollIntoView devolver uma Promise, que o React tomaria por limpeza.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens, atividade, parcial, confirmacao]);

  // Plano mais recente: só os passos dele entram na prévia (planos antigos ficaram para trás).
  const iUltimo = mensagens.findLastIndex((m) => m.papel === "assistente");
  const ultimo = iUltimo >= 0 ? (mensagens[iUltimo] as Extract<Mensagem, { papel: "assistente" }>) : null;
  const pendentes = useMemo(
    () => (ultimo ? ultimo.plano.passos.filter((p) => !aplicados.has(p.id) && !ultimo.descartados.includes(p.id)) : []),
    [ultimo, aplicados],
  );
  const comIdsReais = (passos: Passo[]) => passos.map((p) => ({ ...p, comandos: substituirIds(p.comandos, idsReais, ehProvisorio) }));

  // Prévia: passos pendentes do último plano (ou os que chegam em streaming), com destaque.
  useEffect(() => {
    const passos = enviando ? parcial : pendentes;
    const foco = destaquePasso ? passos.filter((p) => p.id === destaquePasso) : passos;
    onPrevia(comIdsReais(passos), foco.flatMap(objetosDoPasso));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enviando, parcial, pendentes, destaquePasso, idsReais]);
  useEffect(() => () => onPrevia([], []), [onPrevia]);

  /** Gerações que os passos precisam antes de aplicar (próprias ou usadas de passos anteriores), ainda sem asset real. */
  function geracoesNecessarias(passos: Passo[], plano: Plano): GeracaoPendente[] {
    const todas = new Map(plano.passos.flatMap((p) => p.geracoes).map((g) => [g.idProvisorio, g]));
    const ids = new Set(passos.flatMap((p) => [...p.geracoes.map((g) => g.idProvisorio), ...provisoriosUsados(p.comandos, ehProvisorio)]));
    return [...ids].filter((id) => !idsReais[id]).map((id) => todas.get(id)).filter((g): g is GeracaoPendente => !!g);
  }

  function aplicar(passos: Passo[], mapa = idsReais) {
    const ignorados = onAplicar(passos.map((p) => ({ ...p, comandos: substituirIds(p.comandos, mapa, ehProvisorio) })));
    if (ignorados) setAviso(`${ignorados} ação(ões) não se aplicavam mais à cena e foram ignoradas.`);
  }

  /** Executa passos; se precisarem de assets novos, mostra a estimativa e pede confirmação antes. */
  async function executar(passos: Passo[]) {
    if (!ultimo || !passos.length) return;
    setAviso("");
    const geracoes = geracoesNecessarias(passos, ultimo.plano);
    if (!geracoes.length) return aplicar(passos);
    setConfirmacao({ passos, geracoes });
    try {
      const u = await chamarIa<{ uso: { total: number }; teto: number }>(`uso?mesaId=${encodeURIComponent(mesaId)}`);
      setConfirmacao({ passos, geracoes, estimativa: estimarLote(u.uso, u.teto, geracoes.length) });
    } catch {
      setConfirmacao({ passos, geracoes, erro: "Não foi possível consultar o teto de gasto; o servidor ainda o aplicará." });
    }
  }

  async function confirmarGeracao() {
    const c = confirmacao;
    if (!c) return;
    const mapa = { ...idsReais };
    const falhas: string[] = [];
    let feitos = 0;
    const atualizar = () => setConfirmacao({ ...c, progresso: `Gerando ${feitos}/${c.geracoes.length}…` });
    atualizar();
    try {
      // Pedidos em sequência (cada um passa pelo teto no servidor); as gerações correm em paralelo.
      const jobs: { g: GeracaoPendente; jobId: string }[] = [];
      for (const g of c.geracoes) {
        try {
          const r = await chamarIa<{ jobId: string }>("gerar-asset", { corpo: { mesaId, pedido: g.pedido, confirmado: true } });
          jobs.push({ g, jobId: r.jobId });
        } catch (e) {
          falhas.push(`${g.pedido.nome}: ${e instanceof Error ? e.message : "falhou"}`);
          if ((e as { status?: number }).status === 429) break; // teto atingido: não adianta tentar os outros
        }
      }
      await Promise.all(
        jobs.map(async ({ g, jobId }) => {
          try {
            const job = await aguardarJob(mesaId, jobId);
            const real = job.resultado?.assetIds?.[0];
            if (job.status === "pronto" && real) mapa[g.idProvisorio] = real;
            else falhas.push(`${g.pedido.nome}: ${job.erro ?? "falhou"}`);
          } catch (e) {
            falhas.push(`${g.pedido.nome}: ${e instanceof Error ? e.message : "falhou"}`);
          }
          feitos++;
          atualizar();
        }),
      );
    } finally {
      setIdsReais(mapa);
      setConfirmacao(null);
    }
    aplicar(c.passos, mapa);
    if (falhas.length) setAviso(`Alguns assets não foram gerados e as ações que os usavam foram omitidas: ${falhas.join("; ")}`);
  }

  async function enviar(texto = entrada) {
    const pedido = texto.trim();
    if (!pedido || enviando) return;
    const conversa: MensagemChat[] = mensagens.flatMap((m): MensagemChat[] =>
      m.papel === "usuario" ? [{ papel: "usuario", texto: m.texto }] : m.papel === "assistente" && m.plano.texto ? [{ papel: "assistente", texto: m.plano.texto }] : [],
    );
    setMensagens((ms) => [...ms, { papel: "usuario", texto: pedido }]);
    setEntrada("");
    setEnviando(true);
    setAtividade([]);
    setParcial([]);
    setAviso("");
    setDestaquePasso(null);
    const ctl = new AbortController();
    abortar.current = ctl;
    let plano: Plano | null = null;
    try {
      await streamIa<EventoAgente>(
        "agente",
        { mesaId, pedido, cena, selecao, conversa },
        (ev) => {
          if (ev.tipo === "texto") setAtividade((a) => [...a, ev.texto]);
          else if (ev.tipo === "ferramenta") setAtividade((a) => [...a, `${ev.ok ? "✓" : "✗"} ${ev.nome}${ev.mensagem ? `: ${ev.mensagem}` : ""}`]);
          else if (ev.tipo === "passo") setParcial((p) => [...p, ev.passo]);
          else if (ev.tipo === "fim") plano = ev.plano;
          else if (ev.tipo === "erro") throw new Error(ev.erro);
        },
        ctl.signal,
      );
      if (!plano) throw new Error("A resposta do agente terminou sem plano.");
      const p: Plano = plano;
      setMensagens((ms) => [...ms, { papel: "assistente", plano: p, descartados: [] }]);
      if (!soSugerir) {
        // Aplica direto até o primeiro passo que precise gerar assets (esse pede confirmação).
        const livres: Passo[] = [];
        for (const passo of p.passos) {
          if (passo.geracoes.length || provisoriosUsados(passo.comandos, ehProvisorio).length) break;
          livres.push(passo);
        }
        if (livres.length) aplicar(livres);
      }
    } catch (e) {
      const msg = ctl.signal.aborted ? "Pedido cancelado." : e instanceof Error ? e.message : "Falha ao falar com o agente.";
      setMensagens((ms) => [...ms, { papel: "erro", texto: msg }]);
    } finally {
      setEnviando(false);
      setParcial([]);
      abortar.current = null;
    }
  }

  useEffect(() => {
    if (pedidoInicial && !enviouInicial.current) {
      enviouInicial.current = true;
      void enviar(pedidoInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoInicial]);

  const descartar = (ids: string[]) =>
    setMensagens((ms) => ms.map((m, i) => (i === iUltimo && m.papel === "assistente" ? { ...m, descartados: [...m.descartados, ...ids] } : m)));

  const estadoPasso = (m: Extract<Mensagem, { papel: "assistente" }>, p: Passo) =>
    revertidos.has(p.id) ? "revertido" : aplicados.has(p.id) ? "aplicado" : m.descartados.includes(p.id) ? "descartado" : "pendente";
  const ROTULO = { pendente: "Prévia", aplicado: "Aplicado", revertido: "Revertido", descartado: "Descartado" } as const;
  const COR = { pendente: "text-cyan-400", aplicado: "text-ok", revertido: "text-muted line-through", descartado: "text-muted line-through" } as const;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <h3 className="text-xs uppercase tracking-wider text-muted">Assistente de mapa</h3>
        <label className="ml-auto flex items-center gap-1 text-xs text-muted" title="Mostra a prévia e não aplica nada até você aceitar">
          <input type="checkbox" checked={soSugerir} onChange={(e) => alternarSoSugerir(e.target.checked)} /> Só sugerir
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 text-sm">
        {!mensagens.length && !enviando && (
          <p className="text-xs text-muted">
            Descreva o mapa ou o ajuste: “taverna de beira de estrada com lareira”, “espalhe árvores no norte”, “deixe isto maior”.
            {selecao.length ? " O objeto selecionado vai junto como contexto." : ""}
          </p>
        )}
        {mensagens.map((m, i) =>
          m.papel === "usuario" ? (
            <p key={i} className="ml-6 whitespace-pre-wrap rounded-lg bg-accent/20 px-2 py-1.5">{m.texto}</p>
          ) : m.papel === "erro" ? (
            <p key={i} className="rounded-lg bg-danger/10 px-2 py-1.5 text-danger">{m.texto}</p>
          ) : (
            <div key={i} className={`space-y-1.5 rounded-lg border border-border p-2 ${i === iUltimo ? "" : "opacity-60"}`}>
              {m.plano.texto && <p className="whitespace-pre-wrap">{m.plano.texto}</p>}
              {m.plano.avisos.map((a) => (
                <p key={a} className="text-xs text-warn">⚠ {a}</p>
              ))}
              {!m.plano.passos.length && <p className="text-xs text-muted">Nenhuma alteração proposta.</p>}
              {m.plano.passos.map((p, k) => {
                const est = estadoPasso(m, p);
                return (
                  <details
                    key={p.id}
                    className="rounded-md border border-border/70 px-2 py-1"
                    onMouseEnter={() => est === "pendente" && setDestaquePasso(p.id)}
                    onMouseLeave={() => setDestaquePasso(null)}
                  >
                    <summary className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <span className="font-medium">{k + 1}. {p.titulo}</span>
                      <span className={COR[est]}>{ROTULO[est]}</span>
                      {p.geracoes.length > 0 && <span className="text-warn" title="Gera assets novos">✦{p.geracoes.length}</span>}
                      <span className="ml-auto flex gap-1">
                        {i === iUltimo && est === "pendente" && (
                          <>
                            <button className={btn} disabled={!!confirmacao} onClick={(e) => (e.preventDefault(), executar([p]))}>Aplicar</button>
                            <button className={btn} onClick={(e) => (e.preventDefault(), descartar([p.id]))}>✕</button>
                          </>
                        )}
                        {est === "aplicado" && (
                          <button className={btn} onClick={(e) => (e.preventDefault(), onReverter([p.id]))}>Reverter</button>
                        )}
                      </span>
                    </summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                      {p.resumo.map((r, j) => (
                        <li key={j}>{r}</li>
                      ))}
                    </ul>
                    {p.avisos.map((a) => (
                      <p key={a} className="text-xs text-warn">⚠ {a}</p>
                    ))}
                  </details>
                );
              })}
              {i === iUltimo && pendentes.length > 0 && (
                <div className="flex gap-1 pt-1">
                  <button className={btnPrim} disabled={!!confirmacao} onClick={() => executar(pendentes)}>Executar tudo</button>
                  <button className={btn} disabled={!!confirmacao} onClick={() => executar(pendentes.slice(0, 1))}>Próximo passo</button>
                  <button className={btn} onClick={() => descartar(pendentes.map((p) => p.id))}>Descartar</button>
                </div>
              )}
            </div>
          ),
        )}

        {enviando && (
          <div className="space-y-1 rounded-lg border border-dashed border-border p-2 text-xs text-muted">
            <p className="animate-pulse">Montando o plano…</p>
            {atividade.slice(-6).map((a, k) => (
              <p key={k} className="truncate">{a}</p>
            ))}
            {parcial.map((p) => (
              <p key={p.id} className="text-cyan-400">◦ {p.titulo} ({p.resumo.length} ações)</p>
            ))}
            <button className={btn} onClick={() => abortar.current?.abort()}>Cancelar</button>
          </div>
        )}

        {confirmacao && (
          <div className="space-y-1.5 rounded-lg border border-warn/60 bg-warn/5 p-2 text-xs" role="alertdialog" aria-label="Confirmar geração">
            <p className="font-medium">Este plano precisa gerar {confirmacao.geracoes.length} asset(s) novo(s):</p>
            <ul className="list-disc pl-4 text-muted">
              {confirmacao.geracoes.map((g) => (
                <li key={g.idProvisorio}>{g.pedido.nome} ({g.pedido.tipo})</li>
              ))}
            </ul>
            {confirmacao.estimativa && (
              <p className={confirmacao.estimativa.cabeNoTeto ? "text-muted" : "text-danger"}>
                {confirmacao.estimativa.cabeNoTeto
                  ? `Custo: ${confirmacao.estimativa.quantidade} geração(ões). Restam ${confirmacao.estimativa.restanteAposLote} no teto do período depois disso.`
                  : `Excede o teto de gasto (restam menos de ${confirmacao.estimativa.quantidade}). Aumente o teto na tela de IA ou descarte os passos que geram assets.`}
              </p>
            )}
            {!confirmacao.estimativa && !confirmacao.erro && <p className="text-muted">Calculando estimativa…</p>}
            {confirmacao.erro && <p className="text-warn">{confirmacao.erro}</p>}
            {confirmacao.progresso ? (
              <p className="animate-pulse">{confirmacao.progresso}</p>
            ) : (
              <div className="flex gap-1">
                <button
                  className={btnPrim}
                  disabled={!(confirmacao.estimativa?.cabeNoTeto || confirmacao.erro)}
                  onClick={confirmarGeracao}
                >
                  Confirmar e gerar
                </button>
                <button className={btn} onClick={() => setConfirmacao(null)}>Cancelar</button>
              </div>
            )}
          </div>
        )}
        {aviso && <p className="text-xs text-warn">{aviso}</p>}
        <div ref={fim} />
      </div>

      <form
        className="space-y-1 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        {selecao.length > 0 && <p className="text-xs text-muted">Contexto: {selecao.length} objeto(s) selecionado(s).</p>}
        <textarea
          className="h-16 w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm placeholder:text-muted"
          placeholder="O que você quer no mapa?"
          value={entrada}
          disabled={enviando}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
        />
        <button className={`${btnPrim} w-full py-1.5`} disabled={enviando || !entrada.trim()}>
          {enviando ? "Aguardando…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
