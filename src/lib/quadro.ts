"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { uid as novoId } from "./mesas";

export type TipoNo = "nota" | "texto" | "imagem";

// Documento privado mesas/{id}/quadro/{noId}. Cada elemento do quadro de investigação
// é um documento; as linhas ficam em `ligacoes` (ids dos elementos de destino).
export type No = {
  id: string;
  donoUid: string;
  tipo: TipoNo;
  x: number;
  y: number;
  w: number;
  texto: string;
  cor: string;
  imagem: string; // data URL ou ""
  ligacoes: string[];
  criadoEm: number;
};

export const CORES_NOTA = ["#fde68a", "#fda4af", "#a7f3d0", "#bae6fd", "#ddd6fe", "#fed7aa"];

const col = (mesaId: string) => collection(db, "mesas", mesaId, "quadro");

export function useQuadro(mesaId: string, usuarioUid: string, habilitado: boolean) {
  const [nos, setNos] = useState<No[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!habilitado || !usuarioUid) return;
    return onSnapshot(
      query(col(mesaId), where("donoUid", "==", usuarioUid)),
      (snap) => {
        setNos(snap.docs.map((d) => d.data() as No).sort((a, b) => a.criadoEm - b.criadoEm));
        setCarregado(true);
      },
      (e) => {
        console.error("quadro:", e);
        setCarregado(true);
      },
    );
  }, [mesaId, usuarioUid, habilitado]);

  return { nos, carregado };
}

export async function criarNo(mesaId: string, usuarioUid: string, dados: Pick<No, "tipo" | "x" | "y" | "w"> & Partial<No>) {
  const no: No = {
    texto: "",
    cor: CORES_NOTA[0],
    imagem: "",
    ligacoes: [],
    ...dados,
    id: novoId(),
    donoUid: usuarioUid,
    criadoEm: Date.now(),
  };
  await setDoc(doc(col(mesaId), no.id), no);
  return no.id;
}

export const atualizarNo = (
  mesaId: string,
  noId: string,
  patch: Partial<Pick<No, "x" | "y" | "w" | "texto" | "cor" | "ligacoes">>,
) => updateDoc(doc(col(mesaId), noId), patch);

export const excluirNo = (mesaId: string, noId: string) => deleteDoc(doc(col(mesaId), noId));
