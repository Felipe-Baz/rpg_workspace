// Exportação para mesas virtuais no formato Universal VTT (.dd2vtt / .uvtt), módulo puro.
// Coordenadas em unidades de grid: fração do canvas × tamanho do mapa em células.
import { ASSET_LUZ, type Cena } from "./tipos.ts";
import { medidasGrid } from "./geometria.ts";

/** Células na largura sugeridas para cenários sem grid (~70 px por célula, tamanho comum nos VTTs). */
export const PX_CELULA_SUGERIDO = 70;

export interface PlanoGrade {
  /** Pixels por célula na imagem exportada. */
  ppg: number;
  /** Tamanho da imagem exportada, em px. */
  largura: number;
  altura: number;
  /** Tamanho do mapa em células (pode ser fracionário no cenário livre). */
  celulas: { x: number; y: number };
  /** O VTT só conhece grid quadrado: em hex, a célula vira a largura do hexágono. */
  aproximado: boolean;
}

export const colunasSugeridas = (cena: Pick<Cena, "largura">) => Math.max(1, Math.round(cena.largura / PX_CELULA_SUGERIDO));

/**
 * Grade da exportação: a do mapa (em grid) ou `colunas` células na largura (cenário livre).
 * A imagem sai na resolução do grid: `ppg` inteiro, mesma proporção da cena.
 */
export function planoGrade(cena: Cena, colunas?: number): PlanoGrade {
  const m = medidasGrid(cena);
  let celulaPx: number;
  let aproximado = false;
  if (m?.tipo === "quadrado") celulaPx = m.celula;
  else if (m?.tipo === "hex") {
    celulaPx = m.larg;
    aproximado = true;
  } else celulaPx = cena.largura / Math.max(1, Math.round(colunas ?? colunasSugeridas(cena)));
  const ppg = Math.max(1, Math.round(celulaPx));
  const k = ppg / celulaPx;
  const largura = Math.round(cena.largura * k);
  const altura = Math.round(cena.altura * k);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { ppg, largura, altura, celulas: { x: r(largura / ppg), y: r(altura / ppg) }, aproximado };
}

/** Cor CSS "#rrggbb" -> "ffrrggbb" (ARGB usado pelo Universal VTT). */
export const corUvtt = (cor: string) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(cor.trim())?.[1] ?? "ffffff";
  return `ff${h.toLowerCase()}`;
};

export interface Uvtt {
  format: number;
  resolution: { map_origin: { x: number; y: number }; map_size: { x: number; y: number }; pixels_per_grid: number };
  line_of_sight: { x: number; y: number }[][];
  objects_line_of_sight: { x: number; y: number }[][];
  portals: unknown[];
  environment: { baked_lighting: boolean; ambient_light: string };
  lights: { position: { x: number; y: number }; range: number; intensity: number; color: string; shadows: boolean }[];
  /** PNG em base64 (sem o prefixo data:). */
  image: string;
}

/** Metadados da cena: grid sempre; paredes e luzes quando houver. A imagem deve ter o tamanho de `plano`. */
export function montarUvtt(cena: Cena, plano: PlanoGrade, imagemPngBase64: string): Uvtt {
  const { x: cx, y: cy } = plano.celulas;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const pt = (p: { x: number; y: number }) => ({ x: r(p.x * cx), y: r(p.y * cy) });
  const ocultas = new Set(cena.camadas.filter((c) => !c.visivel).map((c) => c.id));
  return {
    format: 0.3,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: cx, y: cy }, pixels_per_grid: plano.ppg },
    line_of_sight: (cena.paredes ?? []).filter((p) => p.pontos.length >= 2).map((p) => p.pontos.map(pt)),
    objects_line_of_sight: [],
    portals: [],
    environment: { baked_lighting: false, ambient_light: "ffffffff" },
    lights: cena.objetos
      .filter((o) => o.assetId === ASSET_LUZ && !ocultas.has(o.camadaId))
      .map((o) => ({
        position: pt(o),
        range: r((o.escala / 2) * cx),
        intensity: o.luz?.intensidade ?? 0.6,
        color: corUvtt(o.luz?.cor ?? "#ffb347"),
        shadows: true,
      })),
    image: imagemPngBase64,
  };
}

/** Nome de arquivo seguro a partir do nome do mapa. */
export const nomeArquivo = (nome: string, ext: string) =>
  `${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "mapa"}.${ext}`;
