// Operações puras sobre pixels RGBA: recorte ao conteúdo, normalização de tamanho e continuidade de texturas.
import type { TipoAsset } from "../../cena/tipos.ts";
import type { PixelsRgba } from "../fundo.ts";

const px = (w: number, h: number): PixelsRgba => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });

/** Recorta ao retângulo que contém pixels visíveis (alfa > limiar), com margem em pixels. Sem conteúdo: devolve null. */
export function recortarAoConteudo(img: PixelsRgba, margem = 2, limiarAlfa = 8): PixelsRgba | null {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > limiarAlfa) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - margem);
  y0 = Math.max(0, y0 - margem);
  x1 = Math.min(w - 1, x1 + margem);
  y1 = Math.min(h - 1, y1 + margem);
  return cortar(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

export function cortar(img: PixelsRgba, x0: number, y0: number, cw: number, ch: number): PixelsRgba {
  const out = px(cw, ch);
  for (let y = 0; y < ch; y++) {
    const ini = ((y0 + y) * img.width + x0) * 4;
    out.data.set(img.data.subarray(ini, ini + cw * 4), y * cw * 4);
  }
  return out;
}

/** Recorte central com a proporção desejada (largura/altura). */
export function recortarProporcao(img: PixelsRgba, proporcao: number): PixelsRgba {
  const atual = img.width / img.height;
  if (Math.abs(atual - proporcao) < 0.01) return img;
  if (atual > proporcao) {
    const cw = Math.max(1, Math.round(img.height * proporcao));
    return cortar(img, Math.floor((img.width - cw) / 2), 0, cw, img.height);
  }
  const ch = Math.max(1, Math.round(img.width / proporcao));
  return cortar(img, 0, Math.floor((img.height - ch) / 2), img.width, ch);
}

/** Redimensiona por média de área (reduz bem) ou bilinear (amplia), com alfa pré-multiplicado para não criar halo. */
export function redimensionar(img: PixelsRgba, nw: number, nh: number): PixelsRgba {
  nw = Math.max(1, Math.round(nw));
  nh = Math.max(1, Math.round(nh));
  if (nw === img.width && nh === img.height) return img;
  const out = px(nw, nh);
  const sx = img.width / nw, sy = img.height / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = y * sy, y1 = (y + 1) * sy;
    for (let x = 0; x < nw; x++) {
      const x0 = x * sx, x1 = (x + 1) * sx;
      let r = 0, g = 0, b = 0, a = 0, peso = 0;
      for (let yy = Math.floor(y0); yy < Math.min(img.height, Math.ceil(y1)); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.min(img.width, Math.ceil(x1)); xx++) {
          const wgt = wy * (Math.min(xx + 1, x1) - Math.max(xx, x0));
          const i = (yy * img.width + xx) * 4;
          const al = img.data[i + 3] / 255;
          r += img.data[i] * al * wgt;
          g += img.data[i + 1] * al * wgt;
          b += img.data[i + 2] * al * wgt;
          a += al * wgt;
          peso += wgt;
        }
      }
      const o = (y * nw + x) * 4;
      if (peso > 0 && a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
        out.data[o + 3] = (a / peso) * 255;
      }
    }
  }
  return out;
}

/** Tamanho padrão por categoria: lado maior (sprite/decal) ou dimensões fixas (textura/pincel). */
export const TAMANHO_PADRAO: Record<TipoAsset, { lado?: number; largura?: number; altura?: number }> = {
  sprite: { lado: 512 },
  decal: { lado: 512 },
  textura: { largura: 512, altura: 512 },
  pincel: { largura: 1024, altura: 256 },
};

/** Leva o asset ao tamanho padrão da categoria (sprites e decals nunca são ampliados). */
export function normalizarTamanho(img: PixelsRgba, tipo: TipoAsset): PixelsRgba {
  const t = TAMANHO_PADRAO[tipo];
  if (t.lado) {
    const k = Math.min(1, t.lado / Math.max(img.width, img.height));
    return redimensionar(img, img.width * k, img.height * k);
  }
  const recortada = recortarProporcao(img, t.largura! / t.altura!);
  return redimensionar(recortada, t.largura!, t.altura!);
}

// ---------- Continuidade de texturas ----------

/** Limite (em níveis 0–255) acima do qual a emenda é visível. */
export const LIMITE_EMENDA = 12;

const difCol = (img: PixelsRgba, xa: number, xb: number) => {
  let s = 0;
  for (let y = 0; y < img.height; y++) {
    const a = (y * img.width + xa) * 4, b = (y * img.width + xb) * 4;
    s += Math.abs(img.data[a] - img.data[b]) + Math.abs(img.data[a + 1] - img.data[b + 1]) + Math.abs(img.data[a + 2] - img.data[b + 2]);
  }
  return s / (img.height * 3);
};
const difLin = (img: PixelsRgba, ya: number, yb: number) => {
  let s = 0;
  for (let x = 0; x < img.width; x++) {
    const a = (ya * img.width + x) * 4, b = (yb * img.width + x) * 4;
    s += Math.abs(img.data[a] - img.data[b]) + Math.abs(img.data[a + 1] - img.data[b + 1]) + Math.abs(img.data[a + 2] - img.data[b + 2]);
  }
  return s / (img.width * 3);
};

/**
 * Descontinuidade das bordas opostas: diferença média entre a última e a primeira coluna/linha (como seriam
 * vizinhas ao repetir) menos a diferença típica entre colunas/linhas vizinhas dentro da imagem.
 * Maior dos dois eixos; ~0 em textura contínua, alto quando há emenda.
 */
export function descontinuidade(img: PixelsRgba): number {
  if (img.width < 4 || img.height < 4) return 0;
  const w = img.width, h = img.height;
  let internaX = 0, internaY = 0;
  const amostrasX = Math.min(16, w - 1), amostrasY = Math.min(16, h - 1);
  for (let k = 0; k < amostrasX; k++) {
    const x = Math.floor(((k + 0.5) * (w - 1)) / amostrasX);
    internaX += difCol(img, x, x + 1);
  }
  for (let k = 0; k < amostrasY; k++) {
    const y = Math.floor(((k + 0.5) * (h - 1)) / amostrasY);
    internaY += difLin(img, y, y + 1);
  }
  internaX /= amostrasX;
  internaY /= amostrasY;
  return Math.max(0, difCol(img, 0, w - 1) - internaX, difLin(img, 0, h - 1) - internaY);
}

const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * Costura simples: mistura a imagem com ela mesma deslocada meia largura/altura (onde a emenda ficaria no
 * centro e as bordas viram vizinhas contínuas). O original domina no centro; o deslocado, perto das bordas,
 * numa faixa de 30% do tamanho. Pode deixar leve "fantasma" na faixa; é uma correção barata, não uma geração nova.
 */
export function corrigirCostura(img: PixelsRgba): PixelsRgba {
  const { width: w, height: h } = img;
  const faixa = 0.3;
  const mistura = (src: PixelsRgba, horizontal: boolean): PixelsRgba => {
    const out = px(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = horizontal ? x / (w - 1) : y / (h - 1);
        const dBorda = Math.min(t, 1 - t); // 0 na borda, 0.5 no centro
        const m = suave(Math.min(1, dBorda / faixa)); // 1 = original
        const sx = horizontal ? (x + (w >> 1)) % w : x;
        const sy = horizontal ? y : (y + (h >> 1)) % h;
        const i = (y * w + x) * 4, j = (sy * w + sx) * 4;
        for (let c = 0; c < 4; c++) out.data[i + c] = src.data[i + c] * m + src.data[j + c] * (1 - m);
      }
    return out;
  };
  return mistura(mistura(img, true), false);
}

export interface ResultadoTextura {
  imagem: PixelsRgba;
  antes: number;
  depois: number;
  corrigida: boolean;
  /** Mesmo após a correção a emenda continua visível. */
  naoRepetivel: boolean;
}

export function verificarTextura(img: PixelsRgba, limite = LIMITE_EMENDA): ResultadoTextura {
  const antes = descontinuidade(img);
  if (antes <= limite) return { imagem: img, antes, depois: antes, corrigida: false, naoRepetivel: false };
  const c = corrigirCostura(img);
  const depois = descontinuidade(c);
  return depois <= limite
    ? { imagem: c, antes, depois, corrigida: true, naoRepetivel: false }
    : { imagem: depois < antes ? c : img, antes, depois, corrigida: depois < antes, naoRepetivel: true };
}
