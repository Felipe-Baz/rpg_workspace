import { estimarLote } from "@/lib/mapas-ia/limites";
import { obterProvedor } from "@/lib/mapas-ia/registro";
import { ErroProvedor } from "@/lib/mapas-ia/tipos";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { contextoDoProvedor, exigirTeto, lerConfig, lerUso, registrarUso } from "@/lib/servidor/ia";

// Corpo: { mesaId, tipo: "imagem"|"llm", pedido, quantidade?, confirmado? }
// Usa SEMPRE a chave do mestre dono da mesa (exigirMestre => uid === donoUid). Jogador recebe 403.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    const { uid } = await exigirMestre(req, mesaId);

    const tipo = b.tipo === "llm" ? "llm" : b.tipo === "imagem" ? "imagem" : null;
    if (!tipo) throw new ErroHttp(400, "tipo inválido.");
    const cfg = await lerConfig(uid);
    const id = tipo === "imagem" ? cfg.provedorImagemAtivo : cfg.provedorLlmAtivo;
    const p = id ? obterProvedor(id) : undefined;
    if (!p || p.tipo !== tipo) throw new ErroHttp(400, "Nenhum provedor ativo configurado.");

    const quantidade = tipo === "imagem" ? Math.max(1, Math.min(200, Number(b.quantidade) || 1)) : 1;
    if (quantidade > 1 && b.confirmado !== true) {
      const { uso, teto } = await lerUso(mesaId);
      return Response.json({ confirmacaoNecessaria: true, estimativa: estimarLote(uso, teto, quantidade) }, { status: 409 });
    }
    if (tipo === "imagem") await exigirTeto(mesaId, quantidade);

    const ctx = await contextoDoProvedor(uid, p);
    try {
      const resultado = p.tipo === "imagem" ? await p.gerar(ctx, b.pedido) : await p.conversar(ctx, b.pedido);
      if (tipo === "imagem") await registrarUso(mesaId, p.id, tipo, quantidade);
      return Response.json({ resultado, provedor: p.id });
    } catch (e) {
      if (e instanceof ErroProvedor) return Response.json({ erro: e.message }, { status: 502 });
      throw e;
    }
  } catch (e) {
    return respostaErro(e);
  }
}
