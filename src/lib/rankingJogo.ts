// Ranking do minijogo "Caça aos Corvos": um documento por usuário em `rankingJogo/{uid}` com a melhor pontuação.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type EntradaRanking = { uid: string; nick: string; pontos: number };

export const MAX_NICK = 16;
export const MAX_PONTOS = 30_000;
export const TOP_RANKING = 10;

export function limparNick(n: string) {
  return n.replace(/\s+/g, " ").trim().slice(0, MAX_NICK);
}

export async function lerRanking(): Promise<EntradaRanking[]> {
  const snap = await getDocs(query(collection(db, "rankingJogo"), orderBy("pontos", "desc"), limit(TOP_RANKING)));
  return snap.docs.map((d) => {
    const v = d.data();
    return { uid: d.id, nick: String(v.nick ?? "?"), pontos: Number(v.pontos) || 0 };
  });
}

/** Grava só se superar o recorde já salvo (ou se for o primeiro). Devolve true quando gravou. */
export async function salvarPontuacao(uid: string, nick: string, pontos: number): Promise<boolean> {
  const limpo = limparNick(nick);
  const p = Math.min(Math.floor(pontos), MAX_PONTOS);
  if (!limpo || p <= 0) return false;
  const ref = doc(db, "rankingJogo", uid);
  const atual = await getDoc(ref);
  if (atual.exists() && Number(atual.data().pontos) >= p) {
    return false;
  }
  await setDoc(ref, { uid, nick: limpo, pontos: p, em: serverTimestamp() });
  return true;
}
