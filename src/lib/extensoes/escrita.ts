"use client";

// Escrita feita por extensões: sempre em LOTE, marcada com a extensão de origem, para listar e desfazer.
// Quem decide é o mestre: este módulo só executa depois da aprovação (ver components/extensoes/proponente.ts).

import { collection, doc, getDoc, query, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { derivarPublica, type MissaoMestre } from "../missoes";
import { uid as novoId, type Mesa } from "../mesas";
import type { Acao } from "./acoes";
import { useLista } from "./dados";
import { montarDocumentosLote, type ItemLote } from "./lote";

export type Lote = { id: string; extId: string; titulo: string; criadoEm: number; itens: ItemLote[]; desfeitoEm: number | null };
export type ResultadoLote = { lote: string; criados: ItemLote[]; avisos: string[] };

const colLotes = (mesaId: string) => collection(db, "mesas", mesaId, "extensoesLotes");

/**
 * Grava o lote de uma vez (writeBatch: tudo ou nada). `ensaio` não grava nada: devolve ids fictícios,
 * para a extensão poder ser testada no criador sem sujar a mesa.
 */
export async function executarLote(entrada: { mesa: Mesa; uid: string; ext: { id: string; titulo: string }; acoes: Acao[]; ensaio?: boolean }): Promise<ResultadoLote> {
  const { mesa, uid, ext, acoes, ensaio } = entrada;
  const lote = novoId();
  const docs = montarDocumentosLote({ acoes, uidMestre: uid, jogadores: mesa.jogadores, origem: { extensao: ext.id, lote }, agora: Date.now(), novoId });
  const resultado: ResultadoLote = { lote, criados: docs.itens, avisos: docs.avisos };
  if (ensaio) return { ...resultado, lote: `ensaio-${lote}` };

  const b = writeBatch(db);
  for (const f of docs.fichas) b.set(doc(db, "mesas", mesa.id, "fichas", f.id), f);
  for (const m of docs.missoes) {
    b.set(doc(db, "mesas", mesa.id, "missoesMestre", m.id), m);
    b.set(doc(db, "mesas", mesa.id, "missoes", m.id), derivarPublica(m as unknown as MissaoMestre));
  }
  const registro: Lote = { id: lote, extId: ext.id, titulo: ext.titulo, criadoEm: Date.now(), itens: docs.itens, desfeitoEm: null };
  b.set(doc(colLotes(mesa.id), lote), registro);
  await b.commit();
  return resultado;
}

/** Apaga tudo que o lote criou (mesmo que o mestre tenha editado depois) e marca o lote como desfeito. */
export async function desfazerLote(mesaId: string, lote: Lote): Promise<void> {
  const ref = doc(colLotes(mesaId), lote.id);
  const atual = await getDoc(ref);
  if (!atual.exists() || (atual.data() as Lote).desfeitoEm) return;
  const b = writeBatch(db);
  for (const i of lote.itens) {
    if (i.tipo === "ficha") b.delete(doc(db, "mesas", mesaId, "fichas", i.id));
    else {
      b.delete(doc(db, "mesas", mesaId, "missoesMestre", i.id));
      b.delete(doc(db, "mesas", mesaId, "missoes", i.id));
    }
  }
  b.update(ref, { desfeitoEm: Date.now() });
  await b.commit();
}

/** Lotes criados por extensões nesta mesa (mais recentes primeiro). `extId` filtra por extensão. */
export function useLotes(mesaId: string, extId: string | null, habilitado: boolean) {
  const { itens, carregado } = useLista<Lote>(habilitado && mesaId ? () => query(colLotes(mesaId)) : null, `lotes:${mesaId}:${habilitado}`);
  return { lotes: itens.filter((l) => !extId || l.extId === extId).sort((a, b) => b.criadoEm - a.criadoEm), carregado };
}
