import { after } from "next/server";
import { estimarConversao, validarPedidoConversao, type PedidoConversao } from "@/lib/mapas-ia/conversao/conversao";
import { estimarLote } from "@/lib/mapas-ia/limites";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { criarJobConversao, executarJobConversao, provedorInpainting } from "@/lib/servidor/conversao";
import { exigirTeto, lerUso } from "@/lib/servidor/ia";

export const maxDuration = 300;

// Corpo: { mesaId, pedido (ver validarPedidoConversao), confirmado? }
// Converte um mapa de imagem em cena: inpainting do fundo sob os objetos aceitos, recorte dos sprites e criação
// de assets, cena e um NOVO mapa (o original só é lido). Responde 202 com o job; o cliente acompanha por onSnapshot.
// Sem `confirmado: true`, responde 409 com a estimativa (o custo depende do número de objetos).
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    const { uid } = await exigirMestre(req, mesaId);

    let pedido: PedidoConversao;
    try {
      pedido = validarPedidoConversao(b.pedido);
    } catch (e) {
      throw new ErroHttp(400, (e as Error).message);
    }

    const est = estimarConversao(pedido.objetos.length, !!(await provedorInpainting(uid)));
    if (b.confirmado !== true) {
      const { uso, teto } = await lerUso(mesaId);
      return Response.json({ confirmacaoNecessaria: true, conversao: est, estimativa: estimarLote(uso, teto, est.geracoes) }, { status: 409 });
    }
    if (est.geracoes > 0) await exigirTeto(mesaId, est.geracoes);

    const job = await criarJobConversao(mesaId, pedido.mapaId);
    after(() => executarJobConversao({ mesaId, uid, jobId: job.id, pedido }));
    return Response.json({ jobId: job.id, conversao: est }, { status: 202 });
  } catch (e) {
    return respostaErro(e);
  }
}
