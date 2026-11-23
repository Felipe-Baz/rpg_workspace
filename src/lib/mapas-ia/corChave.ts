// Escolha inteligente da cor de fundo (cor-chave) por asset: quanto menos o objeto se parece com a
// chave, mais limpo o recorte. Muro de pedra -> magenta; canteiro de flores -> ciano; etc.
import { LIMIAR_HUE, pendeParaChave, type Rgb } from "./fundo.ts";
import type { ContextoProvedor, ProvedorLlm } from "./tipos.ts";

export interface CorChave {
  /** Nome em inglês, usado no prompt de imagem. */
  nome: string;
  hex: string;
  rgb: Rgb;
}

/** Candidatas, em ordem de preferência (desempate). */
export const CANDIDATAS: CorChave[] = [
  { nome: "magenta", hex: "#FF00FF", rgb: [255, 0, 255] },
  { nome: "cyan", hex: "#00FFFF", rgb: [0, 255, 255] },
  { nome: "green", hex: "#00FF00", rgb: [0, 255, 0] },
  { nome: "yellow", hex: "#FFFF00", rgb: [255, 255, 0] },
  { nome: "blue", hex: "#0000FF", rgb: [0, 0, 255] },
  { nome: "red", hex: "#FF0000", rgb: [255, 0, 0] },
];

const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexParaRgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Pontuação de uma chave para uma paleta: maior = mais segura. Chave que o critério de matiz confundiria com o objeto é eliminada. */
function pontuar(chave: CorChave, paleta: Rgb[]): { pontos: number; conflito: boolean } {
  let min = Infinity;
  let conflito = false;
  for (const c of paleta) {
    min = Math.min(min, dist(c, chave.rgb));
    // limiares do recorte: transição por distância (~144) e matiz (spill > LIMIAR_HUE - margem)
    if (dist(c, chave.rgb) < 175 || pendeParaChave(c, chave.rgb) > LIMIAR_HUE - 15) conflito = true;
  }
  return { pontos: min, conflito };
}

/** Escolhe a candidata mais distante de todas as cores da paleta (empate -> ordem de preferência). */
export function escolherChave(paleta: Rgb[], candidatas: CorChave[] = CANDIDATAS): CorChave {
  if (!paleta.length) return candidatas[0];
  const avaliadas = candidatas.map((c, i) => ({ c, i, ...pontuar(c, paleta) }));
  const livres = avaliadas.filter((a) => !a.conflito);
  const base = livres.length ? livres : avaliadas;
  const melhor = Math.max(...base.map((a) => a.pontos));
  // dentro de 25 do melhor, vale a ordem de preferência
  return base.filter((a) => a.pontos >= melhor - 25).sort((a, b) => a.i - b.i)[0].c;
}

// ---------- Paleta por heurística (sem LLM) ----------
const POR_TEMA: [RegExp, string[]][] = [
  [/muro|parede|pedra|rocha|tijolo|castelo|ru[ií]na|wall|stone|brick|rock|castle|ruin/i, ["#808080", "#6b5b4b", "#a09080", "#4a4a4a"]],
  [/flor|canteiro|jardim|flower|garden|bouquet/i, ["#ff69b4", "#ff0000", "#ffff00", "#9b30ff", "#ffffff", "#228b22", "#8b4513"]],
  [/[aá]rvore|arbusto|folha|grama|mato|tree|bush|leaf|leaves|grass|foliage/i, ["#228b22", "#556b2f", "#8b4513", "#6b8e23"]],
  [/fogo|tocha|fogueira|brasa|chama|fire|torch|flame|campfire|brazier/i, ["#ff4500", "#ffa500", "#ffff00", "#8b0000", "#3a3a3a"]],
  [/[aá]gua|lago|rio|po[cç]a|water|lake|river|pond/i, ["#1e90ff", "#4682b4", "#00bfff", "#ffffff"]],
  [/madeira|barril|mesa|ba[uú]|cadeira|wood|barrel|chest|table|chair/i, ["#8b5a2b", "#5c4033", "#a0522d", "#707070"]],
  [/ouro|tesouro|moeda|gold|treasure|coin/i, ["#ffd700", "#b8860b", "#8b5a2b"]],
  [/cristal|gema|ametista|crystal|gem|amethyst/i, ["#9b30ff", "#00bfff", "#ffffff", "#ff69b4"]],
];
const POR_COR: [RegExp, string][] = [
  [/rosa|pink/i, "#ff69b4"], [/vermelh|red\b/i, "#ff0000"], [/azul|blue/i, "#1e5aff"], [/verde|green/i, "#22aa22"],
  [/amarel|yellow/i, "#ffff00"], [/roxo|violeta|purple|violet/i, "#8a2be2"], [/laranja|orange/i, "#ff8c00"],
  [/branc|white/i, "#ffffff"], [/preto|black/i, "#111111"], [/cinza|gr[ae]y/i, "#808080"], [/marrom|brown/i, "#8b5a2b"],
  [/ciano|cyan|turquesa|turquoise/i, "#00ced1"], [/magenta|fucsia|fuchsia/i, "#ff00ff"],
];

export function paletaPorHeuristica(descricao: string): Rgb[] {
  const hex = new Set<string>();
  for (const [re, cores] of POR_TEMA) if (re.test(descricao)) cores.forEach((c) => hex.add(c));
  for (const [re, c] of POR_COR) if (re.test(descricao)) hex.add(c);
  if (!hex.size) ["#8b5a2b", "#707070", "#228b22"].forEach((c) => hex.add(c));
  return [...hex].map(hexParaRgb);
}

// ---------- Paleta via LLM ----------
const SISTEMA_PALETA =
  "You help choose a chroma-key background color for a game sprite. Given the description of an object, " +
  "list ALL colors that will appear in the finished image, including small accents and highlights " +
  "(for example petals, gems, flames, glints). Reply with ONLY a JSON object like " +
  '{"cores":["#rrggbb","#rrggbb"]} with 3 to 10 hex colors. No other text.';

/** Extrai cores hex de uma resposta de LLM (tolerante a texto extra). */
export function extrairPaleta(texto: string): Rgb[] {
  const achados = texto.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  return [...new Set(achados.map((h) => h.toLowerCase()))].slice(0, 12).map(hexParaRgb);
}

export interface EscolhaChave {
  chave: CorChave;
  paleta: Rgb[];
  origem: "llm" | "heuristica";
  /** Motivo do fallback, quando o LLM não foi usado ou falhou. */
  aviso?: string;
}

/**
 * Escolhe a cor-chave de um asset. Com LLM: pede a paleta do objeto e escolhe a candidata mais distante.
 * Sem LLM ou se ele falhar: usa a heurística por palavras-chave (nunca bloqueia a geração).
 */
export async function escolherCorChaveParaAsset(
  descricao: string,
  llm?: { provedor: ProvedorLlm; ctx: ContextoProvedor },
): Promise<EscolhaChave> {
  let aviso: string | undefined;
  if (llm) {
    try {
      const r = await llm.provedor.conversar(llm.ctx, {
        sistema: SISTEMA_PALETA,
        mensagens: [{ papel: "usuario", texto: `Object: ${descricao}` }],
      });
      const paleta = extrairPaleta(r.texto);
      if (paleta.length >= 2) return { chave: escolherChave(paleta), paleta, origem: "llm" };
      aviso = "O LLM não devolveu uma paleta válida; usada a heurística.";
    } catch (e) {
      aviso = `Falha ao consultar o LLM (${(e as Error).message}); usada a heurística.`;
    }
  }
  const paleta = paletaPorHeuristica(descricao);
  return { chave: escolherChave(paleta), paleta, origem: "heuristica", aviso };
}

/** Trecho de prompt que pede o fundo na cor escolhida. */
export const trechoFundo = (c: CorChave) =>
  ` Isolated on a flat, solid, pure ${c.nome} (${c.hex}) background. No shadow, no gradient, no floor, no text, ` +
  `and no ${c.nome} anywhere on the object itself.`;
