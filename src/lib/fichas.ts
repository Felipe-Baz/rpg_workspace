"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { uid as novoId } from "./mesas";

export type CategoriaFicha = "npc" | "inimigo" | "importante" | "item";

export const CATEGORIAS: { id: CategoriaFicha; rotulo: string; singular: string; icone: string }[] = [
  { id: "npc", rotulo: "NPCs", singular: "NPC", icone: "🧑" },
  { id: "inimigo", rotulo: "Inimigos", singular: "Inimigo", icone: "💀" },
  { id: "importante", rotulo: "Pessoas importantes", singular: "Pessoa importante", icone: "⭐" },
  { id: "item", rotulo: "Itens", singular: "Item", icone: "🎒" },
];

// Documento privado mesas/{id}/fichas/{fichaId}. A foto vai comprimida (data URL) no documento.
export type Ficha = {
  id: string;
  donoUid: string;
  categoria: CategoriaFicha;
  nome: string;
  foto: string; // data URL ou ""
  texto: string; // anotações em Markdown
  criadoEm: number;
  // Fichas do mestre: visíveis (somente leitura) só a quem ele liberar.
  mestre: boolean;
  todos: boolean;
  liberadoPara: string[];
};

const col = (mesaId: string) => collection(db, "mesas", mesaId, "fichas");

/**
 * Jogador: as próprias fichas (privadas) + as do mestre liberadas para ele.
 * Mestre (`comoMestre`): só as fichas cadastradas por ele (nunca as privadas dos jogadores).
 */
export function useFichas(mesaId: string, usuarioUid: string, habilitado: boolean, comoMestre = false) {
  const [grupos, setGrupos] = useState<Ficha[][]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!habilitado || !usuarioUid) return;
    const consultas = comoMestre
      ? [query(col(mesaId), where("mestre", "==", true))]
      : [
          query(col(mesaId), where("donoUid", "==", usuarioUid)),
          query(col(mesaId), where("todos", "==", true)),
          query(col(mesaId), where("liberadoPara", "array-contains", usuarioUid)),
        ];
    const resultados: Ficha[][] = consultas.map(() => []);
    const feitos = new Set<number>();
    const offs = consultas.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          resultados[i] = snap.docs.map((d) => d.data() as Ficha);
          feitos.add(i);
          setGrupos([...resultados]);
          if (feitos.size === consultas.length) setCarregado(true);
        },
        (e) => {
          console.error("fichas:", e);
          feitos.add(i);
          if (feitos.size === consultas.length) setCarregado(true);
        },
      ),
    );
    return () => offs.forEach((o) => o());
  }, [mesaId, usuarioUid, habilitado, comoMestre]);

  const vistas = new Map<string, Ficha>();
  grupos.flat().forEach((f) => vistas.set(f.id, f));
  const fichas = [...vistas.values()].sort((a, b) => b.criadoEm - a.criadoEm);
  return { fichas, carregado };
}

export async function criarFicha(
  mesaId: string,
  usuarioUid: string,
  categoria: CategoriaFicha,
  nome: string,
  mestre = false,
) {
  const ficha: Ficha = {
    id: novoId(),
    donoUid: usuarioUid,
    categoria,
    nome,
    foto: "",
    texto: "",
    criadoEm: Date.now(),
    mestre,
    todos: false,
    liberadoPara: [],
  };
  await setDoc(doc(col(mesaId), ficha.id), ficha);
  return ficha.id;
}

export const atualizarFicha = (
  mesaId: string,
  fichaId: string,
  patch: Partial<Pick<Ficha, "nome" | "foto" | "texto" | "todos" | "liberadoPara">>,
) => updateDoc(doc(col(mesaId), fichaId), patch);

export const excluirFicha = (mesaId: string, fichaId: string) => deleteDoc(doc(col(mesaId), fichaId));
