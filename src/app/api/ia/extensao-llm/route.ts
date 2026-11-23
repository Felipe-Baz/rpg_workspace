import { FieldValue } from "firebase-admin/firestore";
import { LIMITE_IA_PADRAO, MAX_PERGUNTA, decidirLimiteIa, diaDe, limparRespostaIa, montarPedidoPergunta } from "@/lib/extensoes/ia-extensao";
import { obterProvedor, provedoresLlm } from "@/lib/mapas-ia/registro";
import { ErroProvedor } from "@/lib/mapas-ia/tipos";
import { adminDb } from "@/lib/servidor/admin";
import { ErroHttp, respostaErro, verificarToken } from "@/lib/servidor/auth";
import { contextoDoProvedor, estadoCredenciais, lerConfig } from "@/lib/servidor/ia";

// Corpo: { mesaId, extId, texto }. A extensão pergunta à IA DO MESTRE (chave e limite do mestre dono da mesa).
// Quem chama pode ser o mestre ou um jogador da mesa: o servidor confere que a extensão existe, está ativa,
// tem a permissão "usar:ia" APROVADA e (para jogador) está liberada. Cada pergunta consome o limite diário da mesa.
export async function POST(req: Request) {
  try {
    const { uid } = await verificarToken(req);
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    const extId = String(b.extId ?? "");
    const texto = typeof b.texto === "string" ? b.texto : "";
    if (!mesaId || !extId) throw new ErroHttp(400, "mesaId e extId são obrigatórios.");
    if (!texto.trim()) throw new ErroHttp(400, "Envie uma pergunta.");
    if (texto.length > MAX_PERGUNTA) throw new ErroHttp(400, `A pergunta passa de ${MAX_PERGUNTA} caracteres.`);

    const db = adminDb();
    const mesaRef = db.collection("mesas").doc(mesaId);
    const [mesaSnap, extSnap] = await Promise.all([mesaRef.get(), mesaRef.collection("extensoes").doc(extId).get()]);
    const mesa = mesaSnap.data();
    if (!mesaSnap.exists || !mesa || !Array.isArray(mesa.membros) || !mesa.membros.includes(uid)) throw new ErroHttp(403, "Você não faz parte desta mesa.");
    const ext = extSnap.data();
    if (!extSnap.exists || !ext) throw new ErroHttp(404, "Extensão não encontrada nesta mesa.");
    if (ext.ativa === false) throw new ErroHttp(403, "A extensão está desativada.");
    if (!Array.isArray(ext.permissoesAprovadas) || !ext.permissoesAprovadas.includes("usar:ia")) throw new ErroHttp(403, "Esta extensão não tem permissão para usar a IA.");
    const donoUid = String(mesa.donoUid);
    if (uid !== donoUid && ext.visivelJogadores !== true) throw new ErroHttp(403, "Esta extensão não está liberada aos jogadores.");

    // Provedor de LLM do MESTRE (a chave nunca sai do servidor).
    const cfg = await lerConfig(donoUid);
    let p = cfg.provedorLlmAtivo ? obterProvedor(cfg.provedorLlmAtivo) : undefined;
    if (!p) {
      const cred = await estadoCredenciais(donoUid);
      p = provedoresLlm().find((x) => cred[x.credencialId]?.configurada);
    }
    if (!p || p.tipo !== "llm") throw new ErroHttp(400, "O mestre ainda não configurou uma IA de texto.");

    // Limite diário por mesa, contado de forma atômica ANTES da chamada (e devolvido se o provedor falhar).
    const refUso = mesaRef.collection("uso").doc(`ia-${diaDe()}`);
    const refCfg = mesaRef.collection("uso").doc("config");
    await db.runTransaction(async (tx) => {
      const [u, c] = await Promise.all([tx.get(refUso), tx.get(refCfg)]);
      const limite = typeof c.data()?.tetoIaExtensoes === "number" ? (c.data()!.tetoIaExtensoes as number) : LIMITE_IA_PADRAO;
      const d = decidirLimiteIa((u.data()?.chamadas as number | undefined) ?? 0, limite);
      if (!d.ok) throw new ErroHttp(429, d.motivo);
      tx.set(refUso, { chamadas: FieldValue.increment(1), atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
    });

    try {
      const ctx = await contextoDoProvedor(donoUid, p);
      const r = await p.conversar(ctx, montarPedidoPergunta(texto));
      return Response.json({ texto: limparRespostaIa(r.texto) });
    } catch (e) {
      await refUso.set({ chamadas: FieldValue.increment(-1) }, { merge: true }).catch(() => {});
      if (e instanceof ErroProvedor) return Response.json({ erro: e.message }, { status: 502 });
      throw e;
    }
  } catch (e) {
    return respostaErro(e);
  }
}
