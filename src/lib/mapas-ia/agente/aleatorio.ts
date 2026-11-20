// Aleatoriedade determinística (mesma semente = mesmo resultado) e amostragem de Poisson em disco.
import type { Pt } from "../../cena/geometria.ts";

/** Gerador mulberry32: números em [0, 1). */
export function rng(semente: number): () => number {
  let a = semente >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bridson: pontos numa área `largura` x `altura` (mesma unidade de `distMin`), nenhum par a menos
 * de `distMin`. `aceita` restringe a forma (ex.: elipse). Para em `max` pontos.
 */
export function poissonDisco(
  largura: number,
  altura: number,
  distMin: number,
  aleatorio: () => number,
  aceita: (p: Pt) => boolean = () => true,
  max = 500,
  tentativas = 30,
): Pt[] {
  if (!(distMin > 0) || !(largura > 0) || !(altura > 0)) return [];
  const cel = distMin / Math.SQRT2;
  const cols = Math.ceil(largura / cel);
  const lins = Math.ceil(altura / cel);
  const grade: number[] = new Array(cols * lins).fill(-1);
  const pts: Pt[] = [];
  const ativos: number[] = [];
  const indice = (p: Pt) => Math.min(lins - 1, Math.floor(p.y / cel)) * cols + Math.min(cols - 1, Math.floor(p.x / cel));
  const livre = (p: Pt) => {
    const cx = Math.floor(p.x / cel);
    const cy = Math.floor(p.y / cel);
    for (let y = Math.max(0, cy - 2); y <= Math.min(lins - 1, cy + 2); y++)
      for (let x = Math.max(0, cx - 2); x <= Math.min(cols - 1, cx + 2); x++) {
        const i = grade[y * cols + x];
        if (i >= 0 && (pts[i].x - p.x) ** 2 + (pts[i].y - p.y) ** 2 < distMin * distMin) return false;
      }
    return true;
  };
  const adicionar = (p: Pt) => {
    grade[indice(p)] = pts.length;
    ativos.push(pts.length);
    pts.push(p);
  };

  // Primeiro ponto: algumas tentativas dentro da forma.
  for (let k = 0; k < 50 && !pts.length; k++) {
    const p = { x: aleatorio() * largura, y: aleatorio() * altura };
    if (aceita(p)) adicionar(p);
  }
  while (ativos.length && pts.length < max) {
    const a = Math.floor(aleatorio() * ativos.length);
    const base = pts[ativos[a]];
    let achou = false;
    for (let k = 0; k < tentativas; k++) {
      const ang = aleatorio() * Math.PI * 2;
      const r = distMin * (1 + aleatorio());
      const p = { x: base.x + Math.cos(ang) * r, y: base.y + Math.sin(ang) * r };
      if (p.x < 0 || p.y < 0 || p.x >= largura || p.y >= altura || !aceita(p) || !livre(p)) continue;
      adicionar(p);
      achou = true;
      break;
    }
    if (!achou) ativos.splice(a, 1);
  }
  return pts;
}

/** Semente estável a partir de um texto (quando o agente não informa uma). */
export function sementeDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}
