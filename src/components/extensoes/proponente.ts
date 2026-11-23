"use client";

import type { Acao } from "@/lib/extensoes/acoes";
import { resumirAcoes } from "@/lib/extensoes/acoes";
import type { Proponente } from "@/lib/extensoes/broker-puro";
import { executarLote } from "@/lib/extensoes/escrita";
import { enviarPedido } from "@/lib/extensoes/pedidos";
import type { Mesa } from "@/lib/mesas";
import { confirmar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";

// Uma proposta de cada vez: a tela de aprovação é única, então pedidos simultâneos esperam a vez.
let fila: Promise<unknown> = Promise.resolve();

/**
 * Cria o "proponente" de uma extensão: mostra ao mestre o que será criado, e só grava se ele aprovar.
 * No ensaio (prévia do criador) a aprovação é pedida do mesmo jeito, mas nada é gravado.
 */
export function criarProponente(opcoes: { mesa: Mesa; uid: string; ext: { id: string; titulo: string }; ensaio?: boolean; aoRegistrar?: (detalhe: string, ok: boolean) => void }): Proponente {
  const { mesa, uid, ext, ensaio } = opcoes;
  const nomes = Object.fromEntries(mesa.jogadores.map((j) => [j.id, j.personagem || j.nome || "jogador"]));

  return (acoes: Acao[]) => {
    const vez = fila.then(async () => {
      const aprovado = await confirmar({
        titulo: ensaio ? `Ensaio: “${ext.titulo}” quer criar conteúdo` : `“${ext.titulo}” quer criar conteúdo`,
        texto: `${resumirAcoes(acoes, nomes)}${ensaio ? "\n\nEnsaio: nada será gravado de verdade." : ""}`,
        confirmar: ensaio ? "Simular" : "Aprovar e criar",
      });
      if (!aprovado) {
        opcoes.aoRegistrar?.("o mestre recusou", false);
        throw new Error("O mestre recusou a criação.");
      }
      const r = await executarLote({ mesa, uid, ext, acoes, ensaio });
      opcoes.aoRegistrar?.(`${r.criados.length} item(ns) ${ensaio ? "simulados" : "criados"}`, true);
      toast(ensaio ? `Ensaio: ${r.criados.length} item(ns) simulados` : `${r.criados.length} item(ns) criado(s). Dá para desfazer na tela da extensão.`);
      return r;
    });
    fila = vez.catch(() => undefined);
    return vez;
  };
}

/**
 * Jogador: criar não grava nada. Envia um PEDIDO ao mestre (que revê e aprova) e resolve na hora com `{ pedido, status }`.
 * No ensaio (prévia "ver como jogador") nada é enviado.
 */
export function criarSolicitante(opcoes: { mesa: Mesa; uid: string; ext: { id: string; titulo: string }; ensaio?: boolean }): Proponente {
  const { mesa, uid, ext, ensaio } = opcoes;
  const nome = mesa.jogadores.find((j) => j.uid === uid)?.personagem || mesa.jogadores.find((j) => j.uid === uid)?.nome || "Jogador";
  return async (acoes: Acao[]) => {
    if (ensaio) { toast("Ensaio: o pedido seria enviado ao mestre."); return { pedido: "ensaio", status: "pendente" }; }
    const r = await enviarPedido({ mesaId: mesa.id, extId: ext.id, extTitulo: ext.titulo, uid, nome, acoes });
    toast("Pedido enviado ao mestre. Você será avisado da resposta.");
    return r;
  };
}
