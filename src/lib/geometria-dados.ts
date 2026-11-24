// Geometria dos dados poliédricos (d4, d6, d8, d10, d12, d20 e d100). Módulo puro: só números, sem three.js,
// para poder ser testado e reutilizado pelo desenho 3D (`cena-dados.ts`).

export type V3 = [number, number, number];
export type FaceDado = {
  /** Índices dos vértices, em sentido anti-horário visto de fora. */
  idx: number[];
  normal: V3;
  centro: V3;
  /** Valor que a face mostra. No d4 é 0: o valor está nos vértices (ver `valoresVertice`). */
  valor: number;
};
export type Poliedro = {
  lados: number;
  vertices: V3[];
  faces: FaceDado[];
  /** Só o d4: número impresso em cada vértice; vale o do vértice que aponta para cima. */
  valoresVertice?: number[];
};

/** Tamanhos de dado físico que existem. `100` é o dado de DEZENAS do percentil (00 a 90): sempre vem acompanhado de um d10 de unidades. */
export const LADOS_PADRAO = [4, 6, 8, 10, 12, 20, 100] as const;
/** Menor dado físico que comporta `n` faces (d3 → d4, d14 → d20; de 21 a 100 faces, 100 = par percentil). */
export const ladoFisico = (n: number): number => LADOS_PADRAO.find((l) => l >= n) ?? 100;

const PHI = (1 + Math.sqrt(5)) / 2;

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const media = (ps: V3[]): V3 => {
  const s: V3 = [0, 0, 0];
  for (const p of ps) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
  return [s[0] / ps.length, s[1] / ps.length, s[2] / ps.length];
};

/** Normal de um polígono plano (método de Newell), apontando conforme a ordem dos pontos. */
function normalDe(ps: V3[]): V3 {
  const n: V3 = [0, 0, 0];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit(n);
}

/** Ordena os índices em sentido anti-horário em torno da normal (vista de fora). */
function ordenar(vs: V3[], idx: number[], normal: V3): number[] {
  const c = media(idx.map((i) => vs[i]));
  const ref = unit(sub(vs[idx[0]], c));
  const bi = cross(normal, ref);
  const ang = (i: number) => { const d = sub(vs[i], c); return Math.atan2(dot(d, bi), dot(d, ref)); };
  return [...idx].sort((a, b) => ang(a) - ang(b));
}

function normalizar(vs: V3[]): V3[] {
  const r = Math.max(...vs.map(norm));
  return vs.map((v) => [v[0] / r, v[1] / r, v[2] / r] as V3);
}

/** Faces de um poliedro convexo a partir das direções das normais: pega os vértices mais "à frente" de cada uma. */
function facesPorNormais(vs: V3[], normais: V3[]): { idx: number[]; normal: V3 }[] {
  return normais.map((n0) => {
    const n = unit(n0);
    const max = Math.max(...vs.map((v) => dot(v, n)));
    const idx = vs.map((_, i) => i).filter((i) => dot(vs[i], n) > max - 1e-6);
    return { idx: ordenar(vs, idx, n), normal: n };
  });
}

/** Numera as faces de modo que as opostas somem `soma` (como nos dados de verdade). `passo` ajusta a escala (d100: 10, 20, ...). */
function numerar(faces: { normal: V3 }[], soma: number, inicio = 1, passo = 1): number[] {
  const valores: number[] = new Array(faces.length).fill(NaN);
  let k = 0;
  for (let i = 0; i < faces.length; i++) {
    if (!Number.isNaN(valores[i])) continue;
    const j = faces.findIndex((f, jj) => jj !== i && Number.isNaN(valores[jj]) && dot(f.normal, faces[i].normal) < -0.999);
    const v = inicio + k * passo;
    valores[i] = v;
    if (j >= 0) valores[j] = soma - v;
    k++;
  }
  return valores;
}

function montar(lados: number, vs: V3[], faces: { idx: number[]; normal: V3 }[], valores: number[]): Poliedro {
  return {
    lados,
    vertices: vs,
    faces: faces.map((f, i) => ({ idx: f.idx, normal: f.normal, centro: media(f.idx.map((k) => vs[k])), valor: valores[i] })),
  };
}

const sinais = [-1, 1];
function cubo(): V3[] {
  const vs: V3[] = [];
  for (const x of sinais) for (const y of sinais) for (const z of sinais) vs.push([x, y, z]);
  return vs;
}

function d4(): Poliedro {
  const vs = normalizar([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
  // face i = a oposta ao vértice i
  const faces = vs.map((v, i) => {
    const idx = vs.map((_, k) => k).filter((k) => k !== i);
    const normal = unit([-v[0], -v[1], -v[2]]);
    return { idx: ordenar(vs, idx, normal), normal };
  });
  const p = montar(4, vs, faces, [0, 0, 0, 0]);
  p.valoresVertice = [1, 2, 3, 4];
  return p;
}

function d6(): Poliedro {
  const vs = normalizar(cubo());
  const normais: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces = facesPorNormais(vs, normais);
  return montar(6, vs, faces, numerar(faces, 7));
}

function d8(): Poliedro {
  const vs: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const normais: V3[] = [];
  for (const x of sinais) for (const y of sinais) for (const z of sinais) normais.push([x, y, z]);
  const faces = facesPorNormais(vs, normais);
  return montar(8, vs, faces, numerar(faces, 9));
}

function d12(): Poliedro {
  const a = 1 / PHI;
  const vs = normalizar([
    ...cubo(),
    ...sinais.flatMap((y) => sinais.map((z) => [0, y * a, z * PHI] as V3)),
    ...sinais.flatMap((x) => sinais.map((y) => [x * a, y * PHI, 0] as V3)),
    ...sinais.flatMap((x) => sinais.map((z) => [x * PHI, 0, z * a] as V3)),
  ]);
  const normais: V3[] = [];
  for (const s1 of sinais) for (const s2 of sinais) normais.push([s1, 0, s2 * PHI], [s1 * PHI, s2, 0], [0, s1 * PHI, s2]);
  const faces = facesPorNormais(vs, normais);
  return montar(12, vs, faces, numerar(faces, 13));
}

function d20(): Poliedro {
  const vs = normalizar([
    ...sinais.flatMap((y) => sinais.map((z) => [0, y, z * PHI] as V3)),
    ...sinais.flatMap((x) => sinais.map((y) => [x, y * PHI, 0] as V3)),
    ...sinais.flatMap((x) => sinais.map((z) => [x * PHI, 0, z] as V3)),
  ]);
  const a = 1 / PHI;
  const normais: V3[] = [...cubo()];
  for (const s1 of sinais) for (const s2 of sinais) normais.push([s1 * a, 0, s2 * PHI], [s1 * PHI, s2 * a, 0], [0, s1 * PHI, s2 * a]);
  const faces = facesPorNormais(vs, normais);
  return montar(20, vs, faces, numerar(faces, 21));
}

/** Trapezoedro pentagonal: as 10 faces são "pipas". O d10 mostra 1 a 10; o dado de dezenas do percentil (`lados` 100) mostra 00, 10, ..., 90. */
function trapezoedro(lados: 10 | 100): Poliedro {
  const s = 0.105;
  const c36 = Math.cos(Math.PI / 5);
  const t = (s * (1 + c36)) / (1 - c36); // faz as pipas serem planas
  const alto = (j: number): V3 => [Math.cos((2 * Math.PI * j) / 5), Math.sin((2 * Math.PI * j) / 5), s];
  const baixo = (j: number): V3 => [Math.cos((2 * Math.PI * j) / 5 + Math.PI / 5), Math.sin((2 * Math.PI * j) / 5 + Math.PI / 5), -s];
  // vértices: 0 topo, 1 fundo, 2..6 anel alto, 7..11 anel baixo
  const vs = normalizar([[0, 0, t], [0, 0, -t], ...Array.from({ length: 5 }, (_, j) => alto(j)), ...Array.from({ length: 5 }, (_, j) => baixo(j))]);
  const A = (j: number) => 2 + (((j % 5) + 5) % 5);
  const B = (j: number) => 7 + (((j % 5) + 5) % 5);
  const poligonos: number[][] = [];
  for (let j = 0; j < 5; j++) {
    poligonos.push([0, A(j), B(j), A(j + 1)]); // pipa de cima
    poligonos.push([1, B(j), A(j + 1), B(j + 1)]); // pipa de baixo
  }
  const faces = poligonos.map((idx) => {
    const ps = idx.map((i) => vs[i]);
    let n = normalDe(ps);
    if (dot(n, media(ps)) < 0) n = [-n[0], -n[1], -n[2]];
    return { idx: ordenar(vs, idx, n), normal: n };
  });
  return montar(lados, vs, faces, lados === 10 ? numerar(faces, 11) : numerar(faces, 90, 0, 10));
}

const cache = new Map<number, Poliedro>();
export function poliedro(lados: number): Poliedro {
  let p = cache.get(lados);
  if (!p) {
    switch (lados) {
      case 4: p = d4(); break;
      case 6: p = d6(); break;
      case 8: p = d8(); break;
      case 10: p = trapezoedro(10); break;
      case 12: p = d12(); break;
      case 20: p = d20(); break;
      case 100: p = trapezoedro(100); break;
      default: throw new RangeError(`Não há dado físico de ${lados} lados`);
    }
    cache.set(lados, p);
  }
  return p;
}

/** Direção (no espaço do dado) que deve apontar para cima quando o resultado é `valor`. */
export function direcaoCima(lados: number, valor: number): V3 {
  const p = poliedro(lados);
  if (p.valoresVertice) {
    const i = p.valoresVertice.indexOf(valor);
    if (i < 0) throw new RangeError(`d4 não tem o valor ${valor}`);
    return unit(p.vertices[i]);
  }
  const f = p.faces.find((x) => x.valor === valor);
  if (!f) throw new RangeError(`d${lados} não tem o valor ${valor}`);
  return f.normal;
}
