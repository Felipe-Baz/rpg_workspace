"use client";

import { useMemo } from "react";
import { FICHA_VAZIA, normalizar, type FichaDnd } from "./dnd5e";
import { useDocSincronizado } from "./mesas";

/** Ficha de personagem D&D 5e em `mesas/{mesaId}/personagens/{uid do jogador}` (salva sozinha, com debounce). */
export function useFichaPersonagem(mesaId: string, donoUid: string, habilitado = true) {
  const { dados, carregado, atualizar } = useDocSincronizado<FichaDnd>(["mesas", mesaId, "personagens", donoUid], FICHA_VAZIA, habilitado);
  const ficha = useMemo(() => normalizar(dados), [dados]);
  return { ficha, carregado, salvar: (f: FichaDnd) => atualizar(f) };
}
