"use client";

import {
  collection,
  deleteDoc,
  deleteField,
  writeBatch,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { liberarMecanica } from "./puzzle-util";
import { NOTAS_VAZIAS, type EtapaLiberada, type Lore, type Nivel, type Notas, type Puzzle, type PuzzleEtapa, type Veredito } from "./marcas-data";

// ---------- Mesa ----------
// Tudo vive em mesas/{mesaId}/...: Mestre = donoUid da mesa; jogadores = membros.
const col = (mesaId: string, nome: string) => collection(db, "mesas", mesaId, nome);
const ref = (mesaId: string, nome: string, id: string) => doc(db, "mesas", mesaId, nome, id);

export function useMesaMarcas(mesaId: string, uid: string) {
  const [state, setState] = useState<{ pronto: boolean; existe: boolean; souMestre: boolean }>({
    pronto: false,
    existe: false,
    souMestre: false,
  });
  useEffect(
    () =>
      onSnapshot(
        doc(db, "mesas", mesaId),
        (s) => setState({ pronto: true, existe: s.exists(), souMestre: s.data()?.donoUid === uid }),
        () => setState({ pronto: true, existe: false, souMestre: false }),
      ),
    [mesaId, uid],
  );
  return state;
}

// ---------- Jogador ----------
export const registrarJogador = (mesaId: string, uid: string, name: string) =>
  setDoc(ref(mesaId, "players", uid), { joinedAt: serverTimestamp(), name }, { merge: true });

export function useMinhaAtribuicao(mesaId: string, uid: string) {
  const [state, setState] = useState<{ pronto: boolean; markId: string | null }>({ pronto: false, markId: null });
  useEffect(
    () =>
      onSnapshot(
        ref(mesaId, "assignments", uid),
        (s) => setState({ pronto: true, markId: (s.data()?.markId as string) ?? null }),
        () => setState({ pronto: true, markId: null }),
      ),
    [mesaId, uid],
  );
  return state;
}

/** Carrega as notas próprias uma vez (o estado local é a fonte depois disso). */
export function useMinhasNotasIniciais(mesaId: string, uid: string) {
  const [state, setState] = useState<{ pronto: boolean; notas: Notas }>({ pronto: false, notas: NOTAS_VAZIAS });
  useEffect(() => {
    const off = onSnapshot(
      ref(mesaId, "notes", uid),
      (s) => {
        setState({ pronto: true, notas: normalizarNotas(s.data()) });
        off();
      },
      () => setState({ pronto: true, notas: NOTAS_VAZIAS }),
    );
    return off;
  }, [mesaId, uid]);
  return state;
}

export const salvarNotas = (mesaId: string, uid: string, n: Notas) =>
  setDoc(ref(mesaId, "notes", uid), { ...n, updatedAt: serverTimestamp() });

function normalizarNotas(d: Record<string, unknown> | undefined): Notas {
  if (!d) return NOTAS_VAZIAS;
  const posts = Array.isArray(d.postits) ? (d.postits as { id?: string; text?: string }[]) : [];
  const niv = Array.isArray(d.niveis) ? (d.niveis as Partial<Nivel>[]) : [];
  return {
    passiva: String(d.passiva ?? ""),
    fardo: String(d.fardo ?? ""),
    habilidade: String(d.habilidade ?? ""),
    niveis: niv.map((n, i) => ({ id: n.id ?? `n${i}`, nome: String(n.nome ?? ""), gatilho: String(n.gatilho ?? ""), mudanca: String(n.mudanca ?? "") })),
    postits: posts.map((p, i) => ({ id: p.id ?? `p${i}`, text: String(p.text ?? "") })),
  };
}

// ---------- Painel do Mestre ----------
export type JogadorReg = { uid: string; name: string };

function useColecao<T>(mesaId: string, nome: string, mapa: (id: string, d: Record<string, unknown>) => T) {
  const [itens, setItens] = useState<T[]>([]);
  useEffect(
    () =>
      onSnapshot(
        col(mesaId, nome),
        (s) => setItens(s.docs.map((d) => mapa(d.id, d.data()))),
        () => setItens([]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesaId, nome],
  );
  return itens;
}

export const useJogadores = (m: string) =>
  useColecao<JogadorReg>(m, "players", (id, d) => ({ uid: id, name: String(d.name || id.slice(0, 6)) }));

export const useAtribuicoes = (m: string) =>
  useColecao<{ uid: string; markId: string }>(m, "assignments", (id, d) => ({ uid: id, markId: String(d.markId) }));

export const useTodasNotas = (m: string) => useColecao<{ uid: string; notas: Notas }>(m, "notes", (id, d) => ({ uid: id, notas: normalizarNotas(d) }));

export const useLore = (m: string) => useColecao<{ id: string; lore: Lore }>(m, "lore", (id, d) => ({ id, lore: d as unknown as Lore }));

const COLS_PUZZLE = ["released", "puzzleResp", "puzzleStatus"];
/** Ao trocar/remover a Marca, o progresso dos enigmas da Marca anterior é apagado. */
async function limparEnigmas(mesaId: string, uid: string) {
  const b = writeBatch(db);
  COLS_PUZZLE.forEach((c) => b.delete(ref(mesaId, c, uid)));
  await b.commit();
}

export async function atribuirMarca(mesaId: string, uid: string, markId: string) {
  await limparEnigmas(mesaId, uid);
  await setDoc(ref(mesaId, "assignments", uid), { markId, assignedAt: serverTimestamp() });
}

export async function removerAtribuicao(mesaId: string, uid: string) {
  await deleteDoc(ref(mesaId, "assignments", uid));
  await limparEnigmas(mesaId, uid);
}

export const salvarLore = (mesaId: string, markId: string, lore: Lore) => setDoc(ref(mesaId, "lore", markId), lore);

// ---------- Enigmas ----------
export const salvarPuzzle = (mesaId: string, markId: string, p: Puzzle) => setDoc(ref(mesaId, "puzzles", markId), p);

export const usePuzzles = (m: string) => useColecao<{ id: string; puzzle: Puzzle }>(m, "puzzles", (id, d) => ({ id, puzzle: d as unknown as Puzzle }));
export const useTodasLiberadas = (m: string) =>
  useColecao<{ uid: string; etapas: EtapaLiberada[] }>(m, "released", (id, d) => ({ uid: id, etapas: (d.etapas as EtapaLiberada[]) ?? [] }));
export const useTodasRespostas = (m: string) =>
  useColecao<{ uid: string; respostas: Record<string, string> }>(m, "puzzleResp", (id, d) => ({ uid: id, respostas: (d.respostas as Record<string, string>) ?? {} }));
export const useTodosVereditos = (m: string) =>
  useColecao<{ uid: string; status: Record<string, Veredito> }>(m, "puzzleStatus", (id, d) => ({ uid: id, status: (d.status as Record<string, Veredito>) ?? {} }));

/** Mestre libera (ou recolhe) uma etapa: copia texto/pergunta/mecânica, nunca o gabarito (a solução vira hash). */
export async function definirLiberadas(
  mesaId: string,
  uid: string,
  markId: string,
  etapas: (PuzzleEtapa & { idx: number; ambiente?: string })[],
) {
  const lib: EtapaLiberada[] = [...etapas]
    .sort((a, b) => a.idx - b.idx)
    .map((e) => {
      const x: EtapaLiberada = { idx: e.idx, titulo: e.titulo, texto: e.texto, pergunta: e.pergunta };
      // Firestore rejeita `undefined`: só inclui o que existe.
      if (e.ambiente) x.ambiente = e.ambiente;
      if (e.revelacao) x.revelacao = e.revelacao;
      if (e.mecanica) x.mecanica = liberarMecanica(e.mecanica, `${markId}:${e.idx}`);
      return x;
    });
  await setDoc(ref(mesaId, "released", uid), { etapas: lib });
}

export const julgarEtapa = (mesaId: string, uid: string, idx: number, v: Veredito | null) =>
  setDoc(
    ref(mesaId, "puzzleStatus", uid),
    { status: { [String(idx)]: v ? { estado: v.estado, nota: v.nota ?? "" } : deleteField() } },
    { merge: true },
  );

// Jogador: só enxerga o que foi liberado.
function useDocUnico<T>(mesaId: string, nome: string, uid: string, mapa: (d: Record<string, unknown> | undefined) => T, vazio: T) {
  const [st, setSt] = useState<{ pronto: boolean; v: T }>({ pronto: false, v: vazio });
  useEffect(
    () =>
      onSnapshot(
        ref(mesaId, nome, uid),
        (s) => setSt({ pronto: true, v: mapa(s.data()) }),
        () => setSt({ pronto: true, v: vazio }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mesaId, nome, uid],
  );
  return st;
}
export const useMinhasLiberadas = (m: string, uid: string) =>
  useDocUnico<EtapaLiberada[]>(m, "released", uid, (d) => (d?.etapas as EtapaLiberada[]) ?? [], []);
export const useMeusVereditos = (m: string, uid: string) =>
  useDocUnico<Record<string, Veredito>>(m, "puzzleStatus", uid, (d) => (d?.status as Record<string, Veredito>) ?? {}, {});
export const useMinhasRespostas = (m: string, uid: string) =>
  useDocUnico<Record<string, string>>(m, "puzzleResp", uid, (d) => (d?.respostas as Record<string, string>) ?? {}, {});

export const salvarResposta = (mesaId: string, uid: string, idx: number, texto: string) =>
  setDoc(ref(mesaId, "puzzleResp", uid), { respostas: { [String(idx)]: texto } }, { merge: true });

/** Marca a mecânica de uma etapa como decifrada (o Mestre vê; o jogador a reabre já resolvida). */
export const salvarResolvida = (mesaId: string, uid: string, idx: number, valor: string) =>
  setDoc(ref(mesaId, "puzzleResp", uid), { respostas: { [`ok${idx}`]: valor } }, { merge: true });
