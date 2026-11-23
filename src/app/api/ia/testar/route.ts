import { obterProvedor } from "@/lib/mapas-ia/registro";
import { ErroProvedor } from "@/lib/mapas-ia/tipos";
import { ErroHttp, respostaErro, verificarToken } from "@/lib/servidor/auth";
import { contextoDoProvedor } from "@/lib/servidor/ia";

// Chamada mínima ao provedor com a chave salva. Erros do provedor voltam saneados (sem chave).
export async function POST(req: Request) {
  try {
    const { uid } = await verificarToken(req);
    const { provedorId } = await req.json().catch(() => ({}));
    const p = obterProvedor(String(provedorId ?? ""));
    if (!p) throw new ErroHttp(400, "Provedor desconhecido.");
    const ctx = await contextoDoProvedor(uid, p);
    try {
      await p.testar(ctx);
    } catch (e) {
      const msg = e instanceof ErroProvedor ? e.message : "Falha ao testar o provedor.";
      return Response.json({ ok: false, erro: msg });
    }
    return Response.json({ ok: true, capacidades: p.capacidades });
  } catch (e) {
    return respostaErro(e);
  }
}
