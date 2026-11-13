"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export type Status = "planejando" | "ativa" | "pausada" | "encerrada";

// uid: conta que controla o personagem (vazio = ainda não reivindicado)
export type Jogador = { id: string; nome: string; personagem: string; uid?: string };

export type Sessao = {
  id: string;
  titulo: string;
  data: string; // yyyy-mm-dd
  resumoPublico: string; // visível para todos os membros da mesa
};

export type Mesa = {
  id: string;
  nome: string;
  sistema: string;
  descricao: string;
  cor: string;
  status: Status;
  criadaEm: number;
  donoUid: string; // mestre
  membros: string[]; // uids com acesso (inclui o mestre)
  codigo: string; // código de convite para jogadores
  jogadores: Jogador[];
  sessoes: Sessao[];
};

// Documento mesas/{id}/segredos/mestre — só o mestre lê e escreve.
export type Segredos = {
  segredosMestre: string;
  notasSessoes: Record<string, string>;
  // Notas do mestre sobre cada jogador (chave = Jogador.id); jogadores nunca veem.
  notasJogadores?: Record<string, string[] | string>;
};

/** Notas em páginas; aceita o formato antigo (texto único). */
export function paginasDe(v: string[] | string | undefined): string[] {
  if (Array.isArray(v)) return v.length ? v : [""];
  return [v ?? ""];
}

export const STATUS_LABEL: Record<Status, string> = {
  planejando: "Planejando",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

export const CORES = ["#7c3aed", "#dc2626", "#059669", "#d97706", "#2563eb", "#db2777"];

const COLECAO = "mesas";
const CONVITES = "convites";
const DEBOUNCE_MS = 600;
const EMPTY: Mesa[] = [];

// ---------- estado das mesas do usuário logado ----------
let remoto: Mesa[] = EMPTY;
let cache: Mesa[] = EMPTY;
let pronto = false;
let uidAtual: string | null = null;
let unsub: (() => void) | null = null;
const listeners = new Set<() => void>();

const pendentes = new Map<string, Partial<Mesa>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function recalcular() {
  cache = remoto.map((m) => (pendentes.has(m.id) ? { ...m, ...pendentes.get(m.id) } : m));
  listeners.forEach((l) => l());
}

/** Chamado pelo AuthProvider quando o usuário entra/sai. */
export function definirUsuario(uid: string | null) {
  if (uid === uidAtual) return;
  unsub?.();
  unsub = null;
  uidAtual = uid;
  remoto = EMPTY;
  pronto = false;
  pendentes.clear();
  timers.forEach(clearTimeout);
  timers.clear();
  recalcular();
  if (!uid) return;

  unsub = onSnapshot(
    query(collection(db, COLECAO), where("membros", "array-contains", uid)),
    (snap) => {
      remoto = snap.docs
        .map((d) => d.data() as Mesa)
        .sort((a, b) => b.criadaEm - a.criadaEm);
      pronto = true;
      recalcular();
    },
    (err) => {
      console.error("Erro ao ler mesas do Firestore:", err);
      pronto = true;
      recalcular();
    },
  );
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useMesas(): { mesas: Mesa[]; pronto: boolean } {
  const mesas = useSyncExternalStore(subscribe, () => cache, () => EMPTY);
  const ok = useSyncExternalStore(subscribe, () => pronto, () => false);
  return { mesas, pronto: ok };
}

export const uid = () => crypto.randomUUID();

function gerarCodigo() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

export async function criarMesa(
  donoUid: string,
  dados: Pick<Mesa, "nome" | "sistema" | "descricao" | "cor" | "status">,
): Promise<string> {
  const mesa: Mesa = {
    ...dados,
    id: uid(),
    criadaEm: Date.now(),
    donoUid,
    membros: [donoUid],
    codigo: gerarCodigo(),
    jogadores: [],
    sessoes: [],
  };
  const batch = writeBatch(db);
  batch.set(doc(db, COLECAO, mesa.id), mesa);
  batch.set(doc(db, CONVITES, mesa.codigo), { mesaId: mesa.id, donoUid });
  await batch.commit();
  return mesa.id;
}

/** Jogador entra numa mesa usando o código de convite. */
export async function entrarPorCodigo(codigo: string, usuarioUid: string): Promise<string> {
  const convite = await getDoc(doc(db, CONVITES, codigo.trim().toUpperCase()));
  if (!convite.exists()) throw new Error("Código de convite inválido.");
  const { mesaId } = convite.data() as { mesaId: string };
  await updateDoc(doc(db, COLECAO, mesaId), { membros: arrayUnion(usuarioUid) });
  return mesaId;
}

/** Jogador assume um personagem já cadastrado pelo mestre. */
export async function assumirPersonagem(mesaId: string, jogadorId: string, usuarioUid: string, nomeJogador: string) {
  const ref = doc(db, COLECAO, mesaId);
  await runTransaction(db, async (tx) => {
    const mesa = (await tx.get(ref)).data() as Mesa;
    const alvo = mesa.jogadores.find((j) => j.id === jogadorId);
    if (!alvo) throw new Error("Personagem não existe mais.");
    if (alvo.uid && alvo.uid !== usuarioUid) throw new Error("Esse personagem já foi escolhido por outra pessoa.");
    if (mesa.jogadores.some((j) => j.uid === usuarioUid)) return;
    tx.update(ref, {
      jogadores: mesa.jogadores.map((j) =>
        j.id === jogadorId ? { ...j, uid: usuarioUid, nome: j.nome || nomeJogador } : j,
      ),
    });
  });
}

/** Jogador cria o próprio personagem na mesa. */
export async function criarPersonagem(mesaId: string, usuarioUid: string, nome: string, personagem: string) {
  const ref = doc(db, COLECAO, mesaId);
  await runTransaction(db, async (tx) => {
    const mesa = (await tx.get(ref)).data() as Mesa;
    if (mesa.jogadores.some((j) => j.uid === usuarioUid)) return;
    tx.update(ref, { jogadores: [...mesa.jogadores, { id: uid(), nome, personagem, uid: usuarioUid }] });
  });
}

async function enviar(id: string) {
  const patch = pendentes.get(id);
  timers.delete(id);
  if (!patch) return;
  pendentes.delete(id);
  try {
    await updateDoc(doc(db, COLECAO, id), patch);
  } catch (e) {
    console.error("atualizarMesa:", e);
  }
}

export function atualizarMesa(id: string, patch: Partial<Mesa>) {
  pendentes.set(id, { ...pendentes.get(id), ...patch });
  recalcular();
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => enviar(id), DEBOUNCE_MS));
}

export async function excluirMesa(mesa: Mesa) {
  clearTimeout(timers.get(mesa.id));
  timers.delete(mesa.id);
  pendentes.delete(mesa.id);
  const batch = writeBatch(db);
  batch.delete(doc(db, COLECAO, mesa.id, "segredos", "mestre"));
  batch.delete(doc(db, CONVITES, mesa.codigo));
  batch.delete(doc(db, COLECAO, mesa.id));
  await batch.commit().catch((e) => console.error("excluirMesa:", e));
}

/** Jogador sai da mesa (o mestre não pode sair; só excluir). */
export async function sairDaMesa(mesa: Mesa, usuarioUid: string) {
  await updateDoc(doc(db, COLECAO, mesa.id), {
    membros: mesa.membros.filter((u) => u !== usuarioUid),
  });
}

// ---------- segredos do mestre (documento separado) ----------
const SEGREDOS_VAZIOS: Segredos = { segredosMestre: "", notasSessoes: {} };

function useDocSincronizado<T extends object>(caminho: string[], vazio: T, habilitado: boolean) {
  const [dados, setDados] = useState<T>(vazio);
  const [carregado, setCarregado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sujo = useRef<T | null>(null);
  const saveRef = useRef<(() => void) | null>(null);
  const chave = caminho.join("/");

  useEffect(() => {
    if (!habilitado) return;
    const ref = doc(db, chave);

    const salvar = () => {
      clearTimeout(timer.current);
      const valor = sujo.current;
      sujo.current = null;
      if (valor) setDoc(ref, valor).catch((e) => console.error("sync:", e));
    };

    const off = onSnapshot(
      ref,
      (snap) => {
        if (!sujo.current) setDados({ ...vazio, ...(snap.data() as Partial<T> | undefined) });
        setCarregado(true);
      },
      (err) => {
        console.error("Erro ao ler documento:", err);
        setCarregado(true);
      },
    );
    window.addEventListener("pagehide", salvar);
    saveRef.current = salvar;
    return () => {
      off();
      window.removeEventListener("pagehide", salvar);
      salvar();
      saveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, habilitado]);

  function atualizar(proximo: T) {
    setDados(proximo);
    sujo.current = proximo;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveRef.current?.(), DEBOUNCE_MS);
  }

  return { dados, carregado, atualizar };
}

export function useSegredos(mesaId: string, habilitado: boolean) {
  const { dados, carregado, atualizar } = useDocSincronizado<Segredos>(
    [COLECAO, mesaId, "segredos", "mestre"],
    SEGREDOS_VAZIOS,
    habilitado,
  );
  return { segredos: dados, carregado, atualizar };
}

// Diário privado do jogador: mesas/{id}/anotacoes/{uid}, uma nota por sessão.
// notasJogadores: o que o jogador junta sobre os outros (chave = Jogador.id).
export type Anotacoes = { notas: Record<string, string>; notasJogadores?: Record<string, string[] | string> };
const ANOTACOES_VAZIAS: Anotacoes = { notas: {}, notasJogadores: {} };

export function useAnotacoes(mesaId: string, usuarioUid: string, habilitado: boolean) {
  const { dados, carregado, atualizar } = useDocSincronizado<Anotacoes>(
    [COLECAO, mesaId, "anotacoes", usuarioUid],
    ANOTACOES_VAZIAS,
    habilitado,
  );
  return {
    notas: dados.notas,
    notasJogadores: dados.notasJogadores ?? {},
    carregado,
    definirNota: (sessaoId: string, texto: string) =>
      atualizar({ ...dados, notas: { ...dados.notas, [sessaoId]: texto } }),
    definirNotaJogador: (jogadorId: string, paginas: string[]) =>
      atualizar({ ...dados, notasJogadores: { ...dados.notasJogadores, [jogadorId]: paginas } }),
  };
}
