// Jobs de geração (mesas/{id}/jobs/{jobId}) e validação do pedido. Módulo puro.
import type { TipoAsset } from "../../cena/tipos.ts";
import { normalizarTags, TIPOS_ASSET } from "./biblioteca.ts";

export type StatusJob = "na-fila" | "gerando" | "pronto" | "falhou";

export interface PedidoAsset {
  tipo: TipoAsset;
  descricao: string;
  nome: string;
  tags: string[];
  temaId?: string;
  perspectivaId?: string;
  /** Largura sugerida ao carimbar, em células. */
  escalaBase: number;
  /** Quantas imagens (variações do mesmo pedido). */
  quantidade: number;
  /** Regeneração: nova versão do asset indicado, guiada por `instrucao`. */
  baseAssetId?: string;
  instrucao?: string;
}

export interface Job {
  id: string;
  status: StatusJob;
  /** 0–100. */
  progresso: number;
  etapa?: string;
  pedido: PedidoAsset;
  /** Ids dos assets criados. */
  resultado?: { assetIds: string[] };
  /** Mensagem clara para o mestre quando falhou (ou parcial). */
  erro?: string;
  criadoEm: number;
  atualizadoEm: number;
}

export const STATUS_ROTULO: Record<StatusJob, string> = {
  "na-fila": "Na fila",
  gerando: "Gerando",
  pronto: "Pronto",
  falhou: "Falhou",
};

export const MAX_VARIACOES = 8;

/** Valida e normaliza o corpo vindo do cliente. Lança Error com mensagem para o mestre. */
export function validarPedido(bruto: unknown): PedidoAsset {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const tipo = TIPOS_ASSET.find((t) => t.tipo === b.tipo)?.tipo;
  if (!tipo) throw new Error("Tipo de asset inválido.");
  const descricao = typeof b.descricao === "string" ? b.descricao.trim().slice(0, 500) : "";
  if (!descricao) throw new Error("Descreva o asset.");
  const nome = (typeof b.nome === "string" ? b.nome.trim() : "").slice(0, 80) || descricao.slice(0, 80);
  const informadas = Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === "string") : typeof b.tags === "string" ? [b.tags] : [];
  const tags = normalizarTags([...informadas, descricao]);
  const escalaBase = Math.min(10, Math.max(0.25, Number(b.escalaBase) || 1));
  const quantidade = Math.min(MAX_VARIACOES, Math.max(1, Math.round(Number(b.quantidade) || 1)));
  const id = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);
  const instrucao = typeof b.instrucao === "string" && b.instrucao.trim() ? b.instrucao.trim().slice(0, 500) : undefined;
  return { tipo, descricao, nome, tags, escalaBase, quantidade, temaId: id(b.temaId), perspectivaId: id(b.perspectivaId), baseAssetId: id(b.baseAssetId), instrucao };
}

/** Job que ficou "na fila"/"gerando" por mais que isto está preso (ex.: o servidor foi interrompido). */
export const TEMPO_MAX_JOB_MS = 10 * 60_000;
export const jobExpirado = (j: Pick<Job, "status" | "atualizadoEm">, agora = Date.now()) =>
  (j.status === "na-fila" || j.status === "gerando") && agora - j.atualizadoEm > TEMPO_MAX_JOB_MS;
