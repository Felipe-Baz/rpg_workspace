import type { Camada, Cena, Grid } from "./tipos.ts";
import { LADO_MAXIMO_RENDER, TIPOS_CAMADA } from "./tipos.ts";
import { tamanhoExport } from "./geometria.ts";

export const camadasPadrao = (novoId: () => string): Camada[] =>
  TIPOS_CAMADA.map(({ tipo, nome }) => ({ id: novoId(), nome, tipo, visivel: true, travada: false, opacidade: 1 }));

export type OpcoesCena =
  | { nome: string; modo: "grid"; tipoGrid: "quadrado" | "hex"; colunas: number; linhas: number; celulaPx?: number }
  | { nome: string; modo: "cenario"; largura: number; altura: number };

/** Cria uma cena vazia. Em grid, o canvas deriva do número de células (proporção fica travada). */
export function criarCenaVazia(op: OpcoesCena, novoId: () => string, agora = Date.now()): Cena {
  let largura: number;
  let altura: number;
  let grid: Grid | undefined;
  if (op.modo === "grid") {
    const cel = op.celulaPx ?? 64;
    if (op.tipoGrid === "quadrado") {
      largura = op.colunas * cel;
      altura = op.linhas * cel;
    } else {
      const raio = cel / Math.sqrt(3);
      largura = (op.colunas + 0.5) * cel;
      altura = (op.linhas * 1.5 + 0.5) * raio;
    }
    grid = { tipo: op.tipoGrid, colunas: op.colunas, linhas: op.linhas, noRender: true };
  } else {
    largura = op.largura;
    altura = op.altura;
  }
  const t = tamanhoExport({ largura, altura }, LADO_MAXIMO_RENDER);
  return {
    id: novoId(),
    nome: op.nome,
    modo: op.modo,
    perspectiva: "topdown",
    largura: t.largura,
    altura: t.altura,
    grid,
    fundo: "#c9b98a",
    camadas: camadasPadrao(novoId),
    objetos: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}
