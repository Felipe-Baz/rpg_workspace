// Unidades que o agente usa: em grid, células (coluna/linha, a partir de 0; inteiros = centro da
// célula); em cenário, porcentagem do canvas (0–100). A cena guarda frações (0–1).
import type { Cena } from "../../cena/tipos.ts";
import { centroCelula, larguraCelulaFracao, medidasGrid, type Pt } from "../../cena/geometria.ts";
import { ErroFerramenta } from "./tipos.ts";

export interface Regiao {
  x: number;
  y: number;
  largura: number;
  altura: number;
  forma?: "retangulo" | "elipse";
}

/** Retângulo em fração do canvas. */
export interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  elipse: boolean;
}

const EPS = 1e-6;
const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

export const descreverUnidades = (cena: Cena) =>
  cena.grid
    ? `células (coluna 0–${cena.grid.colunas - 1}, linha 0–${cena.grid.linhas - 1}; inteiros = centro da célula)`
    : "porcentagem do mapa (x e y de 0 a 100)";

/** Posição nas unidades do agente -> fração. Lança erro descritivo se cair fora do canvas. */
export function paraFracao(cena: Cena, x: number, y: number): Pt {
  const p = cena.grid ? centroCelula(cena, x, y)! : { x: x / 100, y: y / 100 };
  if (p.x < -EPS || p.x > 1 + EPS || p.y < -EPS || p.y > 1 + EPS) {
    throw new ErroFerramenta(`Posição (${x}, ${y}) fica fora do mapa. Use ${descreverUnidades(cena)}.`);
  }
  return { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
}

/** Fração -> unidades do agente (para descrever a cena ao LLM). */
export function deFracao(cena: Cena, p: Pt): { x: number; y: number } {
  const m = medidasGrid(cena);
  if (!m) return { x: arred(p.x * 100, 1), y: arred(p.y * 100, 1) };
  const px = p.x * cena.largura;
  const py = p.y * cena.altura;
  if (m.tipo === "quadrado") return { x: arred(px / m.celula - 0.5), y: arred(py / m.celula - 0.5) };
  const linha = (py - m.raio) / (1.5 * m.raio);
  const desloc = ((((Math.round(linha) % 2) + 2) % 2) * m.larg) / 2;
  return { x: arred((px - m.larg / 2 - desloc) / m.larg), y: arred(linha) };
}

/** Tamanho (largura) nas unidades do agente -> `escala` (fração da largura do canvas). */
export const paraEscala = (cena: Cena, tamanho: number) => (cena.grid ? tamanho * larguraCelulaFracao(cena)! : tamanho / 100);
export const deEscala = (cena: Cena, escala: number) => arred(cena.grid ? escala / larguraCelulaFracao(cena)! : escala * 100);

/** Região nas unidades do agente -> caixa em fração. Em grid, a região cobre as células inteiras. Sem região = mapa todo. */
export function paraCaixa(cena: Cena, r?: Regiao): Caixa {
  if (!r) return { x0: 0, y0: 0, x1: 1, y1: 1, elipse: false };
  if (!(r.largura > 0 && r.altura > 0)) throw new ErroFerramenta("A região precisa de largura e altura positivas.");
  const m = medidasGrid(cena);
  let c: Omit<Caixa, "elipse">;
  if (!m) c = { x0: r.x / 100, y0: r.y / 100, x1: (r.x + r.largura) / 100, y1: (r.y + r.altura) / 100 };
  else if (m.tipo === "quadrado")
    c = { x0: (r.x * m.celula) / cena.largura, y0: (r.y * m.celula) / cena.altura, x1: ((r.x + r.largura) * m.celula) / cena.largura, y1: ((r.y + r.altura) * m.celula) / cena.altura };
  else
    c = {
      x0: (r.x * m.larg) / cena.largura,
      y0: (r.y * 1.5 * m.raio) / cena.altura,
      x1: ((r.x + r.largura) * m.larg + m.larg / 2) / cena.largura,
      y1: ((r.y + r.altura) * 1.5 * m.raio + m.raio / 2) / cena.altura,
    };
  if (c.x0 < -EPS || c.y0 < -EPS || c.x1 > 1 + EPS || c.y1 > 1 + EPS) {
    throw new ErroFerramenta(`A região (${r.x}, ${r.y}, ${r.largura}x${r.altura}) sai do mapa. Use ${descreverUnidades(cena)}.`);
  }
  const lim = (n: number) => Math.min(1, Math.max(0, n));
  return { x0: lim(c.x0), y0: lim(c.y0), x1: lim(c.x1), y1: lim(c.y1), elipse: r.forma === "elipse" };
}

export function dentroDaCaixa(c: Caixa, p: Pt): boolean {
  if (p.x < c.x0 - EPS || p.x > c.x1 + EPS || p.y < c.y0 - EPS || p.y > c.y1 + EPS) return false;
  if (!c.elipse) return true;
  const rx = (c.x1 - c.x0) / 2 || EPS;
  const ry = (c.y1 - c.y0) / 2 || EPS;
  return ((p.x - (c.x0 + rx)) / rx) ** 2 + ((p.y - (c.y0 + ry)) / ry) ** 2 <= 1 + EPS;
}
