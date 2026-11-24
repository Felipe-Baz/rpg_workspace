// Planejamento das rolagens com dados 3D. Módulo puro (sem three.js): sorteia os números com o CSPRNG e decide
// quais dados físicos aparecem e que face cada um mostra. O resultado é sempre o sorteado: a animação é guiada
// até a face certa, então todo mundo na mesa vê exatamente o mesmo dado cair no mesmo número.
import { inteiroSeguro, sementeSegura } from "./aleatorio.ts";
import { interpretar, montarRolagem, type Rolagem } from "./dados.ts";
import { ladoFisico } from "./geometria-dados.ts";

/** Acima disso a mesa só mostra o total (muitos dados na tela não ajudam ninguém). */
export const MAX_FISICOS = 24;

/**
 * Um dado que aparece na tela: `lados` é o tamanho físico e `valor` a face em que ele para.
 * `lados: 100` é o dado de dezenas do percentil (valor 0, 10, …, 90) e vem sempre junto de um d10 de unidades (1 a 10).
 */
export type DadoFisico = { lados: number; valor: number };
/** Tudo que outro navegador precisa para repetir a mesma animação. */
export type Jogada = { semente: number; dados: DadoFisico[] };

/**
 * Capacidade de cada dado físico necessário para um dado lógico de `faces` faces.
 * Até 100 faces é um dado só (d3 usa um d4; d30 usa o par percentil…). Acima disso soma dados: d120 = d100 + d20.
 */
export function capacidades(faces: number): number[] {
  if (faces <= 100) return [faces];
  const caps = Array.from({ length: Math.floor(faces / 100) }, () => 100);
  if (faces % 100) caps.push(faces % 100);
  return caps;
}

/**
 * Reparte `total` entre dados com capacidades `caps` (cada um mostra de 1 até a sua capacidade), de forma que a soma
 * seja exatamente `total`. Se `total` for menor que o número de dados, usa só os primeiros (todos mostrando 1).
 */
export function dividir(total: number, caps: number[], sorteio: (n: number) => number = inteiroSeguro): number[] {
  const m = Math.min(caps.length, total);
  const valores: number[] = [];
  let resta = total;
  for (let i = 0; i < m; i++) {
    const capResto = caps.slice(i + 1, m).reduce((a, b) => a + b, 0);
    const minResto = m - 1 - i;
    const lo = Math.max(1, resta - capResto);
    const hi = Math.min(caps[i], resta - minResto);
    const v = lo + sorteio(hi - lo + 1) - 1;
    valores.push(v);
    resta -= v;
  }
  return valores;
}

/** Dados físicos que mostram `valor` (1 a `cap`) num dado de `cap` faces. Acima de 20 faces é o par percentil: dezenas + unidades. */
function fisicosDaParte(cap: number, valor: number): DadoFisico[] {
  const lados = ladoFisico(cap);
  if (lados !== 100) return [{ lados, valor }];
  return [
    { lados: 100, valor: Math.floor((valor - 1) / 10) * 10 },
    { lados: 10, valor: ((valor - 1) % 10) + 1 },
  ];
}

/** Dados físicos que mostram o resultado `valor` de um dado lógico de `faces` faces (d120 = dezenas + unidades + d20). */
export function fisicosDe(faces: number, valor: number, sorteio: (n: number) => number = inteiroSeguro): DadoFisico[] {
  const caps = capacidades(faces);
  const partes = dividir(valor, caps, sorteio);
  return partes.flatMap((v, i) => fisicosDaParte(caps[i], v));
}

export type RolagemPlanejada = { rolagem: Rolagem; jogada: Jogada | null };

/**
 * Sorteia a expressão inteira (ex.: "2d6+3", "4d6kh3", "1d120"). Cada dado lógico é sorteado uniformemente em
 * [1, faces] por rejeição sobre `crypto.getRandomValues`, sem viés. `jogada` é nula quando há dados demais para desenhar.
 */
export function sortearRolagem(expr: string, sorteio: (n: number) => number = inteiroSeguro): RolagemPlanejada | null {
  const p = interpretar(expr);
  if (!p) return null;
  const valores = p.grupos.map((g) => Array.from({ length: g.qtd }, () => sorteio(g.faces)));
  const rolagem = montarRolagem(expr, p, valores);
  const fisicos = p.grupos.flatMap((g, i) => valores[i].flatMap((v) => fisicosDe(g.faces, v, sorteio)));
  return { rolagem, jogada: fisicos.length <= MAX_FISICOS ? { semente: sementeSegura(), dados: fisicos } : null };
}
