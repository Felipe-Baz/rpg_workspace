import { ErroProvedor } from "@/lib/mapas-ia/tipos";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { provedorInpainting, segmentarMapa } from "@/lib/servidor/conversao";
import { exigirTeto, lerUso } from "@/lib/servidor/ia";

export const maxDuration = 120;

// Corpo: { mesaId, mapaId, colecao? }. Segmenta a imagem do mapa (lida do documento, nunca do corpo) e devolve
// as máscaras sugeridas para revisão, se o provedor de imagem reconstrói o fundo e o uso atual (para a estimativa).
// Conta 1 uso no teto da mesa.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    const mapaId = String(b.mapaId ?? "");
    if (!mesaId || !mapaId) throw new ErroHttp(400, "mesaId ou mapaId ausente.");
    const colecao = b.colecao === "imagens" ? "imagens" : "mapas";
    const { uid } = await exigirMestre(req, mesaId);
    await exigirTeto(mesaId, 1);
    let revisao;
    try {
      revisao = await segmentarMapa({ mesaId, uid, colecao, mapaId });
    } catch (e) {
      if (e instanceof ErroProvedor) throw new ErroHttp(502, e.message);
      throw e;
    }
    const { uso, teto } = await lerUso(mesaId);
    return Response.json({ revisao, inpainting: !!(await provedorInpainting(uid)), uso: { total: uso.total }, teto });
  } catch (e) {
    return respostaErro(e);
  }
}
