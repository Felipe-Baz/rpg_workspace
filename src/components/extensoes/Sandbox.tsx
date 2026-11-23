"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { validarPedido, type Pedido } from "@/lib/extensoes/capacidades";
import { MAX_DADOS, montarDocumento, type TemaExtensao } from "@/lib/extensoes/documento";
import { validarPedidoEstado, type Escopo } from "@/lib/extensoes/estado";

/** Assina um escopo em tempo real (`RPG.estado.aoMudar`). Devolve quem cancela. O app valida papel e aprovação. */
export type AssinarEstado = (escopo: Escopo, jogador: string | null, aoMudar: (dados: unknown) => void) => () => void;
const MAX_ASSINATURAS = 20;

// Variáveis de tema repassadas à extensão (ela as usa como var(--accent) etc.).
const VARS = ["--background", "--surface", "--foreground", "--muted", "--accent", "--accent-hover", "--gold", "--border", "--ok", "--warn", "--danger"];
const PEDIDOS_POR_SEGUNDO = 20;

function assinarTema(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => o.disconnect();
}

function lerTema(): TemaExtensao {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(v).trim()]).filter(([, v]) => v));
}

/**
 * Executa o HTML de uma extensão num iframe isolado: sandbox="allow-scripts" (sem allow-same-origin),
 * CSP sem rede e comunicação só por postMessage. A extensão não alcança cookies, storage, Firebase nem o app:
 * para ler dados da mesa ela pede ao app (`aoPedido`), que confere a permissão aprovada pelo mestre.
 */
export default function Sandbox({
  html,
  dadosJson = "",
  somenteLeitura,
  onSalvar,
  aoPedido,
  permissoes = [],
  contexto = null,
  registrarEnvio,
  segundoPlano = false,
  eu = null,
  gravaveis,
  assinarEstado,
  titulo,
  className = "",
}: {
  html: string;
  dadosJson?: string;
  somenteLeitura: boolean;
  onSalvar?: (dados: unknown) => void;
  /** Atende `RPG.ler(...)`/`RPG.rolar(...)`. Sem isso a extensão não consegue ler nada. */
  aoPedido?: (pedido: Pedido) => Promise<unknown>;
  /** Permissões aprovadas (apenas informativas para a extensão: `RPG.permissoes`). */
  permissoes?: readonly string[];
  /** Recebe uma função para enviar mensagens ao iframe (eventos da mesa). Chamada com `null` ao desmontar. */
  registrarEnvio?: (enviar: ((msg: unknown) => void) | null) => void;
  /** Roda sem tela, só para ouvir eventos (automação). */
  segundoPlano?: boolean;
  /** Onde a extensão foi aberta (missão, ficha): vira window.RPG.contexto. */
  contexto?: unknown;
  /** Id de jogador de quem usa (`RPG.eu`); null para o mestre. */
  eu?: string | null;
  /** Escopos que quem usa pode gravar (`RPG.podeSalvar`). */
  gravaveis?: readonly string[];
  /** Atende `RPG.estado.aoMudar`. Sem isso, as assinaturas são ignoradas. */
  assinarEstado?: AssinarEstado;
  titulo: string;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const tema = useSyncExternalStore(assinarTema, () => document.documentElement.dataset.theme ?? "dark", () => "dark");
  const chavePermissoes = permissoes.join(",");
  const chaveContexto = JSON.stringify(contexto ?? null);
  const chaveGravaveis = (gravaveis ?? []).join(",");
  const temGravaveis = gravaveis !== undefined;

  // O estado inicial entra só quando o documento é (re)montado; salvar não recarrega o iframe.
  const dadosRef = useRef(dadosJson);
  useEffect(() => { dadosRef.current = dadosJson; });

  const doc = useMemo(() => {
    let dados: unknown = null;
    try { dados = dadosRef.current ? JSON.parse(dadosRef.current) : null; } catch {}
    void tema; // recalcula quando o tema muda
    return montarDocumento(html, { tema: lerTema(), dados, somenteLeitura, permissoes: chavePermissoes ? chavePermissoes.split(",") : [], contexto: JSON.parse(chaveContexto), segundoPlano, eu, gravaveis: temGravaveis ? (chaveGravaveis ? chaveGravaveis.split(",") : []) : undefined });
  }, [html, tema, somenteLeitura, chavePermissoes, chaveContexto, segundoPlano, eu, chaveGravaveis, temGravaveis]);

  // Assinaturas em tempo real (RPG.estado.aoMudar): valem enquanto o documento atual existir.
  const assinarRef = useRef(assinarEstado);
  useEffect(() => { assinarRef.current = assinarEstado; });
  useEffect(() => {
    const canceladores: (() => void)[] = [];
    function ao(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data as { rpg?: string; sid?: unknown; escopo?: unknown; jogador?: unknown } | null;
      if (d?.rpg !== "assinar" || typeof d.sid !== "number" || !assinarRef.current || canceladores.length >= MAX_ASSINATURAS) return;
      const p = validarPedidoEstado("assinar", { escopo: d.escopo, jogador: d.jogador });
      if (!p) return;
      const sid = d.sid;
      try {
        canceladores.push(assinarRef.current(p.escopo, p.jogador, (dados) => ref.current?.contentWindow?.postMessage({ rpg: "estado", sid, dados }, "*")));
      } catch (erro) {
        console.warn("extensão: assinatura recusada:", erro instanceof Error ? erro.message : erro);
      }
    }
    window.addEventListener("message", ao);
    return () => { window.removeEventListener("message", ao); canceladores.forEach((c) => c()); };
  }, [doc]);

  useEffect(() => {
    if (!registrarEnvio) return;
    registrarEnvio((msg) => ref.current?.contentWindow?.postMessage(msg, "*"));
    return () => registrarEnvio(null);
  }, [registrarEnvio, doc]);

  // Mensagens do iframe: salvar estado (mestre) e pedidos de dados (com limite de taxa).
  useEffect(() => {
    let janela = 0;
    let contagem = 0;

    function responder(id: number, corpo: { ok: true; dados: unknown } | { ok: false; erro: string }) {
      ref.current?.contentWindow?.postMessage({ rpg: "resposta", id, ...corpo }, "*");
    }

    function ao(e: MessageEvent) {
      if (e.source !== ref.current?.contentWindow) return; // só o nosso iframe
      const d = e.data as { rpg?: string; dados?: unknown } | null;

      if (d?.rpg === "salvar") {
        if (!onSalvar || somenteLeitura) return;
        if (JSON.stringify(d.dados ?? null).length > MAX_DADOS) return;
        onSalvar(d.dados);
        return;
      }

      if (d?.rpg === "pedido") {
        const pedido = validarPedido(d);
        const idBruto = (d as { id?: unknown }).id;
        const id = typeof idBruto === "number" ? idBruto : 0;
        if (!pedido) return responder(id, { ok: false, erro: "Pedido inválido." });
        if (!aoPedido) return responder(id, { ok: false, erro: "Esta extensão não tem acesso a dados da mesa." });
        const agora = Math.floor(Date.now() / 1000);
        if (agora !== janela) { janela = agora; contagem = 0; }
        if (++contagem > PEDIDOS_POR_SEGUNDO) return responder(id, { ok: false, erro: "Muitas chamadas por segundo. Aguarde um instante." });
        aoPedido(pedido).then(
          (dados) => responder(pedido.id, { ok: true, dados }),
          (erro) => responder(pedido.id, { ok: false, erro: erro instanceof Error ? erro.message : "Falha ao atender o pedido." }),
        );
      }
    }
    window.addEventListener("message", ao);
    return () => window.removeEventListener("message", ao);
  }, [onSalvar, somenteLeitura, aoPedido]);

  return (
    <iframe
      ref={ref}
      title={titulo}
      srcDoc={doc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={`h-full w-full rounded-xl border border-border bg-background ${className}`}
    />
  );
}
