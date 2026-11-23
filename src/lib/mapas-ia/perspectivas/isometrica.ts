import type { Perspectiva } from "./tipos.ts";

export const isometrica: Perspectiva = {
  id: "isometrica",
  nome: "Isométrica",
  imagemExemplo: "/perspectivas/isometrica.svg",
  fragmentoPrompt: "isometric view, 30 degree angle, orthographic projection, consistent lighting from the top left",
  ordenacao: "porY",
  projecaoGrid: "isometrica",
  permiteGrid: false,
};
