/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de APIs externas */
import { exigirCampo, postarJson } from "../http.ts";
import { ErroProvedor, type ContextoProvedor, type ImagemBase64, type PedidoImagem, type ProvedorImagem } from "../tipos.ts";
import { GOOGLE_BASE, campoGoogleKey, campoModelo } from "./google-comum.ts";

// Modelo padrão confirmado na documentação oficial (família "Nano Banana").
// O formato de requisição usa generateContent (v1beta); a doc atual descreve também a
// Interactions API. A confirmação com chave real fica em docs/validacao-gemini.md (tarefa 6.4).
export const MODELO_IMAGEM_PADRAO = "gemini-3.1-flash-image";

async function chamar(ctx: ContextoProvedor, parts: unknown[]): Promise<ImagemBase64> {
  const key = exigirCampo(ctx.config, "apiKey", "chave do Google");
  const modelo = ctx.config.modelo?.trim() || MODELO_IMAGEM_PADRAO;
  const j = await postarJson(
    ctx.http,
    `${GOOGLE_BASE}/${encodeURIComponent(modelo)}:generateContent`,
    { "x-goog-api-key": key },
    { contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE"] } },
    [key],
  );
  const partes: any[] = j?.candidates?.[0]?.content?.parts ?? [];
  const img = partes.find((p) => p.inlineData?.data ?? p.inline_data?.data);
  const d = img?.inlineData ?? img?.inline_data;
  if (!d) throw new ErroProvedor("O provedor não devolveu imagem.");
  return { mime: d.mimeType ?? d.mime_type ?? "image/png", base64: d.data };
}

const refs = (r?: ImagemBase64[]) => (r ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } }));

export const googleImagem: ProvedorImagem = {
  tipo: "imagem",
  id: "google-imagem",
  nome: "Google Gemini (Nano Banana)",
  credencialId: "google",
  campos: [campoGoogleKey, campoModelo(MODELO_IMAGEM_PADRAO)],
  capacidades: { alfaNativo: false, imagensReferencia: 10, inpainting: "instrucao", seed: false, tamanhos: ["1K", "2K", "4K"] },
  async testar(ctx) {
    const key = exigirCampo(ctx.config, "apiKey", "chave do Google");
    const modelo = ctx.config.modelo?.trim() || MODELO_IMAGEM_PADRAO;
    // GET do modelo: valida chave e nome do modelo sem gerar (e sem custo).
    let r: Response;
    try {
      r = await ctx.http(`${GOOGLE_BASE}/${encodeURIComponent(modelo)}`, { headers: { "x-goog-api-key": key } });
    } catch {
      throw new ErroProvedor("Falha de rede ao testar.");
    }
    if (!r.ok) throw new ErroProvedor(`Provedor respondeu ${r.status}. Verifique a chave e o modelo.`);
  },
  gerar: (ctx, p: PedidoImagem) => chamar(ctx, [...refs(p.referencias), { text: p.prompt }]),
  editar: (ctx, p) =>
    chamar(ctx, [{ inlineData: { mimeType: p.imagem.mime, data: p.imagem.base64 } }, ...refs(p.referencias), { text: p.prompt }]),
};
