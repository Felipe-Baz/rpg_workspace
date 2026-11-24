// Contrato de um "sistema de regras" (D&D 5e hoje; Tormenta20, Pathfinder etc. no futuro).
// A mesa guarda só o NOME do sistema (texto livre, ver `sistemas.ts`); `regrasDoSistema` (registro.ts) o associa a
// um módulo de regras. Sistema sem módulo continua válido: simplesmente não tem ficha automatizada.

import type { Fonte } from "./efeitos.ts";

/** Regra opcional que o mestre liga/desliga nas configurações da mesa (ex.: talentos, multiclasse). */
export type OpcaoRegra = { id: string; nome: string; descricao: string; padrao: boolean };

/** Um problema encontrado ao validar uma ficha contra as regras. */
export type Violacao = {
  id: string; // estável, ex.: "magias.limite", "talento.desligado"
  mensagem: string;
  /** Caminho do dado afetado na ficha, para destacar o campo. */
  campo?: string;
  /** `aviso` (ex.: escolha ainda pendente) nunca bloqueia; sem valor = bloqueio. */
  gravidade?: "bloqueio" | "aviso";
};

/** Quem edita: o jogador é bloqueado pelas violações; o mestre pode passar por cima (e a ficha fica marcada). */
export type Papel = "jogador" | "mestre";

export type SistemaRegras = {
  id: string; // "dnd5e"
  nome: string; // "D&D 5e"
  /** Diz se o nome de sistema digitado na mesa é este sistema. */
  reconhece: (nomeSistema: string) => boolean;
  /** Regras opcionais que a mesa pode ativar. */
  opcoes: readonly OpcaoRegra[];
};

/** Valores das opções de uma mesa: `{ talentos: true, multiclasse: false }`. Ausente = padrão da opção. */
export type OpcoesMesa = Record<string, boolean>;

export const opcaoAtiva = (sistema: SistemaRegras, escolhidas: OpcoesMesa | undefined, id: string): boolean =>
  escolhidas?.[id] ?? sistema.opcoes.find((o) => o.id === id)?.padrao ?? false;

/** O jogador é bloqueado por qualquer violação; o mestre nunca. */
export const bloqueia = (papel: Papel, violacoes: readonly Violacao[]): boolean => papel === "jogador" && violacoes.some((v) => v.gravidade !== "aviso");

export type { Fonte };
