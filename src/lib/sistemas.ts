"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { SISTEMAS_PADRAO, montarOpcoes, type OpcaoSistema } from "./sistemas-padrao";

const PUBLICOS = "sistemas"; // lidos por qualquer logado; só o servidor escreve
const PESSOAIS = "sistemasPessoais"; // { donoUid, nome, criadoEm }; só o dono lê e escreve

/** Opções do dropdown: sistemas públicos do banco + os cadastrados pelo próprio usuário. */
export function useSistemas(uid: string): OpcaoSistema[] {
  const [publicos, setPublicos] = useState<string[]>(SISTEMAS_PADRAO);
  const [pessoais, setPessoais] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    const offPub = onSnapshot(
      collection(db, PUBLICOS),
      (snap) => {
        const nomes = snap.docs.map((d) => String(d.data().nome ?? ""));
        setPublicos(nomes.some((n) => n.trim()) ? nomes : SISTEMAS_PADRAO);
      },
      () => setPublicos(SISTEMAS_PADRAO),
    );
    const offPes = onSnapshot(
      query(collection(db, PESSOAIS), where("donoUid", "==", uid)),
      (snap) => setPessoais(snap.docs.map((d) => ({ id: d.id, nome: String(d.data().nome ?? "") }))),
      (e) => console.error("sistemasPessoais:", e),
    );
    return () => {
      offPub();
      offPes();
    };
  }, [uid]);

  return useMemo(() => montarOpcoes(publicos, pessoais), [publicos, pessoais]);
}

export async function criarSistemaPessoal(uid: string, nome: string) {
  await addDoc(collection(db, PESSOAIS), { donoUid: uid, nome: nome.trim().slice(0, 60), criadoEm: Date.now() });
}

export async function excluirSistemaPessoal(id: string) {
  await deleteDoc(doc(db, PESSOAIS, id));
}
