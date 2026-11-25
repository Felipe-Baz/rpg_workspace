import "server-only";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./admin";
import { ErroHttp } from "./auth";

/** Documentos `mesas/{id}/{colecao}/{uid}` que pertencem a um único jogador (id do documento = uid). */
const COLECOES_POR_UID = [
  "anotacoes", // diário
  "pinos",
  "personagens", // ficha D&D 5e
  "players", // Marcas de Pacto
  "assignments",
  "notes",
  "released",
  "puzzleResp",
  "puzzleStatus",
] as const;

/** Coleções cujos documentos trazem o uid do jogador em um campo. */
const COLECOES_POR_CAMPO: { colecao: string; campo: string }[] = [
  { colecao: "quadro", campo: "donoUid" },
  { colecao: "rolagens", campo: "uid" },
  { colecao: "pedidosTeste", campo: "paraUid" },
  { colecao: "extensoesPedidos", campo: "de" },
];

type Mesa = { donoUid: string; membros: string[]; jogadores?: { id: string; uid?: string }[] };

async function lerMesa(db: Firestore, mesaId: string) {
  const ref = db.collection("mesas").doc(mesaId);
  const snap = await ref.get();
  if (!snap.exists) throw new ErroHttp(404, "Mesa não encontrada.");
  return { ref, mesa: snap.data() as Mesa };
}

function exigirAlvo(mesa: Mesa, uid: string) {
  if (!uid) throw new ErroHttp(400, "uid ausente.");
  if (uid === mesa.donoUid) throw new ErroHttp(400, "O mestre não pode ser alvo desta ação.");
}

async function apagarRefs(db: Firestore, refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const lote = db.batch();
    refs.slice(i, i + 400).forEach((r) => lote.delete(r));
    await lote.commit();
  }
}

/** Apaga só a ficha D&D 5e do jogador (`personagens/{uid}`). */
export async function apagarFicha(mesaId: string, uid: string) {
  const db = adminDb();
  const { ref, mesa } = await lerMesa(db, mesaId);
  exigirAlvo(mesa, uid);
  await ref.collection("personagens").doc(uid).delete();
}

/**
 * Remove o jogador da mesa e apaga tudo o que é só dele: diário, pinos, ficha, fichas e quadro pessoais,
 * rolagens, pedidos, dados de extensões e das Marcas de Pacto, o personagem na lista da mesa e as notas
 * do mestre sobre ele. Não toca no conteúdo da mesa (mapas, missões, mundo, fichas do mestre…).
 */
export async function removerJogador(mesaId: string, uid: string) {
  const db = adminDb();
  const { ref, mesa } = await lerMesa(db, mesaId);
  exigirAlvo(mesa, uid);

  const refs: DocumentReference[] = COLECOES_POR_UID.map((c) => ref.collection(c).doc(uid));

  const fichas = await ref.collection("fichas").where("donoUid", "==", uid).get();
  fichas.forEach((d) => {
    if (d.get("mestre") !== true) refs.push(d.ref); // fichas do mestre ficam, mesmo se criadas por ele
  });
  for (const { colecao, campo } of COLECOES_POR_CAMPO) {
    (await ref.collection(colecao).where(campo, "==", uid).get()).forEach((d) => refs.push(d.ref));
  }
  for (const ext of (await ref.collection("extensoes").get()).docs) {
    refs.push(ext.ref.collection("estado").doc(`de_${uid}`), ext.ref.collection("estado").doc(`para_${uid}`));
  }
  await apagarRefs(db, refs);

  // Personagens ligados à conta e as notas do mestre sobre eles; depois, a saída da lista de membros.
  const idsPersonagens = (mesa.jogadores ?? []).filter((j) => j.uid === uid).map((j) => j.id);
  if (idsPersonagens.length) {
    await ref.collection("segredos").doc("mestre").set(
      { notasJogadores: Object.fromEntries(idsPersonagens.map((id) => [id, FieldValue.delete()])) },
      { merge: true },
    );
  }
  await db.runTransaction(async (tx) => {
    const atual = (await tx.get(ref)).data() as Mesa;
    tx.update(ref, {
      membros: atual.membros.filter((m) => m !== uid),
      jogadores: (atual.jogadores ?? []).filter((j) => j.uid !== uid),
    });
  });
}

/** Remove o jogador e impede que ele volte pelo código (`mesas/{id}/bloqueados/{uid}`, checado nas regras). */
export async function bloquearJogador(mesaId: string, uid: string, nome: string) {
  const db = adminDb();
  const { ref, mesa } = await lerMesa(db, mesaId);
  exigirAlvo(mesa, uid);
  // Bloqueia primeiro: se a limpeza falhar no meio, o jogador já não consegue voltar.
  await ref.collection("bloqueados").doc(uid).set({ nome: nome.slice(0, 60), em: Date.now() });
  await removerJogador(mesaId, uid);
}

export async function desbloquearJogador(mesaId: string, uid: string) {
  if (!uid) throw new ErroHttp(400, "uid ausente.");
  await adminDb().collection("mesas").doc(mesaId).collection("bloqueados").doc(uid).delete();
}

export type PessoaMesa = { uid: string; nome: string; em?: number };

/** Membros (exceto o mestre) e bloqueados, com um nome legível (personagem/jogador da mesa ou nome da conta). */
export async function listarPessoas(mesaId: string): Promise<{ membros: PessoaMesa[]; bloqueados: PessoaMesa[] }> {
  const db = adminDb();
  const { ref, mesa } = await lerMesa(db, mesaId);
  const bloq = await ref.collection("bloqueados").get();

  const nomeDaMesa = (uid: string) => {
    const j = (mesa.jogadores ?? []).find((x) => x.uid === uid) as { nome?: string; personagem?: string } | undefined;
    return j?.nome || j?.personagem || "";
  };
  const uids = mesa.membros.filter((m) => m !== mesa.donoUid);
  const contas = uids.length ? await adminAuth().getUsers(uids.map((uid) => ({ uid }))) : { users: [] };
  const nomeConta = new Map(contas.users.map((u) => [u.uid, u.displayName ?? ""]));

  return {
    membros: uids.map((uid) => ({ uid, nome: nomeDaMesa(uid) || nomeConta.get(uid) || "Conta sem nome" })),
    bloqueados: bloq.docs.map((d) => ({ uid: d.id, nome: String(d.get("nome") ?? "") || "Conta sem nome", em: d.get("em") })),
  };
}
