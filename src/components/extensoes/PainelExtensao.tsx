"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { criarBroker } from "@/lib/extensoes/broker";
import { chamarIa } from "@/lib/ia-cliente";
import { salvarDadosExtensao, type ExtensaoMesa } from "@/lib/extensoes/dados";
import { useMesaAtual } from "../shell/MesaContext";
import { toast } from "../ui/Toasts";
import { criarProponente, criarSolicitante } from "./proponente";
import Sandbox from "./Sandbox";

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

/**
 * Tudo que uma extensão em execução precisa do app: o atendedor de pedidos (`RPG.ler/rolar/criar`) e o salvamento de estado.
 * Mestre: criar abre a aprovação e grava em lote. Jogador: criar vira um PEDIDO que o mestre aprova depois.
 */
export function useExtensaoEmExecucao(ext: ExtensaoMesa, mestre: boolean) {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const salvar = useSalvarDados(mesa.id, ext.id);
  const aprovadas = useMemo(() => ext.permissoesAprovadas ?? [], [ext.permissoesAprovadas]);
  const propor = useMemo(
    () => (mestre ? criarProponente({ mesa, uid, ext: { id: ext.id, titulo: ext.titulo } }) : criarSolicitante({ mesa, uid, ext: { id: ext.id, titulo: ext.titulo } })),
    [mesa, uid, mestre, ext.id, ext.titulo],
  );
  // IA: a chamada vai ao servidor, que confere a permissão aprovada, a visibilidade e o limite diário da mesa.
  const perguntar = useCallback((texto: string) => chamarIa<{ texto: string }>("extensao-llm", { corpo: { mesaId: mesa.id, extId: ext.id, texto } }), [mesa.id, ext.id]);
  const aoPedido = useMemo(() => criarBroker({ mesa, papel: mestre ? "mestre" : "jogador", uid, aprovadas, propor, perguntar }), [mesa, mestre, uid, aprovadas, propor, perguntar]);
  return { aoPedido, salvar, aprovadas };
}

/** Uma extensão renderizada num iframe isolado. `altura` em px; sem ela, preenche o contêiner. */
export default function PainelExtensao({ ext, mesaId: _mesaId, mestre, altura, contexto }: { ext: ExtensaoMesa; mesaId: string; mestre: boolean; altura?: number; contexto?: unknown }) {
  void _mesaId;
  const { aoPedido, salvar, aprovadas } = useExtensaoEmExecucao(ext, mestre);
  return (
    <div style={altura ? { height: altura } : undefined} className={altura ? "" : "h-full"}>
      <Sandbox html={ext.html} dadosJson={ext.dadosJson} somenteLeitura={!mestre} onSalvar={mestre ? salvar : undefined} aoPedido={aoPedido} permissoes={aprovadas} contexto={contexto} titulo={ext.titulo} />
    </div>
  );
}
