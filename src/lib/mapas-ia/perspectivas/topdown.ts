import type { Perspectiva } from "./tipos.ts";

export const topdown: Perspectiva = {
  id: "topdown",
  nome: "Top-down (de cima)",
  imagemExemplo: "/perspectivas/topdown.svg",
  fragmentoPrompt: "strict top-down orthographic view, camera looking straight down, no perspective distortion",
  ordenacao: "porZ",
  projecaoGrid: "reta",
  permiteGrid: true,
};
