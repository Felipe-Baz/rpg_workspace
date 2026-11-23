/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de APIs externas */
import { exigirCampo, juntarPapeisIguais, postarJson } from "../http.ts";
import { ErroProvedor, type ChamadaFerramenta, type MensagemLlm, type PedidoLlm, type ProvedorLlm } from "../tipos.ts";
import { GOOGLE_BASE, campoGoogleKey, campoModelo } from "./google-comum.ts";

export const MODELO_LLM_GOOGLE_PADRAO = "gemini-3.6-flash";

function conteudo(m: MensagemLlm) {
  if (m.papel === "ferramenta") {
    return { role: "user", parts: [{ functionResponse: { name: m.resultadoDe?.nome ?? "", response: { resultado: m.texto ?? "" } } }] };
  }
  const parts: unknown[] = (m.imagens ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } }));
  if (m.texto) parts.push({ text: m.texto });
  // Gemini 3 exige a thoughtSignature de volta na mesma parte da functionCall (só a primeira de chamadas paralelas a tem).
  for (const c of m.chamadas ?? []) parts.push({ functionCall: { name: c.nome, args: c.argumentos }, ...(c.assinatura ? { thoughtSignature: c.assinatura } : {}) });
  return { role: m.papel === "assistente" ? "model" : "user", parts };
}

export const googleLlm: ProvedorLlm = {
  tipo: "llm",
  id: "google-llm",
  nome: "Google Gemini",
  credencialId: "google",
  campos: [campoGoogleKey, campoModelo(MODELO_LLM_GOOGLE_PADRAO)],
  capacidades: { visao: true, ferramentas: true },
  async testar(ctx) {
    await this.conversar(ctx, { mensagens: [{ papel: "usuario", texto: "Responda apenas: ok" }] });
  },
  async conversar(ctx, p: PedidoLlm) {
    const key = exigirCampo(ctx.config, "apiKey", "chave do Google");
    const modelo = ctx.config.modelo?.trim() || MODELO_LLM_GOOGLE_PADRAO;
    const corpo: Record<string, unknown> = { contents: juntarPapeisIguais(p.mensagens.map(conteudo), "parts") };
    if (p.sistema) corpo.systemInstruction = { parts: [{ text: p.sistema }] };
    if (p.ferramentas?.length) {
      corpo.tools = [{ functionDeclarations: p.ferramentas.map((f) => ({ name: f.nome, description: f.descricao, parameters: f.parametros })) }];
    }
    const j = await postarJson(ctx.http, `${GOOGLE_BASE}/${encodeURIComponent(modelo)}:generateContent`, { "x-goog-api-key": key }, corpo, [key]);
    const partes: any[] = j?.candidates?.[0]?.content?.parts;
    if (!partes) throw new ErroProvedor("Resposta vazia do provedor.");
    const chamadas: ChamadaFerramenta[] = [];
    let texto = "";
    partes.forEach((pt, i) => {
      if (pt.text) texto += pt.text;
      if (pt.functionCall) {
        const assinatura = pt.thoughtSignature ?? pt.thought_signature;
        chamadas.push({ id: pt.functionCall.id ?? `g${i}`, nome: pt.functionCall.name, argumentos: pt.functionCall.args ?? {}, ...(assinatura ? { assinatura } : {}) });
      }
    });
    return { texto, chamadas };
  },
};
