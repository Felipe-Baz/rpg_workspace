import type { Asset, Cena, ObjetoCena } from "./tipos.ts";
import { LADO_MAXIMO_RENDER } from "./tipos.ts";

export type Pt = { x: number; y: number };

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const SQRT3 = Math.sqrt(3);

/** Medidas do grid em px do canvas. Hex com ponta para cima. */
export function medidasGrid(cena: Cena) {
  const g = cena.grid;
  if (!g) return null;
  if (g.tipo === "quadrado") {
    return { tipo: "quadrado" as const, celula: cena.largura / g.colunas, colunas: g.colunas, linhas: g.linhas };
  }
  const s = cena.largura / ((g.colunas + 0.5) * SQRT3); // raio do hexágono
  return { tipo: "hex" as const, raio: s, larg: SQRT3 * s, colunas: g.colunas, linhas: g.linhas };
}

/** Largura de uma célula como fração da largura do canvas (tamanho padrão do carimbo). */
export function larguraCelulaFracao(cena: Cena): number | null {
  const m = medidasGrid(cena);
  if (!m) return null;
  return m.tipo === "quadrado" ? 1 / m.colunas : m.larg / cena.largura;
}

/** Centro (em fração) da célula mais próxima de `p`. Sem grid, devolve `p`. */
export function snapGrid(cena: Cena, p: Pt): Pt {
  const m = medidasGrid(cena);
  if (!m) return p;
  const px = p.x * cena.largura;
  const py = p.y * cena.altura;
  if (m.tipo === "quadrado") {
    const c = Math.min(m.colunas - 1, Math.max(0, Math.floor(px / m.celula)));
    const l = Math.min(m.linhas - 1, Math.max(0, Math.floor(py / m.celula)));
    return { x: ((c + 0.5) * m.celula) / cena.largura, y: ((l + 0.5) * m.celula) / cena.altura };
  }
  const rl = Math.round((py - m.raio) / (1.5 * m.raio));
  let melhor: Pt | null = null;
  let menor = Infinity;
  for (let l = rl - 1; l <= rl + 1; l++) {
    if (l < 0 || l >= m.linhas) continue;
    const desloc = (l % 2) * (m.larg / 2);
    const cc = Math.round((px - m.larg / 2 - desloc) / m.larg);
    for (let c = cc - 1; c <= cc + 1; c++) {
      if (c < 0 || c >= m.colunas) continue;
      const cx = m.larg / 2 + c * m.larg + desloc;
      const cy = m.raio + l * 1.5 * m.raio;
      const d = (cx - px) ** 2 + (cy - py) ** 2;
      if (d < menor) {
        menor = d;
        melhor = { x: cx / cena.largura, y: cy / cena.altura };
      }
    }
  }
  return melhor ?? p;
}

/** Dimensões do objeto em px do canvas. */
export function tamanhoObjeto(cena: Cena, o: ObjetoCena, a: Pick<Asset, "largura" | "altura">) {
  const w = o.escala * cena.largura;
  return { w, h: w * (a.altura / a.largura) };
}

/** O ponto (em fração) está dentro do objeto (levando em conta rotação)? */
export function acertaObjeto(cena: Cena, o: ObjetoCena, a: Pick<Asset, "largura" | "altura">, p: Pt): boolean {
  const { w, h } = tamanhoObjeto(cena, o, a);
  const dx = (p.x - o.x) * cena.largura;
  const dy = (p.y - o.y) * cena.altura;
  const cos = Math.cos(-o.rotacao);
  const sin = Math.sin(-o.rotacao);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
}

/** Objeto mais alto (z/ordem) sob o ponto, ignorando camadas ocultas ou travadas. */
export function objetoEm(cena: Cena, assets: Map<string, Asset>, p: Pt): ObjetoCena | null {
  const ordemCamada = new Map(cena.camadas.map((c, i) => [c.id, i]));
  const candidatos = cena.objetos
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => {
      const c = cena.camadas.find((x) => x.id === o.camadaId);
      return c && c.visivel && !c.travada && assets.has(o.assetId);
    })
    .sort((a, b) => (ordemCamada.get(b.o.camadaId)! - ordemCamada.get(a.o.camadaId)!) || b.o.z - a.o.z || b.i - a.i);
  return candidatos.find(({ o }) => acertaObjeto(cena, o, assets.get(o.assetId)!, p))?.o ?? null;
}

/** Tamanho do render: preserva a proporção e limita o lado maior. */
export function tamanhoExport(cena: Pick<Cena, "largura" | "altura">, limite = LADO_MAXIMO_RENDER) {
  const esc = Math.min(1, limite / Math.max(cena.largura, cena.altura));
  return { largura: Math.round(cena.largura * esc), altura: Math.round(cena.altura * esc) };
}

const gira = (x: number, y: number, ang: number): Pt => ({ x: x * Math.cos(ang) - y * Math.sin(ang), y: x * Math.sin(ang) + y * Math.cos(ang) });

/** Cantos, alça de escala (canto inferior direito) e alça de rotação (acima do topo), em px do canvas. */
export function geometriaSelecao(cena: Cena, o: ObjetoCena, a: Pick<Asset, "largura" | "altura">, pxPorTela = 1) {
  const { w, h } = tamanhoObjeto(cena, o, a);
  const c = { x: o.x * cena.largura, y: o.y * cena.altura };
  const mov = (lx: number, ly: number): Pt => {
    const r = gira(lx, ly, o.rotacao);
    return { x: c.x + r.x, y: c.y + r.y };
  };
  return {
    centro: c,
    cantos: [mov(-w / 2, -h / 2), mov(w / 2, -h / 2), mov(w / 2, h / 2), mov(-w / 2, h / 2)],
    alcaEscala: mov(w / 2, h / 2),
    alcaRotacao: mov(0, -h / 2 - 28 * pxPorTela),
    topo: mov(0, -h / 2),
  };
}

export type Alca = "escala" | "rotacao";

/** A alça sob o ponto (px do canvas), se houver. */
export function alcaEm(cena: Cena, o: ObjetoCena, a: Pick<Asset, "largura" | "altura">, pxPorTela: number, p: Pt): Alca | null {
  const g = geometriaSelecao(cena, o, a, pxPorTela);
  const raio = 12 * pxPorTela;
  if (Math.hypot(p.x - g.alcaRotacao.x, p.y - g.alcaRotacao.y) <= raio) return "rotacao";
  if (Math.hypot(p.x - g.alcaEscala.x, p.y - g.alcaEscala.y) <= raio) return "escala";
  return null;
}
