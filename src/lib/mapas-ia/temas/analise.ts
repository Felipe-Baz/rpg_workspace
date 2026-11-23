// Análise de tema por LLM com visão: monta o pedido e interpreta a resposta. Pura (sem rede).

import type { ImagemBase64, PedidoLlm } from "../tipos.ts";
import { normalizarPerfil, type PerfilEstilo } from "./tipos.ts";

export const MAX_REFERENCIAS_ANALISE = 6;

const SISTEMA =
  "Você é um diretor de arte de mapas e cenários de RPG de mesa. Analise as imagens de referência e o texto do mestre e " +
  "produza um perfil de estilo para guiar a geração de assets visuais consistentes. Responda SOMENTE com JSON válido, sem " +
  'texto extra e sem cercas de código, no formato: {"descricao": string, "paleta": string[] (até 8 cores "#rrggbb"), ' +
  '"regras": string[] (regras curtas de estilo: traço, iluminação, textura, nível de detalhe), "proibidos": string[] (elementos a evitar)}. ' +
  "Escreva em português.";

export function montarPedidoAnalise(texto: string, imagens: ImagemBase64[]): PedidoLlm {
  return {
    sistema: SISTEMA,
    mensagens: [
      {
        papel: "usuario",
        imagens: imagens.slice(0, MAX_REFERENCIAS_ANALISE),
        texto: `Texto do mestre sobre o estilo desejado:\n${texto.trim() || "(sem texto; baseie-se apenas nas imagens)"}`,
      },
    ],
  };
}

/** Extrai o JSON da resposta (tolera cercas ```json e texto ao redor) e normaliza. */
export function interpretarPerfil(resposta: string): PerfilEstilo {
  const m = /\{[\s\S]*\}/.exec(resposta.replace(/```(?:json)?/gi, ""));
  if (!m) throw new Error("A IA não devolveu um perfil válido.");
  let j: unknown;
  try {
    j = JSON.parse(m[0]);
  } catch {
    throw new Error("A IA não devolveu um perfil válido.");
  }
  const p = normalizarPerfil(j);
  if (!p.descricao && p.regras.length === 0) throw new Error("A IA não devolveu um perfil válido.");
  return p;
}
