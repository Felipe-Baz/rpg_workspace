// Máscaras binárias do tamanho da imagem de trabalho (módulo puro). Viajam entre cliente e servidor em RLE.
import type { PixelsRgba } from "../fundo.ts";
import type { Caixa } from "../tipos.ts";

export interface Mascara {
  largura: number;
  altura: number;
  /** 1 = objeto, 0 = fundo; linha a linha. */
  bits: Uint8Array;
}

export const mascaraVazia = (largura: number, altura: number): Mascara => ({ largura, altura, bits: new Uint8Array(largura * altura) });

/** Corridas alternadas começando por zeros: [zeros, uns, zeros, ...]. */
export function codificarRle(m: Mascara): number[] {
  const out: number[] = [];
  let atual = 0, n = 0;
  for (let i = 0; i < m.bits.length; i++) {
    const b = m.bits[i] ? 1 : 0;
    if (b === atual) n++;
    else {
      out.push(n);
      atual = b;
      n = 1;
    }
  }
  out.push(n);
  return out;
}

export function decodificarRle(rle: number[], largura: number, altura: number): Mascara {
  const m = mascaraVazia(largura, altura);
  let i = 0, b = 0;
  for (const n of rle) {
    if (!Number.isInteger(n) || n < 0 || i + n > m.bits.length) throw new Error("Máscara inválida.");
    if (b) m.bits.fill(1, i, i + n);
    i += n;
    b ^= 1;
  }
  if (i !== m.bits.length) throw new Error("Máscara inválida.");
  return m;
}

export function area(m: Mascara): number {
  let n = 0;
  for (let i = 0; i < m.bits.length; i++) n += m.bits[i];
  return n;
}

/** Retângulo (px, inclusivo) com conteúdo; null se vazia. */
export function caixaPx(m: Mascara): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = m.largura, y0 = m.altura, x1 = -1, y1 = -1;
  for (let y = 0; y < m.altura; y++)
    for (let x = 0; x < m.largura; x++)
      if (m.bits[y * m.largura + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Caixa em fração (0–1) da imagem. */
export function caixaFracao(m: Mascara): Caixa | null {
  const c = caixaPx(m);
  return c && { x0: c.x0 / m.largura, y0: c.y0 / m.altura, x1: (c.x1 + 1) / m.largura, y1: (c.y1 + 1) / m.altura };
}

export function unir(...ms: Mascara[]): Mascara {
  const out = mascaraVazia(ms[0].largura, ms[0].altura);
  for (const m of ms) for (let i = 0; i < m.bits.length; i++) if (m.bits[i]) out.bits[i] = 1;
  return out;
}

export function sobrepoe(a: Mascara, b: Mascara): boolean {
  for (let i = 0; i < a.bits.length; i++) if (a.bits[i] && b.bits[i]) return true;
  return false;
}

export function tocaBorda(m: Mascara): boolean {
  const c = caixaPx(m);
  return !!c && (c.x0 === 0 || c.y0 === 0 || c.x1 === m.largura - 1 || c.y1 === m.altura - 1);
}

/** Dilatação quadrada de raio `r` (separável: linhas, depois colunas). */
export function dilatar(m: Mascara, r: number): Mascara {
  if (r <= 0) return m;
  const { largura: w, altura: h } = m;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let ultimo = -Infinity;
    for (let x = 0; x < w; x++) {
      if (m.bits[y * w + x]) ultimo = x;
      if (x - ultimo <= r) tmp[y * w + x] = 1;
    }
    ultimo = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (m.bits[y * w + x]) ultimo = x;
      if (ultimo - x <= r) tmp[y * w + x] = 1;
    }
  }
  const out = mascaraVazia(w, h);
  for (let x = 0; x < w; x++) {
    let ultimo = -Infinity;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) ultimo = y;
      if (y - ultimo <= r) out.bits[y * w + x] = 1;
    }
    ultimo = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) ultimo = y;
      if (ultimo - y <= r) out.bits[y * w + x] = 1;
    }
  }
  return out;
}

/** Componentes conexos (vizinhança 4), maiores primeiro; ignora os menores que `minArea`. */
export function componentes(m: Mascara, minArea = 1): Mascara[] {
  const { largura: w, altura: h } = m;
  const visto = new Uint8Array(w * h);
  const out: { m: Mascara; n: number }[] = [];
  const pilha: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!m.bits[p] || visto[p]) continue;
    const c = mascaraVazia(w, h);
    let n = 0;
    pilha.push(p);
    visto[p] = 1;
    while (pilha.length) {
      const q = pilha.pop()!;
      c.bits[q] = 1;
      n++;
      const x = q % w;
      for (const v of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) {
        if (v < 0 || v >= w * h || visto[v] || !m.bits[v]) continue;
        visto[v] = 1;
        pilha.push(v);
      }
    }
    if (n >= minArea) out.push({ m: c, n });
  }
  return out.sort((a, b) => b.n - a.n).map((x) => x.m);
}

/** Separa em partes: os componentes conexos ou, se for uma peça só, as metades ao longo do lado maior. */
export function dividir(m: Mascara): Mascara[] {
  const partes = componentes(m, Math.max(4, Math.round(area(m) * 0.01)));
  if (partes.length > 1) return partes;
  const c = caixaPx(m);
  if (!c) return [m];
  const horizontal = c.x1 - c.x0 >= c.y1 - c.y0;
  const corte = horizontal ? (c.x0 + c.x1 + 1) / 2 : (c.y0 + c.y1 + 1) / 2;
  const a = mascaraVazia(m.largura, m.altura), b = mascaraVazia(m.largura, m.altura);
  for (let p = 0; p < m.bits.length; p++) {
    if (!m.bits[p]) continue;
    const v = horizontal ? p % m.largura : Math.floor(p / m.largura);
    (v < corte ? a : b).bits[p] = 1;
  }
  return [a, b].filter((x) => area(x) > 0);
}

/**
 * Máscara de um segmento do provedor: a caixa (fração) e, se houver, a máscara cinza do tamanho da caixa
 * (já decodificada em RGBA; usa o canal vermelho, >= 128 = objeto). Sem máscara, a caixa inteira.
 */
export function mascaraDoSegmento(largura: number, altura: number, caixa: Caixa, cinza?: PixelsRgba): Mascara {
  const m = mascaraVazia(largura, altura);
  const x0 = Math.max(0, Math.floor(caixa.x0 * largura)), x1 = Math.min(largura, Math.ceil(caixa.x1 * largura));
  const y0 = Math.max(0, Math.floor(caixa.y0 * altura)), y1 = Math.min(altura, Math.ceil(caixa.y1 * altura));
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      let dentro = true;
      if (cinza) {
        const sx = Math.min(cinza.width - 1, Math.floor(((x - x0 + 0.5) / (x1 - x0)) * cinza.width));
        const sy = Math.min(cinza.height - 1, Math.floor(((y - y0 + 0.5) / (y1 - y0)) * cinza.height));
        dentro = cinza.data[(sy * cinza.width + sx) * 4] >= 128;
      }
      if (dentro) m.bits[y * largura + x] = 1;
    }
  return m;
}

/** Alfa (0–255) da máscara em outra resolução, por interpolação bilinear: bordas suaves ao ampliar. */
export function alfaEm(m: Mascara, largura: number, altura: number): Uint8Array {
  const out = new Uint8Array(largura * altura);
  const sx = m.largura / largura, sy = m.altura / altura;
  const v = (x: number, y: number) => m.bits[Math.min(m.altura - 1, Math.max(0, y)) * m.largura + Math.min(m.largura - 1, Math.max(0, x))];
  for (let y = 0; y < altura; y++) {
    const fy = (y + 0.5) * sy - 0.5;
    const y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < largura; x++) {
      const fx = (x + 0.5) * sx - 0.5;
      const x0 = Math.floor(fx), tx = fx - x0;
      const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx;
      const b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
      out[y * largura + x] = Math.round((a * (1 - ty) + b * ty) * 255);
    }
  }
  return out;
}
