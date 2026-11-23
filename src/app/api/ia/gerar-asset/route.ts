import { after } from "next/server";
import { estimarLote } from "@/lib/mapas-ia/limites";
import { validarPedido, type PedidoAsset } from "@/lib/mapas-ia/assets/jobs";
import { obterProvedor } from "@/lib/mapas-ia/registro";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { criarJob, executarJobAsset } from "@/lib/servidor/assets";
import { exigirTeto, lerConfig, lerUso } from "@/lib/servidor/ia";

export const maxDuration = 300;

// Corpo: { mesaId, pedido (ver validarPedido), confirmado? }
// Cria o job ("na-fila"), responde 202 e executa depois da resposta; o cliente acompanha o job por onSnapshot.
// Usa SEMPRE a chave do mestre dono da mesa. Lotes (> 1 imagem) exigem `confirmado: true`.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    const { uid } = await exigirMestre(req, mesaId);

    let pedido: PedidoAsset;
    try {
      pedido = validarPedido(b.pedido);
    } catch (e) {
      throw new ErroHttp(400, (e as Error).message);
    }

    const cfg = await lerConfig(uid);
    const p = cfg.provedorImagemAtivo ? obterProvedor(cfg.provedorImagemAtivo) : undefined;
    if (!p || p.tipo !== "imagem") throw new ErroHttp(400, "Nenhum provedor de imagem ativo configurado.");

    if (pedido.quantidade > 1 && b.confirmado !== true) {
      const { uso, teto } = await lerUso(mesaId);
      return Response.json({ confirmacaoNecessaria: true, estimativa: estimarLote(uso, teto, pedido.quantidade) }, { status: 409 });
    }
    await exigirTeto(mesaId, pedido.quantidade);

    const job = await criarJob(mesaId, pedido);
    after(() => executarJobAsset({ mesaId, uid, jobId: job.id, pedido }));
    return Response.json({ jobId: job.id }, { status: 202 });
  } catch (e) {
    return respostaErro(e);
  }
}
