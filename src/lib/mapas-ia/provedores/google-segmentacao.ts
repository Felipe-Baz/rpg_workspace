/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de APIs externas */
import { exigirCampo, postarJson } from "../http.ts";
import { ErroProvedor, type ImagemBase64, type SegmentoBruto, type Segmentador } from "../tipos.ts";
import { GOOGLE_BASE, campoGoogleKey, campoModelo } from "./google-comum.ts";
import { MODELO_LLM_GOOGLE_PADRAO } from "./google-llm.ts";

// Detecção por visão do Gemini (mesma chave do Google): o modelo devolve JSON com caixa (0–1000, [y0, x0, y1, x1]).
// Pede SÓ caixas: com máscaras (formato da doc de "image understanding"), o gemini-3.6-flash gastou ~10 mil tokens
// e 79 s para devolver UM objeto; só com caixas, 20 objetos em 9 s (docs/planejamento/validacao-gemini.md, change 08).
// Se o modelo mandar `mask` mesmo assim, ela é usada.

const MAX_OBJETOS = 30;

const prompt = (max: number, dica?: string) =>
  [
    "This is a tabletop RPG map seen from above.",
    dica ? `Context: ${dica}.` : "",
    `Detect the distinct movable or standalone objects (furniture, trees, rocks, crates, barrels, statues, carts, etc.), at most ${max}.`,
    "Do NOT include the floor, ground, walls, roads, water or any large background region.",
    'Output a JSON list where each entry has the 2D bounding box in "box_2d" ([ymin, xmin, ymax, xmax], normalized to 0-1000)',
    'tightly around the object, and a short text label in "label".',
  ]
    .filter(Boolean)
    .join(" ");

/** Extrai os segmentos do texto do modelo (tolerante a cercas ```json e entradas inválidas). */
export function interpretarSegmentos(texto: string): SegmentoBruto[] {
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
  const limpo = (cerca ? cerca[1] : texto).trim();
  let lista: any;
  try {
    lista = JSON.parse(limpo);
  } catch {
    const ini = limpo.indexOf("["), fim = limpo.lastIndexOf("]");
    if (ini < 0 || fim <= ini) throw new ErroProvedor("O segmentador não devolveu uma lista de objetos.");
    try {
      lista = JSON.parse(limpo.slice(ini, fim + 1));
    } catch {
      throw new ErroProvedor("O segmentador devolveu JSON inválido.");
    }
  }
  if (!Array.isArray(lista)) throw new ErroProvedor("O segmentador não devolveu uma lista de objetos.");
  const f = (v: unknown) => Math.min(1, Math.max(0, Number(v) / 1000));
  const out: SegmentoBruto[] = [];
  for (const e of lista) {
    const b = e?.box_2d;
    if (!Array.isArray(b) || b.length !== 4 || b.some((v: unknown) => !Number.isFinite(Number(v)))) continue;
    const caixa = { y0: f(b[0]), x0: f(b[1]), y1: f(b[2]), x1: f(b[3]) };
    if (caixa.x1 <= caixa.x0 || caixa.y1 <= caixa.y0) continue;
    let mascara: ImagemBase64 | undefined;
    const m = typeof e.mask === "string" ? /^(?:data:(image\/[a-z]+);base64,)?([A-Za-z0-9+/=\s]{4,})$/.exec(e.mask.trim()) : null;
    if (m) mascara = { mime: m[1] ?? "image/png", base64: m[2].replace(/\s/g, "") }; // às vezes vem sem o prefixo data:
    const rotulo = typeof e.label === "string" && e.label.trim() ? e.label.trim().slice(0, 80) : "objeto";
    out.push({ rotulo, caixa: { x0: caixa.x0, y0: caixa.y0, x1: caixa.x1, y1: caixa.y1 }, mascara });
  }
  return out;
}

export const googleSegmentacao: Segmentador = {
  tipo: "segmentacao",
  id: "google-segmentacao",
  nome: "Google Gemini (visão)",
  credencialId: "google",
  campos: [campoGoogleKey, campoModelo(MODELO_LLM_GOOGLE_PADRAO)],
  capacidades: { saida: "caixa", maxObjetos: MAX_OBJETOS },
  async testar(ctx) {
    const key = exigirCampo(ctx.config, "apiKey", "chave do Google");
    const modelo = ctx.config.modelo?.trim() || MODELO_LLM_GOOGLE_PADRAO;
    let r: Response;
    try {
      r = await ctx.http(`${GOOGLE_BASE}/${encodeURIComponent(modelo)}`, { headers: { "x-goog-api-key": key } });
    } catch {
      throw new ErroProvedor("Falha de rede ao testar.");
    }
    if (!r.ok) throw new ErroProvedor(`Provedor respondeu ${r.status}. Verifique a chave e o modelo.`);
  },
  async segmentar(ctx, p) {
    const key = exigirCampo(ctx.config, "apiKey", "chave do Google");
    const modelo = ctx.config.modelo?.trim() || MODELO_LLM_GOOGLE_PADRAO;
    const max = Math.min(MAX_OBJETOS, p.maxObjetos ?? MAX_OBJETOS);
    const j = await postarJson(
      ctx.http,
      `${GOOGLE_BASE}/${encodeURIComponent(modelo)}:generateContent`,
      { "x-goog-api-key": key },
      {
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: p.imagem.mime, data: p.imagem.base64 } }, { text: prompt(max, p.dica) }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
      [key],
    );
    const partes: any[] = j?.candidates?.[0]?.content?.parts ?? [];
    const texto = partes.map((pt) => pt.text ?? "").join("");
    if (!texto.trim()) throw new ErroProvedor("Resposta vazia do segmentador.");
    return interpretarSegmentos(texto).slice(0, max);
  },
};
