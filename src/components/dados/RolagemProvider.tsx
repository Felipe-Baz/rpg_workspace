"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { Mesa } from "@/lib/mesas";
import type { Rolagem } from "@/lib/dados";
import { sortearRolagem } from "@/lib/dados3d";
import { IDADE_MAX_ANIMACAO_MS, MAX_HISTORICO, assinarRolagens, publicarRolagem, type RolagemMesa } from "@/lib/rolagens";
import { precarregarSom, tocarLancamento } from "@/lib/som-dados";
import type { CenaDados } from "@/lib/cena-dados";

type Ctx = {
  /** Rola uma expressão ("d20", "2d6+3", "1d120"…): joga os dados 3D na tela de todos os online e devolve o resultado quando eles param. */
  rolar: (expressao: string, rotulo?: string) => Promise<Rolagem | null>;
  /** Últimas rolagens da mesa (de todos), da mais nova para a mais antiga. */
  historico: RolagemMesa[];
  /** true enquanto os dados estão na tela. */
  rolando: boolean;
};

const semProvider: Ctx = { rolar: async (e) => sortearRolagem(e)?.rolagem ?? null, historico: [], rolando: false };
const RolagemCtx = createContext<Ctx>(semProvider);

/** Único ponto de rolagem do site. Fora de uma mesa (sem provider) devolve o número sem animação. */
export const useRolagem = () => useContext(RolagemCtx);

const ESPERA_RESULTADO_MS = 2400;
const SAIDA_MS = 500;
const dorme = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function RolagemProvider({ mesa, children }: { mesa: Mesa; children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const mesaId = mesa.id;
  const nome = useMemo(() => {
    if (uid && mesa.donoUid === uid) return "Mestre";
    return mesa.jogadores.find((j) => j.uid === uid)?.personagem || user?.displayName || user?.email?.split("@")[0] || "Alguém";
  }, [mesa.donoUid, mesa.jogadores, uid, user?.displayName, user?.email]);

  const [historicoBruto, setHistorico] = useState<RolagemMesa[]>([]);
  // Rolagens ainda na tela: ficam fora do histórico até os dados pararem (senão o resultado vaza antes da animação).
  const [naTela, setNaTela] = useState<ReadonlySet<string>>(new Set());
  const [exibido, setExibido] = useState<RolagemMesa | null>(null); // rolagem em cena (dados + resultado)
  const [resultado, setResultado] = useState(false); // dados já pararam: mostra o total
  const [visivel, setVisivel] = useState(false);

  const canvas = useRef<HTMLCanvasElement>(null);
  const cena = useRef<CenaDados | null>(null);
  const fila = useRef<Promise<void>>(Promise.resolve());
  const vivo = useRef(true);

  const obterCena = useCallback(async (): Promise<CenaDados | null> => {
    if (cena.current) return cena.current;
    if (!canvas.current) return null;
    try {
      const { CenaDados } = await import("@/lib/cena-dados");
      if (!vivo.current) return null;
      cena.current ??= new CenaDados(canvas.current);
      return cena.current;
    } catch (e) {
      console.warn("Dados 3D indisponíveis (WebGL?). Mostrando só o resultado.", e);
      return null;
    }
  }, []);

  /** Encena uma rolagem (uma de cada vez). */
  const encenar = useCallback((r: RolagemMesa): Promise<void> => {
    setNaTela((s) => new Set(s).add(r.id));
    const passo = async () => {
      setExibido(r);
      setResultado(false);
      setVisivel(true);
      const c = r.jogada && !reduzMovimento() ? await obterCena() : null;
      if (c && r.jogada) {
        tocarLancamento();
        await c.jogar(r.jogada); // a duração vem da simulação física (até os dados pararem)
      }
      setResultado(true);
      await dorme(ESPERA_RESULTADO_MS);
      setVisivel(false);
      await dorme(SAIDA_MS);
      cena.current?.limpar();
      setExibido(null);
      setResultado(false);
    };
    const comFim = () => passo().finally(() => setNaTela((s) => { const n = new Set(s); n.delete(r.id); return n; }));
    const p = fila.current.then(comFim, comFim);
    fila.current = p.catch(() => {});
    return p;
  }, [obterCena]);

  const rolar = useCallback(
    async (expressao: string, rotulo?: string): Promise<Rolagem | null> => {
      const plano = sortearRolagem(expressao);
      if (!plano) return null;
      const r: RolagemMesa = { id: crypto.randomUUID(), uid, nome, rolagem: plano.rolagem, jogada: plano.jogada, em: Date.now(), rotulo };
      const p = encenar(r); // marca como "na tela" antes de qualquer coisa chegar ao histórico
      setHistorico((h) => [r, ...h.filter((x) => x.id !== r.id)].slice(0, MAX_HISTORICO));
      publicarRolagem(mesaId, r).catch((e) => console.error("Não foi possível compartilhar a rolagem:", e));
      await p;
      return r.rolagem;
    },
    [encenar, mesaId, nome, uid],
  );

  // Recebe as rolagens dos outros jogadores que estão online agora.
  useEffect(() => {
    if (!uid) return;
    precarregarSom();
    const off = assinarRolagens(
      mesaId,
      (lista) => setHistorico((atual) => {
        const mapa = new Map<string, RolagemMesa>();
        for (const x of [...atual, ...lista]) mapa.set(x.id, mapa.get(x.id) ?? x);
        return [...mapa.values()].sort((a, b) => b.em - a.em).slice(0, MAX_HISTORICO);
      }),
      (nova) => {
        if (nova.uid === uid || document.hidden) return;
        if (Date.now() - nova.em > IDADE_MAX_ANIMACAO_MS) return;
        void encenar(nova);
      },
    );
    return off;
  }, [mesaId, uid, encenar]);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      cena.current?.destruir();
      cena.current = null;
    };
  }, []);

  const historico = useMemo(() => historicoBruto.filter((x) => !naTela.has(x.id)), [historicoBruto, naTela]);
  const valor = useMemo<Ctx>(() => ({ rolar, historico, rolando: exibido !== null }), [rolar, historico, exibido]);
  const crit = exibido?.rolagem.critico;

  return (
    <RolagemCtx.Provider value={valor}>
      {children}
      {/* Camada única de dados 3D: cobre a tela, não intercepta cliques e some sozinha depois da rolagem. */}
      <div aria-hidden={!exibido} className={`pointer-events-none fixed inset-0 z-[80] transition-opacity duration-500 ${visivel ? "opacity-100" : "opacity-0"}`}>
        <canvas ref={canvas} className="h-full w-full" />
        {exibido && (
          <div role="status" aria-live="polite" className="absolute inset-x-0 top-[14%] flex justify-center px-4">
            <div className={`rounded-2xl border bg-card/90 px-6 py-3 text-center shadow-2xl backdrop-blur transition-all duration-300 ${resultado ? "scale-100 opacity-100" : "scale-90 opacity-0"} ${crit === "acerto" ? "border-gold" : crit === "falha" ? "border-danger" : "border-border"}`}>
              <p className="text-xs uppercase tracking-widest text-muted">
                {exibido.nome} rolou {exibido.rolagem.expressao}
                {exibido.rotulo ? ` · ${exibido.rotulo}` : ""}
              </p>
              <p className={`font-display text-6xl font-bold ${crit === "acerto" ? "text-gold" : crit === "falha" ? "text-danger" : ""}`}>{exibido.rolagem.total}</p>
              {(crit || exibido.rolagem.grupos.some((g) => g.dados.length > 1)) && (
                <p className="text-xs text-muted">
                  {exibido.rolagem.grupos.map((g) => `${g.rotulo}: ${g.dados.join(", ")}`).join(" · ")}
                  {crit === "acerto" && " · crítico!"}
                  {crit === "falha" && " · falha crítica"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </RolagemCtx.Provider>
  );
}
