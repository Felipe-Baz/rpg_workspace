// Rolagens compartilhadas da mesa: cada rolagem vira um documento em `mesas/{id}/rolagens/{rolagemId}`.
// Quem está com a mesa aberta recebe o documento na hora e repete a animação (a semente e as faces vão no documento).
// Quem não está online não vê a animação: ao abrir, só encontra o histórico.
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Rolagem } from "./dados";
import type { Jogada } from "./dados3d";

export type RolagemMesa = {
  id: string;
  uid: string;
  nome: string;
  rolagem: Rolagem;
  jogada: Jogada | null;
  /** Relógio de quem rolou (ms). Serve para ignorar rolagens antigas, não para ordenar com precisão. */
  em: number;
  rotulo?: string;
};

export const MAX_HISTORICO = 30;
/** Rolagem mais velha que isso não é reencenada (quem abriu a mesa depois só vê o histórico). */
export const IDADE_MAX_ANIMACAO_MS = 20_000;

const limpo = <T,>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore não aceita `undefined`

export async function publicarRolagem(mesaId: string, r: RolagemMesa) {
  await setDoc(doc(db, "mesas", mesaId, "rolagens", r.id), {
    uid: r.uid,
    nome: r.nome.slice(0, 60),
    expressao: r.rolagem.expressao.slice(0, 60),
    total: r.rolagem.total,
    rolagem: limpo(r.rolagem),
    jogada: r.jogada ? limpo(r.jogada) : null,
    em: r.em,
    rotulo: r.rotulo ? r.rotulo.slice(0, 80) : null,
    criadoEm: serverTimestamp(),
  });
}

/**
 * Escuta as últimas rolagens. `aoLista` recebe o histórico a cada mudança; `aoNova` só recebe rolagens que chegaram
 * DEPOIS de a escuta começar (a carga inicial é histórico, não vira animação).
 */
export function assinarRolagens(mesaId: string, aoLista: (l: RolagemMesa[]) => void, aoNova: (r: RolagemMesa) => void): () => void {
  const q = query(collection(db, "mesas", mesaId, "rolagens"), orderBy("criadoEm", "desc"), limit(MAX_HISTORICO));
  let inicial = true;
  const ler = (d: { id: string; data: (o?: { serverTimestamps: "estimate" }) => Record<string, unknown> }): RolagemMesa => {
    const x = d.data({ serverTimestamps: "estimate" });
    return {
      id: d.id,
      uid: String(x.uid ?? ""),
      nome: String(x.nome ?? ""),
      rolagem: x.rolagem as Rolagem,
      jogada: (x.jogada as Jogada | null) ?? null,
      em: Number(x.em ?? 0),
      rotulo: typeof x.rotulo === "string" ? x.rotulo : undefined,
    };
  };
  return onSnapshot(
    q,
    (snap) => {
      // `aoNova` antes de `aoLista`: quem encena a rolagem precisa esconder o resultado do histórico antes de ele aparecer.
      if (!inicial) {
        for (const c of snap.docChanges()) {
          if (c.type === "added" && !c.doc.metadata.hasPendingWrites) aoNova(ler(c.doc));
        }
      }
      inicial = false;
      aoLista(snap.docs.map(ler));
    },
    (e) => console.error("rolagens:", e),
  );
}
