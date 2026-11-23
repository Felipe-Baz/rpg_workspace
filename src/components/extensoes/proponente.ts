"use client";

import type { Acao } from "@/lib/extensoes/acoes";
import { ehCriacao } from "@/lib/extensoes/acoes";
import type { Proponente } from "@/lib/extensoes/broker-puro";
import { prepararLote } from "@/lib/extensoes/escrita";
import { enviarPedido } from "@/lib/extensoes/pedidos";
import type { Mesa } from "@/lib/mesas";
import { confirmar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";

// Uma proposta de cada vez: a tela de aprovação é única, então pedidos simultâneos esperam a vez.
let fila: Promise<unknown> = Promise.resolve();

/**
 * Cria o "proponente" de uma extensão: mostra ao mestre o que será criado, alterado ou apagado (com o antes → depois,
 * lido na hora) e só grava se ele aprovar. No ensaio (prévia do criador) a aprovação é pedida do mesmo jeito, mas nada é
 * gravado; com `exemplo`, alterar/excluir atuam sobre os itens fictícios do ensaio.
 */
export function criarProponente(opcoes: { mesa: Mesa; uid: string; ext: { id: string; titulo: string }; ensaio?: boolean; exemplo?: boolean; aoRegistrar?: (detalhe: string, ok: boolean) => void }): Proponente {
  const { mesa, uid, ext, ensaio, exemplo } = opcoes;

  return (acoes: Acao[]) => {
    const vez = fila.then(async () => {
      const prep = await prepararLote({ mesa, uid, ext, acoes, ensaio, exemplo });
      const soCria = acoes.every(ehCriacao);
      const avisos = prep.montado.avisos.length ? `\n\nAvisos:\n${prep.montado.avisos.map((a) => `• ${a}`).join("\n")}` : "";
      const aprovado = await confirmar({
        perigo: prep.montado.excluir.length > 0,
        titulo: `${ensaio ? "Ensaio: " : ""}“${ext.titulo}” quer ${soCria ? "criar conteúdo" : "mudar a mesa"}`,
        texto: `${prep.montado.resumo}${avisos}${ensaio ? "\n\nEnsaio: nada será gravado de verdade." : ""}`,
        confirmar: ensaio ? "Simular" : soCria ? "Aprovar e criar" : "Aprovar",
      });
      if (!aprovado) {
        opcoes.aoRegistrar?.("o mestre recusou", false);
        throw new Error("O mestre recusou.");
      }
      const r = await prep.executar();
      const n = r.criados.length + r.alterados.length + r.excluidos.length;
      opcoes.aoRegistrar?.(`${n} item(ns) ${ensaio ? "simulados" : "gravados"}`, true);
      toast(ensaio ? `Ensaio: ${n} item(ns) simulados` : `${n} item(ns) gravado(s). Dá para desfazer na tela da extensão.`);
      return r;
    });
    fila = vez.catch(() => undefined);
    return vez;
  };
}

/**
 * Jogador: criar/alterar/excluir não grava nada. Envia um PEDIDO ao mestre (que revê e aprova) e resolve na hora com
 * `{ pedido, status }`. No ensaio (prévia "ver como jogador") nada é enviado.
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
