import { exigirCampo, juntarPapeisIguais, postarJson } from "../http.ts";
import { ErroProvedor, type CampoConfig, type ChamadaFerramenta, type MensagemLlm, type PedidoLlm, type ProvedorLlm } from "../tipos.ts";

export const MODELO_ANTHROPIC_PADRAO = "claude-sonnet-5-5";

const campos: CampoConfig[] = [
  { chave: "apiKey", rotulo: "Chave de API da Anthropic", tipo: "segredo" },
  { chave: "modelo", rotulo: "Modelo", tipo: "texto", padrao: MODELO_ANTHROPIC_PADRAO, ajuda: "Nomes de modelo mudam; altere aqui." },
];

function mensagem(m: MensagemLlm) {
  if (m.papel === "ferramenta") {
    return { role: "user", content: [{ type: "tool_result", tool_use_id: m.resultadoDe?.id ?? "", content: m.texto ?? "" }] };
  }
  const content: unknown[] = (m.imagens ?? []).map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.base64 } }));
  if (m.texto) content.push({ type: "text", text: m.texto });
  for (const c of m.chamadas ?? []) content.push({ type: "tool_use", id: c.id, name: c.nome, input: c.argumentos });
  return { role: m.papel === "assistente" ? "assistant" : "user", content };
}

export const anthropicLlm: ProvedorLlm = {
  tipo: "llm",
  id: "anthropic-llm",
  nome: "Anthropic Claude",
  credencialId: "anthropic",
  campos,
  capacidades: { visao: true, ferramentas: true },
  async testar(ctx) {
    await this.conversar(ctx, { mensagens: [{ papel: "usuario", texto: "Responda apenas: ok" }] });
  },
  async conversar(ctx, p: PedidoLlm) {
    const key = exigirCampo(ctx.config, "apiKey", "chave da Anthropic");
    const corpo: Record<string, unknown> = {
      model: ctx.config.modelo?.trim() || MODELO_ANTHROPIC_PADRAO,
      max_tokens: 4096,
      messages: juntarPapeisIguais(p.mensagens.map(mensagem), "content"),
    };
    if (p.sistema) corpo.system = p.sistema;
    if (p.ferramentas?.length) {
      corpo.tools = p.ferramentas.map((f) => ({ name: f.nome, description: f.descricao, input_schema: f.parametros }));
    }
    const j = await postarJson(
      ctx.http,
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      corpo,
      [key],
    );
    if (!Array.isArray(j?.content)) throw new ErroProvedor("Resposta vazia do provedor.");
    const chamadas: ChamadaFerramenta[] = [];
    let texto = "";
    for (const b of j.content) {
      if (b.type === "text") texto += b.text;
      if (b.type === "tool_use") chamadas.push({ id: b.id, nome: b.name, argumentos: b.input ?? {} });
    }
    return { texto, chamadas };
  },
};
