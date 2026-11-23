"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { MAX_DADOS, validarTitulo } from "./documento";
import type { Permissao } from "./capacidades";
import type { ConfigNativas } from "./nativas";
import type { Manifesto } from "./manifesto";
import type { MensagemChat } from "./prompt";

// Biblioteca do mestre: extensoes/{id} com donoUid (privada; reaproveitável em várias mesas).
// Não fica em usuarios/{uid}/..., área que o cliente nunca acessa (guarda as chaves de IA).
export type ExtensaoBiblioteca = {
  id: string;
  donoUid: string;
  titulo: string;
  descricao: string;
  html: string;
  conversa: MensagemChat[];
  manifesto?: Manifesto; // onde aparece no app; ausente = só a sidebar
  criadoEm: number;
  atualizadoEm: number;
  arquivada: boolean;
};

// Instalação numa mesa: mesas/{mesaId}/extensoes/{id}. É uma CÓPIA do documento (jogadores não leem a biblioteca).
export type ExtensaoMesa = {
  id: string;
  titulo: string;
  html: string;
  visivelJogadores: boolean;
  manifesto?: Manifesto;
  /** O que o MESTRE aprovou ler (o manifesto só diz o que a extensão pede). */
  permissoesAprovadas?: Permissao[];
  dadosJson: string; // estado que a extensão salvou via window.RPG.salvar (JSON em texto)
  publicadaEm: number;
  atualizadaEm: number;
};

const colBiblioteca = () => collection(db, "extensoes");
const colMesa = (mesaId: string) => collection(db, "mesas", mesaId, "extensoes");

function useLista<T>(consulta: (() => ReturnType<typeof query>) | null, chave: string) {
  const [estado, setEstado] = useState<{ chave: string; itens: T[] } | null>(null);
  useEffect(() => {
    if (!consulta) return;
    return onSnapshot(
      consulta(),
      (snap) => setEstado({ chave, itens: snap.docs.map((d) => d.data() as T) }),
      (e) => {
        console.error("extensoes:", e);
        setEstado({ chave, itens: [] });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const pronto = estado?.chave === chave;
  return { itens: pronto ? estado.itens : ([] as T[]), carregado: !consulta || pronto };
}

export function useBiblioteca(uid: string) {
  const { itens, carregado } = useLista<ExtensaoBiblioteca>(uid ? () => query(colBiblioteca(), where("donoUid", "==", uid)) : null, `bib:${uid}`);
  return { extensoes: [...itens].sort((a, b) => b.atualizadoEm - a.atualizadoEm), carregado };
}

/** Mestre vê todas as instaladas; jogador só as marcadas como visíveis. */
export function useExtensoesMesa(mesaId: string, comoMestre: boolean, habilitado = true) {
  const { itens, carregado } = useLista<ExtensaoMesa>(
    habilitado && mesaId ? () => (comoMestre ? query(colMesa(mesaId)) : query(colMesa(mesaId), where("visivelJogadores", "==", true))) : null,
    `mesa:${mesaId}:${comoMestre}:${habilitado}`,
  );
  return { extensoes: [...itens].sort((a, b) => a.publicadaEm - b.publicadaEm), carregado };
}

export async function salvarNaBiblioteca(uid: string, e: Omit<ExtensaoBiblioteca, "atualizadoEm"> & { atualizadoEm?: number }) {
  const doc_: ExtensaoBiblioteca = { ...e, titulo: validarTitulo(e.titulo) || "Extensão sem nome", atualizadoEm: Date.now() };
  await setDoc(doc(colBiblioteca(), e.id), doc_);
  return doc_;
}

export const arquivarExtensao = (id: string, arquivada: boolean) => updateDoc(doc(colBiblioteca(), id), { arquivada, atualizadoEm: Date.now() });
export const excluirDaBiblioteca = (id: string) => deleteDoc(doc(colBiblioteca(), id));

/** Instala (ou atualiza) a extensão na mesa. Reinstalar preserva o estado salvo e a visibilidade. */
export async function publicarNaMesa(mesaId: string, e: { id: string; titulo: string; html: string; manifesto?: Manifesto; permissoesAprovadas?: Permissao[] }, existente?: ExtensaoMesa) {
  const agora = Date.now();
  const base = { id: e.id, titulo: validarTitulo(e.titulo) || "Extensão sem nome", html: e.html, ...(e.manifesto ? { manifesto: e.manifesto } : {}), ...(e.permissoesAprovadas ? { permissoesAprovadas: e.permissoesAprovadas } : {}), atualizadaEm: agora };
  await setDoc(
    doc(colMesa(mesaId), e.id),
    existente ? { ...base } : { ...base, visivelJogadores: false, dadosJson: "", publicadaEm: agora },
    { merge: true },
  );
}

export const removerDaMesa = (mesaId: string, id: string) => deleteDoc(doc(colMesa(mesaId), id));
export const definirVisibilidade = (mesaId: string, id: string, visivelJogadores: boolean) => updateDoc(doc(colMesa(mesaId), id), { visivelJogadores });

/** Estado da extensão (só o mestre grava). Rejeita acima do limite. */
export async function salvarDadosExtensao(mesaId: string, id: string, dados: unknown) {
  const json = JSON.stringify(dados ?? null);
  if (json.length > MAX_DADOS) throw new Error("A extensão tentou guardar mais de 50 KB de dados.");
  await updateDoc(doc(colMesa(mesaId), id), { dadosJson: json });
}

// Configuração das extensões nativas por mesa (ex.: liberar as Marcas de Pacto aos jogadores).
export function useNativasMesa(mesaId: string, habilitado = true) {
  const { itens, carregado } = useLista<{ id: string; visivelJogadores: boolean }>(
    habilitado && mesaId ? () => query(collection(db, "mesas", mesaId, "extensoesNativas")) : null,
    `nativas:${mesaId}:${habilitado}`,
  );
  const config: ConfigNativas = Object.fromEntries(itens.map((c) => [c.id, { visivelJogadores: c.visivelJogadores === true }]));
  return { config, carregado };
}

export const definirVisibilidadeNativa = (mesaId: string, id: string, visivelJogadores: boolean) =>
  setDoc(doc(db, "mesas", mesaId, "extensoesNativas", id), { id, visivelJogadores }, { merge: true });
