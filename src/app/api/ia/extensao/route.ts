import { interpretarResposta, MAX_HTML } from "@/lib/extensoes/documento";
import { montarPedidoExtensao, type MensagemChat } from "@/lib/extensoes/prompt";
import { obterProvedor, provedoresLlm } from "@/lib/mapas-ia/registro";
import { ErroProvedor } from "@/lib/mapas-ia/tipos";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { contextoDoProvedor, estadoCredenciais, lerConfig } from "@/lib/servidor/ia";

// Corpo: { mesaId, mensagens: [{ papel: "usuario"|"assistente", texto }], htmlAtual?: string }
// Devolve { explicacao, html|null, provedor }. Nada é salvo aqui; usa a chave do mestre dono da mesa.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    const { uid } = await exigirMestre(req, mesaId);

    const mensagens: MensagemChat[] = (Array.isArray(b.mensagens) ? b.mensagens : [])
      .filter((m: unknown): m is MensagemChat => !!m && typeof (m as MensagemChat).texto === "string" && ["usuario", "assistente"].includes((m as MensagemChat).papel))
      .map((m: MensagemChat) => ({ papel: m.papel, texto: m.texto }));
    if (mensagens.length === 0 || mensagens[mensagens.length - 1].papel !== "usuario") throw new ErroHttp(400, "Envie uma mensagem.");
    const htmlAtual = typeof b.htmlAtual === "string" && b.htmlAtual.length <= MAX_HTML ? b.htmlAtual : null;

    const cfg = await lerConfig(uid);
    let p = cfg.provedorLlmAtivo ? obterProvedor(cfg.provedorLlmAtivo) : undefined;
    if (!p) {
      const cred = await estadoCredenciais(uid);
      p = provedoresLlm().find((x) => cred[x.credencialId]?.configurada);
    }
    if (!p || p.tipo !== "llm") throw new ErroHttp(400, "Nenhum provedor de LLM ativo ou com chave salva. Configure na tela IA.");

    const ctx = await contextoDoProvedor(uid, p);
    try {
      const r = await p.conversar(ctx, montarPedidoExtensao(mensagens, htmlAtual));
      return Response.json({ ...interpretarResposta(r.texto), provedor: p.id });
    } catch (e) {
      if (e instanceof ErroProvedor) return Response.json({ erro: e.message }, { status: 502 });
      // Resposta cortada / grande demais / sem HTML válido: erro da IA, não do servidor.
      if (e instanceof Error && /(cortada|grande demais|HTML válido)/.test(e.message)) return Response.json({ erro: e.message }, { status: 502 });
      throw e;
    }
  } catch (e) {
    return respostaErro(e);
  }
}
