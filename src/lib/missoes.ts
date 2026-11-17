"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { uid as novoId } from "./mesas";

export type StatusMissao = "andamento" | "concluida" | "fracassada";

export const STATUS_MISSAO: { id: StatusMissao; rotulo: string; icone: string; cor: string }[] = [
  { id: "andamento", rotulo: "Em andamento", icone: "⏳", cor: "text-amber-500" },
  { id: "concluida", rotulo: "Concluídas", icone: "✅", cor: "text-emerald-500" },
  { id: "fracassada", rotulo: "Fracassadas", icone: "❌", cor: "text-red-500" },
];

// Documento mesas/{id}/missoes/{missaoId}. O mestre escreve; todo membro lê.
export type Missao = {
  id: string;
  titulo: string;
  descricao: string; // Markdown
  status: StatusMissao;
  criadoEm: number;
};

const col = (mesaId: string) => collection(db, "mesas", mesaId, "missoes");

export function useMissoes(mesaId: string, habilitado: boolean) {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!habilitado) return;
    return onSnapshot(
      col(mesaId),
      (snap) => {
        setMissoes(snap.docs.map((d) => d.data() as Missao).sort((a, b) => b.criadoEm - a.criadoEm));
        setCarregado(true);
      },
      (e) => {
        console.error("missoes:", e);
        setCarregado(true);
      },
    );
  }, [mesaId, habilitado]);

  return { missoes, carregado };
}

export async function criarMissao(mesaId: string, titulo: string) {
  const m: Missao = { id: novoId(), titulo, descricao: "", status: "andamento", criadoEm: Date.now() };
  await setDoc(doc(col(mesaId), m.id), m);
}

export const atualizarMissao = (mesaId: string, id: string, patch: Partial<Missao>) =>
  updateDoc(doc(col(mesaId), id), patch);

export const excluirMissao = (mesaId: string, id: string) => deleteDoc(doc(col(mesaId), id));
