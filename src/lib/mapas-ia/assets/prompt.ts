// Compositor de prompt: perfil do tema + fragmento da perspectiva + pedido do mestre + regras do tipo.
import type { TipoAsset } from "../../cena/tipos.ts";
import { trechoFundo, type CorChave } from "../corChave.ts";
import type { Perspectiva } from "../perspectivas/tipos.ts";
import type { PerfilEstilo } from "../temas/tipos.ts";

/** Regras fixas por tipo (em inglês: os modelos de imagem respondem melhor). */
export const REGRAS_TIPO: Record<TipoAsset, string> = {
  sprite:
    "A single isolated game object, centered, fully inside the frame with a generous empty margin on every side " +
    "(the object must not touch the edges). No cast shadow, no ground, no text, no watermark.",
  textura:
    "A seamless, tileable texture that fills the entire frame edge to edge, flat and evenly lit. " +
    "No vignette, no border, no focal object, and no detail that is cut at the edges, so that copies tile without a visible seam.",
  pincel:
    "A straight, horizontal strip of a path or road segment that fills the frame edge to edge, " +
    "with the same pattern at the left and right ends so it repeats along its length. No text.",
  decal:
    "A single flat ground marking or stain, centered with a generous margin, drawn flat on the surface. " +
    "Soft irregular edges, no cast shadow, no text, no watermark.",
};

/**
 * Sprites e decals precisam de fundo transparente (validação com Gemini: um decal sem recorte chega como
 * retângulo opaco). Texturas e pincéis preenchem o quadro e seguem sem recorte.
 */
export const precisaAlfa = (tipo: TipoAsset) => tipo === "sprite" || tipo === "decal";

export interface EntradaPrompt {
  tipo: TipoAsset;
  descricao: string;
  tema?: PerfilEstilo;
  perspectiva?: Perspectiva;
  /** Presente quando o fundo será removido localmente (provedor sem alfa nativo). */
  corChave?: CorChave;
  /** Instrução extra do mestre (regeneração/variação). */
  instrucao?: string;
  /** Há imagens de referência anexadas ao pedido. */
  comReferencias?: boolean;
}

export function comporPrompt(e: EntradaPrompt): string {
  const partes: string[] = [];
  partes.push(`Create a tabletop RPG map asset: ${e.descricao.trim()}.`);
  if (e.perspectiva) partes.push(`Perspective: ${e.perspectiva.fragmentoPrompt}.`);
  if (e.tema) {
    const t = e.tema;
    if (t.descricao) partes.push(`Art style: ${t.descricao}`);
    if (t.regras.length) partes.push(`Style rules: ${t.regras.join("; ")}.`);
    if (t.paleta.length) partes.push(`Color palette: ${t.paleta.join(", ")}.`);
    if (t.proibidos.length) partes.push(`Avoid: ${t.proibidos.join("; ")}.`);
  }
  if (e.comReferencias) partes.push("Match the art style, line work, texture and palette of the reference images exactly, but depict only the requested object.");
  partes.push(REGRAS_TIPO[e.tipo]);
  if (e.instrucao?.trim()) partes.push(`Additional instruction: ${e.instrucao.trim()}.`);
  let p = partes.join(" ");
  if (e.corChave && precisaAlfa(e.tipo)) p += trechoFundo(e.corChave);
  return p;
}
