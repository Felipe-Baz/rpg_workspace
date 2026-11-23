"use client";

// Estado por escopo no Firestore (E7). Sempre com as credenciais de quem usa: as regras de `estado/` são a barreira
// (o jogador só alcança o próprio `para_`/`de_`, e só com a extensão visível, ativa e o escopo aprovado).
//   compartilhado → mesas/{id}/extensoes/{extId}.dadosJson
//   mestre / para_{uid} / de_{uid} → mesas/{id}/extensoes/{extId}/estado/{docId}

import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { ESCOPOS, idDocEstado, lerIdDocEstado, serializarEstado, type ArmazemEstado, type Escopo } from "./estado";

export type DocEstado = { json: string; uid?: string; atualizadoEm: number };
export type ItemEstado = { id: string; escopo: Exclude<Escopo, "compartilhado">; uid: string | null; json: string; atualizadoEm: number };

const refInstalacao = (mesaId: string, extId: string) => doc(db, "mesas", mesaId, "extensoes", extId);
const colEstado = (mesaId: string, extId: string) => collection(db, "mesas", mesaId, "extensoes", extId, "estado");

function docRef(mesaId: string, extId: string, escopo: Escopo, conta: string | null) {
  const id = idDocEstado(escopo, conta);
  if (!id) throw new Error(`Escopo ${escopo} precisa de um jogador.`);
  return doc(colEstado(mesaId, extId), id);
}

/** Grava um documento de escopo (sem passar pelo broker: usado pelo painel Dados e pela semeadura). */
export async function gravarDocEstado(mesaId: string, extId: string, escopo: Escopo, conta: string | null, json: string) {
  serializarEstado(JSON.parse(json)); // valida JSON e tamanho
  if (escopo === "compartilhado") return updateDoc(refInstalacao(mesaId, extId), { dadosJson: json });
  const corpo: DocEstado = { json, atualizadoEm: Date.now(), ...(ESCOPOS[escopo].porJogador && conta ? { uid: conta } : {}) };
  await setDoc(docRef(mesaId, extId, escopo, conta), corpo);
}

/** Armazém usado pelo broker de uma extensão em execução. */
export function armazemFirestore(mesaId: string, extId: string): ArmazemEstado {
  return {
    async ler(escopo, conta) {
      if (escopo === "compartilhado") {
        const s = await getDoc(refInstalacao(mesaId, extId));
        return s.exists() ? ((s.data().dadosJson as string) || null) : null;
      }
      const s = await getDoc(docRef(mesaId, extId, escopo, conta));
      return s.exists() ? ((s.data() as DocEstado).json ?? null) : null;
    },
    async salvar(escopo, conta, json) {
      try {
        await gravarDocEstado(mesaId, extId, escopo, conta, json);
      } catch (e) {
        if ((e as { code?: string }).code === "permission-denied") throw new Error("A extensão está indisponível no momento (desativada, oculta ou sem este escopo aprovado).");
        throw e;
      }
    },
    async listar(escopo) {
      const snap = await getDocs(colEstado(mesaId, extId));
      const saida: Record<string, string> = {};
      for (const d of snap.docs) {
        const info = lerIdDocEstado(d.id);
        if (info?.escopo === escopo && info.uid) saida[info.uid] = (d.data() as DocEstado).json ?? "null";
      }
      return saida;
    },
    assinar(escopo, conta, aoMudar) {
      const erro = (e: unknown) => console.warn("extensões: assinatura de estado:", e);
      if (escopo === "compartilhado") return onSnapshot(refInstalacao(mesaId, extId), (s) => aoMudar(null, s.exists() ? ((s.data().dadosJson as string) || null) : null), erro);
      if (conta || !ESCOPOS[escopo].porJogador) return onSnapshot(docRef(mesaId, extId, escopo, conta), (s) => aoMudar(conta, s.exists() ? (s.data() as DocEstado).json : null), erro);
      // Todos os jogadores do escopo (só o mestre consegue listar a subcoleção).
      return onSnapshot(
        colEstado(mesaId, extId),
        (snap) => {
          for (const ch of snap.docChanges()) {
            const info = lerIdDocEstado(ch.doc.id);
            if (info?.escopo !== escopo || !info.uid) continue;
            aoMudar(info.uid, ch.type === "removed" ? null : (ch.doc.data() as DocEstado).json);
          }
        },
        erro,
      );
    },
  };
}

/** Painel "Dados" (só o mestre): todos os documentos de escopo da extensão, em tempo real. */
export function useEstadoExtensao(mesaId: string, extId: string, habilitado = true) {
  const [estado, setEstado] = useState<{ chave: string; itens: ItemEstado[] } | null>(null);
  const chave = `${mesaId}/${extId}/${habilitado}`;
  useEffect(() => {
    if (!habilitado || !mesaId || !extId) return;
    return onSnapshot(
      colEstado(mesaId, extId),
      (snap) => {
        const itens: ItemEstado[] = [];
        for (const d of snap.docs) {
          const info = lerIdDocEstado(d.id);
          const dado = d.data() as DocEstado;
          if (info) itens.push({ id: d.id, escopo: info.escopo, uid: info.uid, json: dado.json ?? "null", atualizadoEm: dado.atualizadoEm ?? 0 });
        }
        setEstado({ chave, itens });
      },
      (e) => {
        console.error("extensões: estado:", e);
        setEstado({ chave, itens: [] });
      },
    );
  }, [mesaId, extId, habilitado, chave]);
  const pronto = estado?.chave === chave;
  return { itens: pronto ? estado.itens : [], carregado: !habilitado || pronto };
}

export const apagarDocEstado = (mesaId: string, extId: string, docId: string) => deleteDoc(doc(colEstado(mesaId, extId), docId));

/** Apaga os documentos indicados (ou todos) da subcoleção, em lotes de até 400. */
export async function apagarEstado(mesaId: string, extId: string, filtro: (id: string) => boolean = () => true) {
  const snap = await getDocs(colEstado(mesaId, extId));
  const alvos = snap.docs.filter((d) => filtro(d.id));
  for (let i = 0; i < alvos.length; i += 400) {
    const b = writeBatch(db);
    alvos.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  return alvos.length;
}

/** Semeia `estado/mestre` com os dados iniciais da biblioteca, só se ainda não existir. */
export async function semearMestre(mesaId: string, extId: string, json: string | undefined) {
  if (!json) return;
  const ref = doc(colEstado(mesaId, extId), "mestre");
  if ((await getDoc(ref)).exists()) return;
  await gravarDocEstado(mesaId, extId, "mestre", null, json);
}

/** Esvazia o estado compartilhado (o mesmo de uma instalação nova). */
export const limparCompartilhado = (mesaId: string, extId: string) => updateDoc(refInstalacao(mesaId, extId), { dadosJson: "" });
