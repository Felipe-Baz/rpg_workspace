import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { apagarFicha, bloquearJogador, desbloquearJogador, listarPessoas, removerJogador } from "@/lib/servidor/membros";

export async function GET(req: Request) {
  try {
    const mesaId = new URL(req.url).searchParams.get("mesaId") ?? "";
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    await exigirMestre(req, mesaId);
    return Response.json(await listarPessoas(mesaId));
  } catch (e) {
    return respostaErro(e);
  }
}

/** Ações do mestre sobre jogadores: remover, apagarFicha, bloquear, desbloquear. */
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    const uid = String(b.uid ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    await exigirMestre(req, mesaId);
    switch (b.acao) {
      case "remover":
        await removerJogador(mesaId, uid);
        break;
      case "apagarFicha":
        await apagarFicha(mesaId, uid);
        break;
      case "bloquear":
        await bloquearJogador(mesaId, uid, String(b.nome ?? ""));
        break;
      case "desbloquear":
        await desbloquearJogador(mesaId, uid);
        break;
      default:
        throw new ErroHttp(400, "Ação inválida.");
    }
    return Response.json({ ok: true });
  } catch (e) {
    return respostaErro(e);
  }
}
