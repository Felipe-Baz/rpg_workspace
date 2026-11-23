"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { criarBroker } from "@/lib/extensoes/broker";
import { chamarIa } from "@/lib/ia-cliente";
import { salvarDadosExtensao, type ExtensaoMesa } from "@/lib/extensoes/dados";
import { MAX_GRAVACOES_JOGADOR_POR_MINUTO, assinarEstado, escoposGravaveis, type ContextoEstado, type Escopo } from "@/lib/extensoes/estado";
import { armazemFirestore } from "@/lib/extensoes/estado-firestore";
import { criarLimitador } from "@/lib/extensoes/eventos";
import type { Mesa } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import { toast } from "../ui/Toasts";
import { criarProponente, criarSolicitante } from "./proponente";
import Sandbox, { type AssinarEstado } from "./Sandbox";

/** Grava o estado da extensão (só o mestre) com debounce: ela pode chamar RPG.salvar a cada tecla. */
export function useSalvarDados(mesaId: string, extId: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return useCallback(
    (dados: unknown) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => salvarDadosExtensao(mesaId, extId, dados).catch((e) => toast(e instanceof Error ? e.message : "Não foi possível salvar.", "erro")),
        800,
      );
    },
    [mesaId, extId],
  );
}

/** Quem é quem para o estado por escopo: ids de jogador (o que a extensão vê) ↔ contas. */
export const jogadoresParaEstado = (mesa: Mesa) => mesa.jogadores.map((j) => ({ id: j.id, conta: j.uid, nome: j.personagem || j.nome }));
export const meuJogador = (mesa: Mesa, uid: string) => mesa.jogadores.find((j) => j.uid === uid)?.id ?? null;

/**
 * Tudo que uma extensão em execução precisa do app: o atendedor de pedidos (`RPG.ler/rolar/criar/estado`), as assinaturas
 * de estado em tempo real e o salvamento do estado compartilhado.
 * Mestre: criar abre a aprovação e grava em lote. Jogador: criar vira um PEDIDO que o mestre aprova depois.
 */
export function useExtensaoEmExecucao(ext: ExtensaoMesa, mestre: boolean) {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const papel = mestre ? "mestre" : "jogador";
  const salvar = useSalvarDados(mesa.id, ext.id);
  const aprovadas = useMemo(() => ext.permissoesAprovadas ?? [], [ext.permissoesAprovadas]);
  const chaveEscopos = (ext.estadoAprovado ?? []).join(",");
  const escopos = useMemo(() => (chaveEscopos ? (chaveEscopos.split(",") as Escopo[]) : []), [chaveEscopos]);
  const propor = useMemo(
    () => (mestre ? criarProponente({ mesa, uid, ext: { id: ext.id, titulo: ext.titulo } }) : criarSolicitante({ mesa, uid, ext: { id: ext.id, titulo: ext.titulo } })),
    [mesa, uid, mestre, ext.id, ext.titulo],
  );
  // IA: a chamada vai ao servidor, que confere a permissão aprovada, a visibilidade e o limite diário da mesa.
  const perguntar = useCallback((texto: string) => chamarIa<{ texto: string }>("extensao-llm", { corpo: { mesaId: mesa.id, extId: ext.id, texto } }), [mesa.id, ext.id]);
  const [limitador] = useState(() => criarLimitador(MAX_GRAVACOES_JOGADOR_POR_MINUTO));
  const estado = useMemo<ContextoEstado>(
    () => ({ papel, aprovados: escopos, jogadores: jogadoresParaEstado(mesa), minhaConta: uid, armazem: armazemFirestore(mesa.id, ext.id), podeGravar: () => limitador(ext.id, Date.now()) }),
    [papel, escopos, mesa, uid, ext.id, limitador],
  );
  const aoPedido = useMemo(() => criarBroker({ mesa, papel, uid, aprovadas, propor, perguntar, estado }), [mesa, papel, uid, aprovadas, propor, perguntar, estado]);
  const assinar = useCallback<AssinarEstado>((escopo, jogador, fn) => assinarEstado(estado, escopo, jogador, fn), [estado]);
  const gravaveis = useMemo(() => escoposGravaveis(escopos, papel), [escopos, papel]);
  return { aoPedido, salvar, aprovadas, assinar, gravaveis, eu: mestre ? null : meuJogador(mesa, uid) };
}

/** Uma extensão renderizada num iframe isolado. `altura` em px; sem ela, preenche o contêiner. */
export default function PainelExtensao({ ext, mesaId: _mesaId, mestre, altura, contexto }: { ext: ExtensaoMesa; mesaId: string; mestre: boolean; altura?: number; contexto?: unknown }) {
  void _mesaId;
  const { aoPedido, salvar, aprovadas, assinar, gravaveis, eu } = useExtensaoEmExecucao(ext, mestre);
  return (
    <div style={altura ? { height: altura } : undefined} className={altura ? "" : "h-full"}>
      <Sandbox html={ext.html} dadosJson={ext.dadosJson} somenteLeitura={!mestre} onSalvar={mestre ? salvar : undefined} aoPedido={aoPedido} permissoes={aprovadas} contexto={contexto} eu={eu} gravaveis={gravaveis} assinarEstado={assinar} titulo={ext.titulo} />
    </div>
  );
}
