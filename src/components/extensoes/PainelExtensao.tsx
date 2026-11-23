"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { criarBroker } from "@/lib/extensoes/broker";
import { salvarDadosExtensao, type ExtensaoMesa } from "@/lib/extensoes/dados";
import { useMesaAtual } from "../shell/MesaContext";
import { toast } from "../ui/Toasts";
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

/** Uma extensão renderizada num iframe isolado. `altura` em px; sem ela, preenche o contêiner. */
export default function PainelExtensao({ ext, mesaId, mestre, altura }: { ext: ExtensaoMesa; mesaId: string; mestre: boolean; altura?: number }) {
  const salvar = useSalvarDados(mesaId, ext.id);
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const aprovadas = useMemo(() => ext.permissoesAprovadas ?? [], [ext.permissoesAprovadas]);
  // Atende RPG.ler/RPG.rolar com as credenciais de quem está usando e só o que o mestre aprovou.
  const aoPedido = useMemo(() => criarBroker({ mesa, papel: mestre ? "mestre" : "jogador", uid: user?.uid ?? "", aprovadas }), [mesa, mestre, user?.uid, aprovadas]);
  return (
    <div style={altura ? { height: altura } : undefined} className={altura ? "" : "h-full"}>
      <Sandbox html={ext.html} dadosJson={ext.dadosJson} somenteLeitura={!mestre} onSalvar={mestre ? salvar : undefined} aoPedido={aoPedido} permissoes={aprovadas} titulo={ext.titulo} />
    </div>
  );
}
