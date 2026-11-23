"use client";

// Pedidos de jogadores: o jogador usa uma extensão que "cria" algo e, em vez de gravar, envia um PEDIDO.
// O mestre revê o resumo e aprova (executa como lote dele, desfazível) ou recusa. O jogador é avisado do resultado.

import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { uid as novoId, type Mesa } from "../mesas";
import { validarAcoes, type Acao } from "./acoes";
import { useLista } from "./dados";
import { executarLote } from "./escrita";

export type StatusPedido = "pendente" | "aprovado" | "recusado";

export type PedidoJogador = {
  id: string;
  extId: string;
  extTitulo: string;
  de: string; // uid do jogador
  nome: string; // personagem ou nome, para o mestre reconhecer
  acoes: Acao[];
  criadoEm: number;
  status: StatusPedido;
  resolvidoEm: number | null;
  lote: string | null;
};

export const MAX_PENDENTES_POR_JOGADOR = 5;
const col = (mesaId: string) => collection(db, "mesas", mesaId, "extensoesPedidos");

/** Jogador: envia o pedido. Limita quantos ficam pendentes para uma conta não inundar o mestre. */
export async function enviarPedido(e: { mesaId: string; extId: string; extTitulo: string; uid: string; nome: string; acoes: Acao[] }): Promise<{ pedido: string; status: "pendente" }> {
  const pendentes = await getDocs(query(col(e.mesaId), where("de", "==", e.uid), where("status", "==", "pendente")));
  if (pendentes.size >= MAX_PENDENTES_POR_JOGADOR) throw new Error(`Você já tem ${MAX_PENDENTES_POR_JOGADOR} pedidos aguardando o mestre. Espere ele responder.`);
  const pedido: PedidoJogador = { id: novoId(), extId: e.extId, extTitulo: e.extTitulo, de: e.uid, nome: e.nome, acoes: e.acoes, criadoEm: Date.now(), status: "pendente", resolvidoEm: null, lote: null };
  await setDoc(doc(col(e.mesaId), pedido.id), pedido);
  return { pedido: pedido.id, status: "pendente" };
}

export function usePedidosMestre(mesaId: string, habilitado: boolean) {
  const { itens, carregado } = useLista<PedidoJogador>(habilitado && mesaId ? () => query(col(mesaId)) : null, `pedidos:${mesaId}:${habilitado}`);
  return { pedidos: [...itens].sort((a, b) => b.criadoEm - a.criadoEm), carregado };
}

export function useMeusPedidos(mesaId: string, uid: string, habilitado: boolean) {
  const { itens, carregado } = useLista<PedidoJogador>(habilitado && mesaId && uid ? () => query(col(mesaId), where("de", "==", uid)) : null, `meus-pedidos:${mesaId}:${uid}:${habilitado}`);
  return { pedidos: itens, carregado };
}

/** Mestre aprova: revalida (o documento do jogador não é confiável), executa como lote dele e marca o pedido. */
export async function aprovarPedido(mesa: Mesa, uidMestre: string, p: PedidoJogador): Promise<void> {
  const acoes = validarAcoes(p.acoes);
  if (!acoes) throw new Error("Este pedido tem dados inválidos e não pode ser aprovado. Recuse-o.");
  const r = await executarLote({ mesa, uid: uidMestre, ext: { id: p.extId, titulo: p.extTitulo }, acoes });
  await updateDoc(doc(col(mesa.id), p.id), { status: "aprovado", resolvidoEm: Date.now(), lote: r.lote });
}

export const recusarPedido = (mesaId: string, id: string) => updateDoc(doc(col(mesaId), id), { status: "recusado", resolvidoEm: Date.now() });
