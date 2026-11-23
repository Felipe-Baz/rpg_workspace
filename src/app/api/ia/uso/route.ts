import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { definirTeto, lerUso } from "@/lib/servidor/ia";

export async function GET(req: Request) {
  try {
    const mesaId = new URL(req.url).searchParams.get("mesaId") ?? "";
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    await exigirMestre(req, mesaId);
    return Response.json(await lerUso(mesaId));
  } catch (e) {
    return respostaErro(e);
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    await exigirMestre(req, mesaId);
    await definirTeto(mesaId, Number(b.teto));
    return Response.json(await lerUso(mesaId));
  } catch (e) {
    return respostaErro(e);
  }
}
