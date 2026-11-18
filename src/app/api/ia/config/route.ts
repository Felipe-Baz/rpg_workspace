import { descreverProvedor, PROVEDORES } from "@/lib/mapas-ia/registro";
import { verificarToken, respostaErro } from "@/lib/servidor/auth";
import { estadoCredenciais, lerConfig, removerSegredo, salvarConfig, salvarSegredo } from "@/lib/servidor/ia";

// Nunca devolve chaves: só "configurada" e os 4 últimos caracteres.
export async function GET(req: Request) {
  try {
    const { uid } = await verificarToken(req);
    return Response.json({
      provedores: PROVEDORES.map(descreverProvedor),
      config: await lerConfig(uid),
      credenciais: await estadoCredenciais(uid),
    });
  } catch (e) {
    return respostaErro(e);
  }
}

// Corpo: { provedorImagemAtivo?, provedorLlmAtivo?, campos?, segredos?: {credId: chave}, removerSegredos?: [credId] }
export async function PUT(req: Request) {
  try {
    const { uid } = await verificarToken(req);
    const b = await req.json().catch(() => ({}));
    for (const [cred, chave] of Object.entries((b.segredos ?? {}) as Record<string, unknown>)) {
      if (typeof chave === "string" && chave.trim()) await salvarSegredo(uid, cred, chave);
    }
    for (const cred of (b.removerSegredos ?? []) as string[]) await removerSegredo(uid, cred);
    await salvarConfig(uid, { provedorImagemAtivo: b.provedorImagemAtivo, provedorLlmAtivo: b.provedorLlmAtivo, campos: b.campos });
    return Response.json({ ok: true, credenciais: await estadoCredenciais(uid), config: await lerConfig(uid) });
  } catch (e) {
    return respostaErro(e);
  }
}
