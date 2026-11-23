"use client";

// Pedidos de jogadores: o jogador usa uma extensão que "cria" algo e, em vez de gravar, envia um PEDIDO.
// O mestre revê o resumo e aprova (executa como lote dele, desfazível) ou recusa. O jogador é avisado do resultado.

import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { uid as novoId, type Mesa } from "../mesas";
import { validarAcoes, type Acao } from "./acoes";
import { useLista } from "./dados";
import { prepararLote, type LotePreparado } from "./escrita";

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
  /** Por que foi recusado automaticamente (ex.: o item a alterar não existe mais). */
  motivo?: string;
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

/**
 * Mestre vai aprovar: revalida (o documento do jogador não é confiável) e monta o lote contra os dados ATUAIS, para a tela
 * mostrar o "antes → depois" de agora. Se algo deixou de existir (ex.: a ficha foi apagada), o pedido é recusado com o motivo
 * e o jogador é avisado.
 */
export async function prepararPedido(mesa: Mesa, uidMestre: string, p: PedidoJogador): Promise<LotePreparado | null> {
  const acoes = validarAcoes(p.acoes);
  if (!acoes) throw new Error("Este pedido tem dados inválidos e não pode ser aprovado. Recuse-o.");
  try {
    return await prepararLote({ mesa, uid: uidMestre, ext: { id: p.extId, titulo: p.extTitulo }, acoes });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "O pedido não vale mais.";
    await updateDoc(doc(col(mesa.id), p.id), { status: "recusado", resolvidoEm: Date.now(), motivo: motivo.slice(0, 200) });
    throw new Error(`Pedido recusado automaticamente: ${motivo}`);
  }
}

/** Grava o lote já preparado (e aprovado pelo mestre) e marca o pedido. */
export async function concluirPedido(mesaId: string, p: PedidoJogador, preparado: LotePreparado): Promise<void> {
  const r = await preparado.executar();
  await updateDoc(doc(col(mesaId), p.id), { status: "aprovado", resolvidoEm: Date.now(), lote: r.lote });
}

/** Aprova sem tela (atalho): prepara e grava. */
export async function aprovarPedido(mesa: Mesa, uidMestre: string, p: PedidoJogador): Promise<void> {
  const prep = await prepararPedido(mesa, uidMestre, p);
  if (prep) await concluirPedido(mesa.id, p, prep);
}

export const recusarPedido = (mesaId: string, id: string) => updateDoc(doc(col(mesaId), id), { status: "recusado", resolvidoEm: Date.now() });
