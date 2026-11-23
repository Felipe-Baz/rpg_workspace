// Pipeline de asset: gerar -> (removerFundo) -> recortar -> normalizar -> verificar -> (salvar, a cargo de quem chama).
// Independente do provedor: usa só as capacidades declaradas e dependências injetadas (decodificação, geração).
import type { TipoAsset } from "../../cena/tipos.ts";
import { RemovedorFundoChroma, detectarCorFundo, type PixelsRgba, type RemovedorFundo } from "../fundo.ts";
import type { CapacidadesImagem, ImagemBase64 } from "../tipos.ts";
import { planejarGeracao } from "../orquestrador.ts";
import { precisaAlfa } from "./prompt.ts";
import { normalizarTamanho, recortarAoConteudo, verificarTextura } from "./pixels.ts";

export type Etapa = "gerar" | "removerFundo" | "recortar" | "normalizar" | "verificar" | "salvar";

/** Progresso aproximado (%) ao concluir cada etapa. */
export const PROGRESSO_ETAPA: Record<Etapa, number> = { gerar: 60, removerFundo: 70, recortar: 78, normalizar: 86, verificar: 92, salvar: 100 };

export interface DepsPipeline {
  gerar(): Promise<ImagemBase64>;
  decodificar(img: ImagemBase64): Promise<PixelsRgba>;
  /** Codifica em PNG. */
  codificar(px: PixelsRgba): Promise<ImagemBase64>;
  removedor?: RemovedorFundo;
  aoProgredir?(etapa: Etapa, pct: number): void;
}

export interface EntradaPipeline {
  tipo: TipoAsset;
  capacidades: CapacidadesImagem;
}

export interface ResultadoPipeline {
  png: ImagemBase64;
  largura: number;
  altura: number;
  /** Etapas efetivamente executadas, em ordem. */
  etapas: Etapa[];
  naoRepetivel: boolean;
  avisos: string[];
}

/** Há remoção de fundo local neste pedido? (provedor sem alfa nativo e tipo que exige transparência) */
export const removerFundoNecessario = (cap: CapacidadesImagem, tipo: TipoAsset) =>
  planejarGeracao(cap, { precisaAlfa: precisaAlfa(tipo) }).removerFundoLocal;

export async function executarPipeline(entrada: EntradaPipeline, deps: DepsPipeline): Promise<ResultadoPipeline> {
  const etapas: Etapa[] = [];
  const avisos: string[] = [];
  const marca = (e: Etapa) => {
    etapas.push(e);
    deps.aoProgredir?.(e, PROGRESSO_ETAPA[e]);
  };
  const { tipo, capacidades } = entrada;

  const bruta = await deps.gerar();
  marca("gerar");
  let px = await deps.decodificar(bruta);

  if (removerFundoNecessario(capacidades, tipo)) {
    // O modelo raramente acerta a cor pedida: remove pela cor medida nas bordas.
    px = (deps.removedor ?? RemovedorFundoChroma).remover(px, { corChave: detectarCorFundo(px) });
    marca("removerFundo");
  }

  if (precisaAlfa(tipo)) {
    const r = recortarAoConteudo(px);
    if (!r) throw new Error("A imagem gerada não tem conteúdo visível após o recorte. Tente gerar de novo.");
    px = r;
    marca("recortar");
  }

  px = normalizarTamanho(px, tipo);
  marca("normalizar");

  let naoRepetivel = false;
  if (tipo === "textura" || tipo === "pincel") {
    const v = verificarTextura(px);
    px = v.imagem;
    naoRepetivel = v.naoRepetivel;
    if (v.corrigida) avisos.push("Aplicada correção de costura nas bordas.");
    if (naoRepetivel) avisos.push("A textura não repete sem emenda visível; considere gerar de novo.");
    marca("verificar");
  }

  const png = await deps.codificar(px);
  marca("salvar");
  return { png, largura: px.width, altura: px.height, etapas, naoRepetivel, avisos };
}

// ---------- Variações ----------

export interface Variacao {
  seed?: number;
  /** Trecho acrescentado à instrução quando o provedor não tem seed. */
  instrucao?: string;
}

const VARIACOES_TEXTO = [
  "a clearly different shape and silhouette from the usual version",
  "a different color accent while keeping the same style",
  "more weathered, worn and aged",
  "newer, cleaner and well kept",
  "a slightly different proportion and a different small detail",
  "a different arrangement of the same elements",
  "viewed with a different pose or orientation of the same object",
  "with extra small decorative details",
];

/** Seeds diferentes quando o provedor suporta; senão, o mesmo pedido com variações de prompt. */
export function planejarVariacoes(cap: CapacidadesImagem, quantidade: number, sorteio: () => number = Math.random): Variacao[] {
  const n = Math.max(1, Math.min(8, Math.round(quantidade)));
  if (cap.seed) {
    const usados = new Set<number>();
    while (usados.size < n) usados.add(Math.floor(sorteio() * 2_147_483_647));
    return [...usados].map((seed) => ({ seed }));
  }
  const inicio = Math.floor(sorteio() * VARIACOES_TEXTO.length);
  return Array.from({ length: n }, (_, i) => ({ instrucao: VARIACOES_TEXTO[(inicio + i) % VARIACOES_TEXTO.length] }));
}
