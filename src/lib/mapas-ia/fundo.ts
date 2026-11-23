// Ponto de extensão RemovedorFundo + implementação local por chroma key.
// Trabalha sobre pixels RGBA crus; decodificar/codificar PNG fica a cargo de quem chama (ex.: canvas).

export interface PixelsRgba {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export type Rgb = [number, number, number];

export interface RemovedorFundo {
  id: string;
  /** Devolve novos pixels com canal alfa; não altera a entrada. */
  remover(img: PixelsRgba, opcoes?: { corChave?: Rgb; tolerancia?: number }): PixelsRgba;
}

/** Cores improváveis em arte de RPG, em ordem de preferência. */
export const CORES_CHAVE: Rgb[] = [
  [255, 0, 255], // magenta
  [0, 255, 0], // verde puro
  [0, 255, 255], // ciano
  [255, 255, 0], // amarelo
];

const dist = (r: number, g: number, b: number, k: Rgb) => Math.hypot(r - k[0], g - k[1], b - k[2]);

/** Escolhe a cor-chave mais distante de qualquer pixel opaco do objeto (amostra). */
export function escolherCorChave(amostra: PixelsRgba, candidatas: Rgb[] = CORES_CHAVE): Rgb {
  let melhor = candidatas[0];
  let melhorDist = -1;
  for (const k of candidatas) {
    let min = Infinity;
    const passo = Math.max(1, Math.floor((amostra.width * amostra.height) / 20000));
    for (let p = 0; p < amostra.width * amostra.height; p += passo) {
      const i = p * 4;
      if (amostra.data[i + 3] < 128) continue;
      const d = dist(amostra.data[i], amostra.data[i + 1], amostra.data[i + 2], k);
      if (d < min) min = d;
    }
    if (min > melhorDist) {
      melhorDist = min;
      melhor = k;
    }
  }
  return melhor;
}

/**
 * Cor real do fundo gerado: média dos pixels da borda da imagem. O modelo raramente acerta o
 * magenta exato (#FF00FF), então a remoção deve usar a cor medida, não a pedida.
 */
export function detectarCorFundo(img: PixelsRgba): Rgb {
  let r = 0, g = 0, b = 0, n = 0;
  const add = (x: number, y: number) => {
    const i = (y * img.width + x) * 4;
    r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
  };
  for (let x = 0; x < img.width; x++) { add(x, 0); add(x, img.height - 1); }
  for (let y = 1; y < img.height - 1; y++) { add(0, y); add(img.width - 1, y); }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Quanto a cor pende para a chave (>HUE_MIN: seria tratada como fundo pelo critério de matiz). */
export const pendeParaChave = (cor: Rgb, chave: Rgb) => spillFn(chave)(cor[0], cor[1], cor[2]);
export const LIMIAR_HUE = 40;

/** Faixa de spill em que o pixel passa de objeto (opaco) a fundo (transparente) pelo critério de matiz. */
const HUE_MIN = 40;
const HUE_MAX = 70;
/** Diferença máxima entre os canais altos da chave (R e B, no magenta) para valer como matiz-chave. */
const HUE_EQUILIBRIO = 30;

export const RemovedorFundoChroma: RemovedorFundo = {
  id: "chroma",
  remover(img, opcoes = {}) {
    const k = opcoes.corChave ?? CORES_CHAVE[0];
    const tol = opcoes.tolerancia ?? 90;
    const borda = tol * 0.6; // faixa de transição (anti-halo)
    const out = new Uint8ClampedArray(img.data.length);
    out.set(img.data);
    for (let i = 0; i < out.length; i += 4) {
      const d = dist(out[i], out[i + 1], out[i + 2], k);
      if (d <= tol) {
        out[i + 3] = 0;
      } else if (d < tol + borda) {
        const f = (d - tol) / borda; // 0..1
        out[i + 3] = Math.round(out[i + 3] * f);
        // despill: puxa o canal dominante da chave para a média dos outros, reduzindo o halo
        const [kr, kg, kb] = k;
        const mix = 1 - f;
        const ref = (out[i] + out[i + 1] + out[i + 2]) / 3;
        if (kr > 200) out[i] = out[i] * f + Math.min(out[i], ref) * mix;
        if (kg > 200) out[i + 1] = out[i + 1] * f + Math.min(out[i + 1], ref) * mix;
        if (kb > 200) out[i + 2] = out[i + 2] * f + Math.min(out[i + 2], ref) * mix;
      }
    }
    // Critério por matiz: fundo escurecido/misturado (ex.: bolsões entre folhas) tem a cor da chave
    // mais escura e escapa da distância. Pixel muito "cor-chave" com canais altos equilibrados vira fundo.
    const spillDe = spillFn(k);
    const altos = spillFn.altos(k);
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] === 0) continue;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const sp = spillDe(r, g, b);
      if (sp <= HUE_MIN) continue;
      const v = [r, g, b];
      const vals = altos.map((c) => v[c]);
      if (Math.max(...vals) - Math.min(...vals) > HUE_EQUILIBRIO) continue;
      const f = Math.min(1, (HUE_MAX - sp) / (HUE_MAX - HUE_MIN)); // 0 = fundo; 1 = objeto
      out[i + 3] = Math.round(out[i + 3] * Math.max(0, f));
    }
    despillBorda(out, img.width, img.height, k);
    return { data: out, width: img.width, height: img.height };
  },
};

/** Distância (chebyshev, em pixels) até o pixel transparente mais próximo, limitada a `max`. */
function distanciaAoTransparente(d: Uint8ClampedArray, w: number, h: number, max: number): Uint8Array {
  const INF = 255;
  const dist = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) dist[p] = d[p * 4 + 3] === 0 ? 0 : INF;
  const relax = (p: number, q: number) => { if (dist[q] + 1 < dist[p]) dist[p] = dist[q] + 1; };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x > 0) relax(p, p - 1);
      if (y > 0) { relax(p, p - w); if (x > 0) relax(p, p - w - 1); if (x < w - 1) relax(p, p - w + 1); }
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (x < w - 1) relax(p, p + 1);
      if (y < h - 1) { relax(p, p + w); if (x < w - 1) relax(p, p + w + 1); if (x > 0) relax(p, p + w - 1); }
    }
  for (let p = 0; p < w * h; p++) if (dist[p] > max) dist[p] = max + 1;
  return dist;
}

/**
 * Remove o tom da cor-chave que "vaza" para pixels opacos perto de áreas transparentes (halo e
 * respingos entre folhas/contornos). A contaminação chega a vários pixels da borda, então o raio é
 * maior (RAIO_DESPILL); longe de áreas transparentes nada é alterado, preservando objetos realmente
 * da cor da chave. Para chave magenta: onde R e B excedem G, reduz o excesso.
 */
export const RAIO_DESPILL = 8;

function despillBorda(d: Uint8ClampedArray, w: number, h: number, k: Rgb) {
  const dist = distanciaAoTransparente(d, w, h, RAIO_DESPILL);
  const alvo = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (d[p * 4 + 3] !== 0 && dist[p] <= RAIO_DESPILL) alvo[p] = 1;
  const spillDe = spillFn(k);
  for (let p = 0; p < w * h; p++) {
    if (!alvo[p]) continue;
    const i = p * 4;
    const sp = spillDe(d[i], d[i + 1], d[i + 2]);
    if (sp > 0) for (const c of spillFn.altos(k)) d[i + c] = Math.max(0, d[i + c] - sp);
  }
  removerPontosIsolados(d, w, h, spillDe);
}

/** Quanto o pixel "pende" para a cor-chave: canais altos da chave menos o maior canal baixo. */
function spillFn(k: Rgb) {
  const altos = spillFn.altos(k);
  const baixos = [0, 1, 2].filter((c) => !altos.includes(c));
  return (r: number, g: number, b: number) => {
    const v = [r, g, b];
    const ref = Math.max(0, ...baixos.map((c) => v[c]));
    return Math.min(...altos.map((c) => v[c])) - ref;
  };
}
spillFn.altos = (k: Rgb) => [0, 1, 2].filter((c) => k[c] > 170);

export const LIMIAR_PONTO = 30; // spill mínimo para considerar um pixel "cor da chave"
const JANELA = 3; // raio da vizinhança (7x7)

/**
 * Pontos isolados com a cor da chave dentro do objeto (bolsões minúsculos de fundo entre folhas,
 * misturados com tons escuros, que não foram removidos): se a vizinhança NÃO é majoritariamente
 * cor-chave, troca o pixel pela média dos vizinhos normais. Manchas grandes (objeto realmente roxo)
 * têm vizinhança roxa e são preservadas.
 */
function removerPontosIsolados(d: Uint8ClampedArray, w: number, h: number, spillDe: (r: number, g: number, b: number) => number) {
  const ehChave = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (d[i + 3] > 0 && spillDe(d[i], d[i + 1], d[i + 2]) > LIMIAR_PONTO) ehChave[p] = 1;
  }
  const novos: [number, number, number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!ehChave[p]) continue;
      let chaves = 0, total = 0, r = 0, g = 0, b = 0, n = 0;
      for (let dy = -JANELA; dy <= JANELA; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -JANELA; dx <= JANELA; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (d[q * 4 + 3] === 0) continue;
          total++;
          if (ehChave[q]) { chaves++; continue; }
          r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++;
        }
      }
      if (n > 0 && chaves / total <= 0.2) novos.push([p, Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
    }
  for (const [p, r, g, b] of novos) { d[p * 4] = r; d[p * 4 + 1] = g; d[p * 4 + 2] = b; }
}
