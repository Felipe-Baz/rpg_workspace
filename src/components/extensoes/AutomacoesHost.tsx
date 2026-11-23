"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import type { ExtensaoMesa } from "@/lib/extensoes/dados";
import { criarLimitador, diffEstadoJogadores, diffFichas, diffJogadores, diffMissoes, diffRolagens, diffSessoes, escopoDoEvento, permissaoDoEvento, type EventoEmitido } from "@/lib/extensoes/eventos";
import { useEstadoExtensao } from "@/lib/extensoes/estado-firestore";
import { normalizarManifesto } from "@/lib/extensoes/manifesto";
import { useFichas } from "@/lib/fichas";
import { useMissoesMestre } from "@/lib/missoes";
import { usePersistido } from "@/lib/persistido";
import { useExtensoesContexto } from "../shell/ExtensoesContext";
import { useMesaAtual } from "../shell/MesaContext";
import { useExtensaoEmExecucao } from "./PainelExtensao";
import Sandbox from "./Sandbox";

type Enviar = (msg: unknown) => void;

/**
 * Automações: extensões que declararam eventos rodam "em segundo plano" (iframe sem tela) enquanto o mestre está com a mesa aberta
 * e recebem os eventos que detectamos por diferença nos dados. NADA roda com o app fechado, e nada roda para jogadores.
 * Criar algo continua exigindo a aprovação do mestre; eventos causados pela própria extensão não voltam para ela (sem laço).
 */
export default function AutomacoesHost() {
  const { extensoes } = useExtensoesContexto();
  const ativas = extensoes.filter((e) => normalizarManifesto(e.manifesto).eventos.length > 0);
  if (ativas.length === 0) return null;
  return <Automacoes ativas={ativas} />;
}

function Automacoes({ ativas }: { ativas: ExtensaoMesa[] }) {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const missoes = useMissoesMestre(mesa.id, true);
  const fichas = useFichas(mesa.id, uid, true, true);
  const [rolagens] = usePersistido<{ id: number; expressao: string; total: number; critico?: string }[]>(`dados:${mesa.id}`, []);

  const envios = useRef(new Map<string, Enviar>());
  const limite = useRef(criarLimitador());
  const registrar = useCallback((extId: string, enviar: Enviar | null) => {
    if (enviar) envios.current.set(extId, enviar);
    else envios.current.delete(extId);
  }, []);

  // Entrega o evento a cada extensão inscrita, com a permissão aprovada, fora do laço e dentro do limite de taxa.
  const emitir = useCallback(
    (e: EventoEmitido, soPara?: string) => {
      for (const ext of ativas) {
        if (soPara && ext.id !== soPara) continue;
        const m = normalizarManifesto(ext.manifesto);
        const precisa = permissaoDoEvento(e.evento);
        const escopo = escopoDoEvento(e.evento);
        if (!m.eventos.includes(e.evento)) continue;
        if (precisa && !(ext.permissoesAprovadas ?? []).includes(precisa)) continue;
        if (escopo && !(ext.estadoAprovado ?? []).includes(escopo)) continue;
        if (e.origemExtensao === ext.id) continue;
        if (!limite.current(ext.id, Date.now())) continue;
        envios.current.get(ext.id)?.({ rpg: "evento", evento: e.evento, dados: e.dados });
      }
    },
    [ativas],
  );

  // Cada fonte guarda o instantâneo anterior; a primeira leitura só serve de base (não dispara eventos).
  const antes = useRef<{ missoes: typeof missoes.missoes | null; fichas: typeof fichas.fichas | null; jogadores: typeof mesa.jogadores | null; sessoes: typeof mesa.sessoes | null; rolagens: Set<number> | null }>({ missoes: null, fichas: null, jogadores: null, sessoes: null, rolagens: null });

  useEffect(() => {
    if (!missoes.carregado) return;
    if (antes.current.missoes) diffMissoes(antes.current.missoes, missoes.missoes).forEach((e) => emitir(e));
    antes.current.missoes = missoes.missoes;
  }, [missoes.missoes, missoes.carregado, emitir]);

  useEffect(() => {
    if (!fichas.carregado) return;
    if (antes.current.fichas) diffFichas(antes.current.fichas, fichas.fichas as unknown as { id: string; categoria: string; nome: string; origem?: { extensao?: string } }[]).forEach((e) => emitir(e));
    antes.current.fichas = fichas.fichas;
  }, [fichas.fichas, fichas.carregado, emitir]);

  useEffect(() => {
    if (antes.current.jogadores) diffJogadores(antes.current.jogadores, mesa.jogadores).forEach((e) => emitir(e));
    antes.current.jogadores = mesa.jogadores;
  }, [mesa.jogadores, emitir]);

  useEffect(() => {
    if (antes.current.sessoes) diffSessoes(antes.current.sessoes, mesa.sessoes).forEach((e) => emitir(e));
    antes.current.sessoes = mesa.sessoes;
  }, [mesa.sessoes, emitir]);

  useEffect(() => {
    if (antes.current.rolagens) diffRolagens(antes.current.rolagens, rolagens).forEach((e) => emitir(e));
    antes.current.rolagens = new Set(rolagens.map((r) => r.id));
  }, [rolagens, emitir]);

  return (
    <div aria-hidden className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden">
      {ativas.map((e) => (
        <Instancia key={e.id} ext={e} registrar={registrar} />
      ))}
      {ativas
        .filter((e) => normalizarManifesto(e.manifesto).eventos.includes("estado.jogadorSalvou") && (e.estadoAprovado ?? []).includes("doJogador"))
        .map((e) => (
          <ObservadorEstado key={`estado:${e.id}`} ext={e} emitir={emitir} />
        ))}
    </div>
  );
}

// Uma instância sem tela da extensão, com os mesmos poderes (e limites) da tela normal do mestre.
function Instancia({ ext, registrar }: { ext: ExtensaoMesa; registrar: (extId: string, enviar: Enviar | null) => void }) {
  const { aoPedido, salvar, aprovadas, assinar, gravaveis } = useExtensaoEmExecucao(ext, true);
  const aoRegistrar = useMemo(() => (enviar: Enviar | null) => registrar(ext.id, enviar), [registrar, ext.id]);
  return <Sandbox html={ext.html} dadosJson={ext.dadosJson} somenteLeitura={false} onSalvar={salvar} aoPedido={aoPedido} permissoes={aprovadas} gravaveis={gravaveis} assinarEstado={assinar} segundoPlano registrarEnvio={aoRegistrar} titulo={`${ext.titulo} (automação)`} className="h-px w-px" />;
}

// Observa as gravações dos jogadores (escopo doJogador) de UMA extensão e emite `estado.jogadorSalvou` só para ela.
// A primeira leitura é só base: abrir a mesa não dispara eventos pelo que foi gravado enquanto o mestre estava fora.
function ObservadorEstado({ ext, emitir }: { ext: ExtensaoMesa; emitir: (e: EventoEmitido, soPara?: string) => void }) {
  const mesa = useMesaAtual();
  const { itens, carregado } = useEstadoExtensao(mesa.id, ext.id);
  const antes = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    if (!carregado) return;
    const depois = new Map(itens.filter((i) => i.escopo === "doJogador" && i.uid).map((i) => [i.uid!, i.atualizadoEm]));
    diffEstadoJogadores(antes.current, depois, mesa.jogadores).forEach((e) => emitir(e, ext.id));
    antes.current = depois;
  }, [itens, carregado, mesa.jogadores, emitir, ext.id]);
  return null;
}
