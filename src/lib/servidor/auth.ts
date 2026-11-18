import "server-only";
import { adminAuth, adminDb } from "./admin";

/** Erro com status HTTP, para as rotas converterem em resposta. */
export class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** Valida o ID token do cabeçalho Authorization: Bearer. Lança 401 se ausente/inválido. */
export async function verificarToken(req: Request): Promise<{ uid: string }> {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  if (!m) throw new ErroHttp(401, "Não autenticado.");
  try {
    const t = await adminAuth().verifyIdToken(m[1]);
    return { uid: t.uid };
  } catch {
    throw new ErroHttp(401, "Token inválido.");
  }
}

/** Exige que o usuário seja o dono (mestre) da mesa. 401 sem token, 403 se não for mestre. */
export async function exigirMestre(req: Request, mesaId: string): Promise<{ uid: string }> {
  const { uid } = await verificarToken(req);
  const snap = await adminDb().collection("mesas").doc(mesaId).get();
  if (!snap.exists || snap.data()?.donoUid !== uid) throw new ErroHttp(403, "Apenas o mestre da mesa.");
  return { uid };
}

/** Converte qualquer erro em Response JSON (use no catch das rotas). */
export function respostaErro(e: unknown): Response {
  if (e instanceof ErroHttp) return Response.json({ erro: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ erro: "Erro interno." }, { status: 500 });
}
