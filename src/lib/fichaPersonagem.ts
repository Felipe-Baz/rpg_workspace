"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { FICHA_VAZIA, normalizar, type FichaDnd } from "./dnd5e";
import { useDocSincronizado } from "./mesas";
import { carregarCatalogoPhb, type Catalogo } from "./regras/dnd5e/catalogo";
import { derivar, type FichaCalculada } from "./regras/dnd5e/derivar";
import { fichaEfetiva } from "./regras/dnd5e/efetiva";
import type { PatchEstado } from "./regras/dnd5e/grupo";
import type { OpcoesMesa } from "./regras/sistema";

/** Ficha de personagem D&D 5e em `mesas/{mesaId}/personagens/{uid do jogador}` (salva sozinha, com debounce). */
export function useFichaPersonagem(mesaId: string, donoUid: string, habilitado = true) {
  const { dados, carregado, atualizar } = useDocSincronizado<FichaDnd>(["mesas", mesaId, "personagens", donoUid], FICHA_VAZIA, habilitado);
  const ficha = useMemo(() => normalizar(dados), [dados]);
  // o Firestore recusa `undefined` (ex.: build/concentracao removidos): a ida e volta por JSON descarta esses campos
  return { ficha, carregado, salvar: (f: FichaDnd) => atualizar(JSON.parse(JSON.stringify(f)) as FichaDnd) };
}

/**
 * A ficha com os valores calculados pelo livro (se houver `build`), para quem só LÊ a ficha de alguém: pedidos de teste,
 * painel do mestre, iniciativa. A ficha gravada guarda números defasados dos campos derivados; use sempre esta.
 */
export function useFichaEfetiva(mesaId: string, donoUid: string, opcoes?: OpcoesMesa, habilitado = true) {
  const { ficha: bruta, carregado } = useFichaPersonagem(mesaId, donoUid, habilitado);
  const [cat, setCat] = useState<Catalogo | null>(null);
  const precisa = habilitado && !!bruta.build;
  useEffect(() => {
    if (!precisa) return;
    let vivo = true;
    carregarCatalogoPhb().then((c) => vivo && setCat(c)).catch(() => {});
    return () => { vivo = false; };
  }, [precisa]);
  const calc = useMemo<FichaCalculada | null>(() => (bruta.build && cat ? derivar(bruta, cat, opcoes) : null), [bruta, cat, opcoes]);
  const ficha = useMemo(() => (bruta.build && cat && calc ? fichaEfetiva(bruta, calc, cat) : bruta), [bruta, cat, calc]);
  return { ficha, bruta, calc, catalogo: cat, carregado: carregado && (!bruta.build || !!cat) };
}

/** Versão assíncrona de `fichaEfetiva` para quem não está num componente. Sem `build`, devolve a ficha como está. */
export async function efetivaDe(bruta: FichaDnd, opcoes?: OpcoesMesa): Promise<{ ficha: FichaDnd; calc: FichaCalculada | null }> {
  if (!bruta.build) return { ficha: bruta, calc: null };
  const cat = await carregarCatalogoPhb();
  const calc = derivar(bruta, cat, opcoes);
  return { ficha: fichaEfetiva(bruta, calc, cat), calc };
}

/** Lê uma vez os PV atuais (e máximos) da ficha de um jogador; `null` se ele ainda não tem ficha. Uso do mestre. */
export async function lerPvDaFicha(mesaId: string, donoUid: string, opcoes?: OpcoesMesa): Promise<{ pv: number; pvMax: number } | null> {
  try {
    const snap = await getDoc(doc(db, "mesas", mesaId, "personagens", donoUid));
    if (!snap.exists()) return null;
    const { ficha: f } = await efetivaDe(normalizar(snap.data() as Partial<FichaDnd>), opcoes);
    return { pv: f.pv, pvMax: f.pvMax };
  } catch {
    return null;
  }
}

export type { PatchEstado };

/**
 * Atualização atômica POR CAMPO (`updateDoc`): dano, cura e condições aplicados pelo mestre não pisam em quem está
 * editando outras partes da ficha ao mesmo tempo. `undefined` apaga o campo.
 */
export async function atualizarEstadoDaFicha(mesaId: string, donoUid: string, patch: PatchEstado): Promise<void> {
  const dados: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) dados[k] = v === undefined ? deleteField() : JSON.parse(JSON.stringify(v));
  if (Object.keys(dados).length) await updateDoc(doc(db, "mesas", mesaId, "personagens", donoUid), dados);
}
