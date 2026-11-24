"use client";

import { useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { FICHA_VAZIA, normalizar, type FichaDnd } from "./dnd5e";
import { useDocSincronizado } from "./mesas";

/** Ficha de personagem D&D 5e em `mesas/{mesaId}/personagens/{uid do jogador}` (salva sozinha, com debounce). */
export function useFichaPersonagem(mesaId: string, donoUid: string, habilitado = true) {
  const { dados, carregado, atualizar } = useDocSincronizado<FichaDnd>(["mesas", mesaId, "personagens", donoUid], FICHA_VAZIA, habilitado);
  const ficha = useMemo(() => normalizar(dados), [dados]);
  return { ficha, carregado, salvar: (f: FichaDnd) => atualizar(f) };
}

/** Lê uma vez os PV atuais (e máximos) da ficha de um jogador; `null` se ele ainda não tem ficha. Uso do mestre. */
export async function lerPvDaFicha(mesaId: string, donoUid: string): Promise<{ pv: number; pvMax: number } | null> {
  try {
    const snap = await getDoc(doc(db, "mesas", mesaId, "personagens", donoUid));
    if (!snap.exists()) return null;
    const f = normalizar(snap.data() as Partial<FichaDnd>);
    return { pv: f.pv, pvMax: f.pvMax };
  } catch {
    return null;
  }
}
