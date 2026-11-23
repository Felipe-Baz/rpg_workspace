"use client";

// Registros dos tipos de dado que as extensões criam (ex.: Facções): mesas/{id}/recursosDados/{registroId}.
// O app gera lista, formulário e busca a partir da definição (`DefRecurso`); o mestre libera cada registro aos jogadores.

import { collection, deleteDoc, doc, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { uid as novoId } from "../mesas";
import { useLista } from "./dados";
import type { ValoresRecurso } from "./efeitos";

export type RegistroRecurso = {
  id: string;
  extId: string;
  recursoId: string;
  valores: ValoresRecurso;
  liberado: boolean; // visível aos jogadores
  criadoEm: number;
  atualizadoEm: number;
};

const col = (mesaId: string) => collection(db, "mesas", mesaId, "recursosDados");

/** Mestre vê todos; jogador só os liberados (a consulta já filtra, como exigem as regras). */
export function useRegistros(mesaId: string, extId: string, recursoId: string, comoMestre: boolean) {
  const base = [where("extId", "==", extId), where("recursoId", "==", recursoId)];
  const { itens, carregado } = useLista<RegistroRecurso>(
    mesaId ? () => query(col(mesaId), ...base, ...(comoMestre ? [] : [where("liberado", "==", true)])) : null,
    `reg:${mesaId}:${extId}:${recursoId}:${comoMestre}`,
  );
  return { registros: [...itens].sort((a, b) => b.criadoEm - a.criadoEm), carregado };
}

export async function salvarRegistro(
  mesaId: string,
  e: { id?: string; extId: string; recursoId: string; valores: ValoresRecurso; liberado?: boolean; criadoEm?: number },
) {
  const agora = Date.now();
  const r: RegistroRecurso = { id: e.id ?? novoId(), extId: e.extId, recursoId: e.recursoId, valores: e.valores, liberado: e.liberado ?? false, criadoEm: e.criadoEm ?? agora, atualizadoEm: agora };
  await setDoc(doc(col(mesaId), r.id), r);
  return r.id;
}

export const definirLiberado = (mesaId: string, id: string, liberado: boolean) => updateDoc(doc(col(mesaId), id), { liberado });
export const excluirRegistro = (mesaId: string, id: string) => deleteDoc(doc(col(mesaId), id));
