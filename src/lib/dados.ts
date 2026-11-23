// Rolador de dados: expressões como "d20", "2d6+3", "4d6kh3", "d20-1", "2d8+1d4+2".
// Puro e determinístico quando recebe um `rng` — fácil de testar.

export type GrupoDados = { sinal: 1 | -1; qtd: number; faces: number; manter?: { modo: "kh" | "kl"; n: number } };
export type Rolagem = {
  expressao: string;
  grupos: { rotulo: string; dados: number[]; mantidos: number[]; subtotal: number }[];
  bonus: number;
  total: number;
  /** d20 simples: 20 = crítico, 1 = falha crítica. */
  critico?: "acerto" | "falha";
};

export const LIMITE_DADOS = 100;
export const LIMITE_FACES = 1000;

const TOKEN = /([+-]?)\s*(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))/gy;

export function interpretar(expr: string): { grupos: GrupoDados[]; bonus: number } | null {
  const s = expr.toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const grupos: GrupoDados[] = [];
  let bonus = 0;
  TOKEN.lastIndex = 0;
  let consumido = 0;
  for (let m = TOKEN.exec(s); m; m = TOKEN.exec(s)) {
    if (m[0] === "") return null;
    consumido += m[0].length;
    const sinal: 1 | -1 = m[1] === "-" ? -1 : 1;
    if (m[3]) {
      const qtd = m[2] === "" ? 1 : Number(m[2]);
      const faces = Number(m[3]);
      if (qtd < 1 || qtd > LIMITE_DADOS || faces < 2 || faces > LIMITE_FACES) return null;
      const manter = m[4] ? { modo: m[4] as "kh" | "kl", n: Number(m[5]) } : undefined;
      if (manter && (manter.n < 1 || manter.n > qtd)) return null;
      grupos.push({ sinal, qtd, faces, manter });
    } else {
      bonus += sinal * Number(m[6]);
    }
    if (consumido >= s.length) break;
  }
  if (consumido !== s.length || grupos.length === 0) return null;
  return { grupos, bonus };
}

export function rolar(expr: string, rng: () => number = Math.random): Rolagem | null {
  const p = interpretar(expr);
  if (!p) return null;
  const grupos = p.grupos.map((g) => {
    const dados = Array.from({ length: g.qtd }, () => 1 + Math.floor(rng() * g.faces));
    let mantidos = dados;
    if (g.manter) {
      const ord = [...dados].sort((a, b) => (g.manter!.modo === "kh" ? b - a : a - b));
      mantidos = ord.slice(0, g.manter.n);
    }
    const soma = mantidos.reduce((a, b) => a + b, 0);
    return {
      rotulo: `${g.sinal < 0 ? "-" : ""}${g.qtd}d${g.faces}${g.manter ? g.manter.modo + g.manter.n : ""}`,
      dados,
      mantidos,
      subtotal: g.sinal * soma,
    };
  });
  const total = grupos.reduce((a, g) => a + g.subtotal, 0) + p.bonus;
  const r: Rolagem = { expressao: expr.trim(), grupos, bonus: p.bonus, total };
  const g0 = p.grupos[0];
  if (p.grupos.length === 1 && g0.qtd === 1 && g0.faces === 20 && g0.sinal === 1) {
    const v = grupos[0].dados[0];
    if (v === 20) r.critico = "acerto";
    else if (v === 1) r.critico = "falha";
  }
  return r;
}

/** d20 com vantagem ("v") ou desvantagem ("d"), somando um modificador. */
export const expressaoD20 = (vantagem: "v" | "d" | null, mod = 0) =>
  `${vantagem ? "2" : "1"}d20${vantagem === "v" ? "kh1" : vantagem === "d" ? "kl1" : ""}${mod ? (mod > 0 ? `+${mod}` : String(mod)) : ""}`;
