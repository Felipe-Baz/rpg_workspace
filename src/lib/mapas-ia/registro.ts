import { anthropicLlm } from "./provedores/anthropic-llm.ts";
import { googleImagem } from "./provedores/google-imagem.ts";
import { googleLlm } from "./provedores/google-llm.ts";
import type { Provedor, ProvedorImagem, ProvedorLlm } from "./tipos.ts";

// Para adicionar um provedor: crie o arquivo em ./provedores e acrescente UMA linha aqui.
export const PROVEDORES: Provedor[] = [
  googleImagem,
  googleLlm,
  anthropicLlm,
];

export const obterProvedor = (id: string, lista: Provedor[] = PROVEDORES) => lista.find((p) => p.id === id);
export const provedoresImagem = (lista: Provedor[] = PROVEDORES) => lista.filter((p): p is ProvedorImagem => p.tipo === "imagem");
export const provedoresLlm = (lista: Provedor[] = PROVEDORES) => lista.filter((p): p is ProvedorLlm => p.tipo === "llm");

/** Descrição serializável (sem funções) para a UI. */
export function descreverProvedor(p: Provedor) {
  return { id: p.id, nome: p.nome, tipo: p.tipo, credencialId: p.credencialId, campos: p.campos, capacidades: p.capacidades };
}
