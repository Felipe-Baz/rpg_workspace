// Contratos do agente criador de mapas. Módulo puro: o agente só conhece cena, assets, tema e
// `ProvedorLlm`; nada de fabricante, React ou Firebase.
import type { Comando } from "../../cena/comandos.ts";
import type { Asset, Cena } from "../../cena/tipos.ts";
import type { PedidoAsset } from "../assets/jobs.ts";
import type { Tema } from "../temas/tipos.ts";

/** JSON Schema (subconjunto) dos argumentos. É o mesmo enviado ao LLM e usado na validação. */
export type Schema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
};

/** Asset a gerar só depois da estimativa e da confirmação do mestre. */
export interface GeracaoPendente {
  /** Id provisório usado nos comandos do passo até o asset real existir. */
  idProvisorio: string;
  pedido: PedidoAsset;
}

export interface Passo {
  id: string;
  titulo: string;
  comandos: Comando[];
  /** Uma linha por ação, para a prévia e o histórico. */
  resumo: string[];
  geracoes: GeracaoPendente[];
  /** Ex.: asset de outro tema usado. Mostrados ao mestre. */
  avisos: string[];
}

export interface Plano {
  /** Texto do agente (explicação do plano). */
  texto: string;
  passos: Passo[];
  avisos: string[];
  /** O pedido parou num limite (passos, comandos, iterações ou tempo). */
  interrompido?: string;
}

/** Estado mutável de um pedido: a cena simulada acumula os comandos já propostos. */
export interface EstadoAgente {
  cena: Cena;
  /** Assets da mesa (+ provisórios das gerações pendentes). */
  assets: Asset[];
  tema?: Tema;
  /** Ids dos objetos selecionados no editor. */
  selecao: string[];
  passos: Passo[];
  /** Termos já consultados por `buscar_asset` (regra: buscar antes de gerar). */
  buscas: string[];
  novoId: () => string;
  /** Total de comandos já propostos (limite por resposta). */
  totalComandos: number;
}

export interface ResultadoFerramenta {
  /** Comandos da cena (vazio para consultas). */
  comandos?: Comando[];
  /** Linhas do resumo do passo. */
  resumo?: string[];
  geracoes?: GeracaoPendente[];
  avisos?: string[];
  /** Devolvido ao LLM (JSON). */
  resposta: unknown;
}

export interface Ferramenta {
  nome: string;
  descricao: string;
  schemaArgs: Schema & { type: "object" };
  /** Consulta (não abre passo nem gera comandos). */
  consulta?: boolean;
  /** Lança ErroFerramenta para argumentos inválidos; nesse caso nada é aplicado. */
  executar(estado: EstadoAgente, args: Record<string, unknown>): ResultadoFerramenta;
}

/** Erro de validação devolvido ao LLM como resultado da ferramenta. */
export class ErroFerramenta extends Error {}

export interface Limites {
  maxPassos: number;
  maxComandos: number;
  /** Rodadas de conversa com o LLM. */
  maxIteracoes: number;
  tempoMaxMs: number;
}

export const LIMITES_PADRAO: Limites = { maxPassos: 12, maxComandos: 1500, maxIteracoes: 16, tempoMaxMs: 240_000 };

/** Eventos enviados ao cliente em streaming (uma linha JSON cada). */
export type EventoAgente =
  | { tipo: "texto"; texto: string }
  | { tipo: "ferramenta"; nome: string; ok: boolean; mensagem?: string }
  | { tipo: "passo"; passo: Passo }
  | { tipo: "fim"; plano: Plano }
  | { tipo: "erro"; erro: string };
