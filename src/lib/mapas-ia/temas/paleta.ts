// Extração de paleta por quantização de cor (median cut simplificado). Pura: recebe pixels RGBA.

import { MAX_PALETA } from "./tipos.ts";

type Rgb = [number, number, number];

const hex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
const media = (cs: Rgb[]): Rgb => {
  const s = cs.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]] as Rgb, [0, 0, 0] as Rgb);
  return [s[0] / cs.length, s[1] / cs.length, s[2] / cs.length];
};

/** Extrai até `max` cores dominantes de dados RGBA (ignora pixels quase transparentes). */
export function extrairPaleta(rgba: ArrayLike<number>, max = MAX_PALETA): string[] {
  const pixels: Rgb[] = [];
  const passo = Math.max(1, Math.floor(rgba.length / 4 / 20000)); // amostra no máximo ~20 mil pixels
  for (let i = 0; i < rgba.length; i += 4 * passo) if (rgba[i + 3] >= 128) pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  if (pixels.length === 0) return [];

  let caixas: Rgb[][] = [pixels];
  while (caixas.length < max) {
    // divide a caixa com maior amplitude em um canal, na mediana
    let melhor = -1;
    let melhorAmp = 0;
    let canalMelhor = 0;
    caixas.forEach((cx, idx) => {
      if (cx.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let mn = 255;
        let mx = 0;
        for (const p of cx) {
          if (p[c] < mn) mn = p[c];
          if (p[c] > mx) mx = p[c];
        }
        if (mx - mn > melhorAmp) {
          melhorAmp = mx - mn;
          melhor = idx;
          canalMelhor = c;
        }
      }
    });
    if (melhor < 0 || melhorAmp < 8) break;
    const cx = caixas[melhor].slice().sort((a, b) => a[canalMelhor] - b[canalMelhor]);
    const meio = cx.length >> 1;
    caixas = [...caixas.slice(0, melhor), cx.slice(0, meio), cx.slice(meio), ...caixas.slice(melhor + 1)];
  }
  return caixas.sort((a, b) => b.length - a.length).map((cx) => hex(media(cx)));
}

/** Junta paletas de várias imagens, mantendo as mais frequentes e sem cores quase idênticas. */
export function combinarPaletas(paletas: string[][], max = MAX_PALETA): string[] {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a: string, b: string) => {
    const [x, y] = [rgb(a), rgb(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  const out: string[] = [];
  const maxLen = Math.max(0, ...paletas.map((p) => p.length));
  for (let i = 0; i < maxLen && out.length < max; i++)
    for (const p of paletas) {
      const c = p[i];
      if (c && out.length < max && !out.some((o) => dist(o, c) < 24)) out.push(c);
    }
  return out;
}
