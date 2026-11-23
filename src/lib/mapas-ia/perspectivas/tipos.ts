// Contrato de uma perspectiva de mapa. Módulo puro (sem React/Firebase) para ser testável em Node.

export type Ordenacao = "nenhuma" | "porY" | "porZ";

export interface Perspectiva {
  id: string;
  nome: string;
  /** Caminho em public/ (ex.: "/perspectivas/topdown.svg"). */
  imagemExemplo: string;
  /** Texto acrescentado aos prompts de geração (changes seguintes). */
  fragmentoPrompt: string;
  /** Como o render decide quem fica na frente. */
  ordenacao: Ordenacao;
  /** Projeção do grid (informativa para a geração; top-down usa grade reta). */
  projecaoGrid: "reta" | "isometrica" | "nenhuma";
  /** Se mapas em grid podem usá-la. */
  permiteGrid: boolean;
}
