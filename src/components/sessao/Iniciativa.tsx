"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Dices, Heart, Plus, RotateCcw, Send, Shield, X } from "lucide-react";
import { useRolagem } from "../dados/RolagemProvider";
import { usePersistido } from "@/lib/persistido";
import { atualizarEstadoDaFicha, lerPvDaFicha, useFichaEfetiva } from "@/lib/fichaPersonagem";
import { condicaoDe, condicoesEfetivas, pvMaxEfetivo } from "@/lib/regras/dnd5e/combate";
import type { OpcoesMesa } from "@/lib/regras/sistema";
import { assinarPedidosDaMesa, pedirTeste, removerPedido } from "@/lib/pedidosTeste";

export type JogadorMesa = { nome: string; uid?: string };
type Combatente = { id: string; nome: string; ini: number | null; pv: number | null; pvMax?: number; condicoes: string[]; jogador: boolean; uid?: string };
type Estado = { lista: Combatente[]; turno: number; rodada: number };
const VAZIO: Estado = { lista: [], turno: 0, rodada: 1 };
const CONDICOES = ["Caído", "Atordoado", "Envenenado", "Amedrontado", "Invisível", "Concentrando"];

// Quem ainda não tem iniciativa (null) fica no fim da ordem.
const ordenar = (l: Combatente[]) => [...l].sort((a, b) => (b.ini ?? -Infinity) - (a.ini ?? -Infinity));

// Rastreador de iniciativa: ordem, turno, rodada, PV e condições. Persiste por mesa no navegador.
export default function Iniciativa({ mesaId, jogadores, opcoes, aoVivo = false }: { mesaId: string; jogadores: JogadorMesa[]; opcoes?: OpcoesMesa; /** mesa de D&D 5e: jogadores vinculados mostram PV, CA e condições lidos ao vivo da ficha */ aoVivo?: boolean }) {
  const [est, setEst] = usePersistido<Estado>(`iniciativa:${mesaId}`, VAZIO);
  const { rolar } = useRolagem();
  const [nome, setNome] = useState("");
  const [ini, setIni] = useState("");
  const ordem = ordenar(est.lista);
  const turno = Math.min(est.turno, Math.max(0, ordem.length - 1));

  const [pedindo, setPedindo] = useState(false);
  const aplicados = useRef(new Set<string>());

  async function adicionar(n: string, valor: number | null, jogador = false, uid?: string, semIniciativa = false) {
    const nomeFinal = n.trim();
    if (!nomeFinal) return;
    const ficha = uid ? await lerPvDaFicha(mesaId, uid, opcoes) : null; // jogador entra no combate com a vida atual da ficha
    const iniFinal = semIniciativa ? null : (valor ?? (await rolar("d20", `Iniciativa de ${nomeFinal}`))!.total);
    setEst((e) => ({ ...e, lista: [...e.lista, { id: crypto.randomUUID(), nome: nomeFinal, ini: iniFinal, pv: ficha?.pv ?? null, pvMax: ficha?.pvMax, condicoes: [], jogador, uid }] }));
  }

  // Respostas de iniciativa pedidas aos jogadores: entram no combate (ou atualizam quem já está) e o pedido é limpo.
  useEffect(() => assinarPedidosDaMesa(mesaId, (pedidos) => {
    for (const p of pedidos) {
      if (p.tipo !== "iniciativa" || p.status !== "respondido" || p.total === undefined || aplicados.current.has(p.id)) continue;
      aplicados.current.add(p.id);
      const total = p.total;
      void (async () => {
        const ficha = await lerPvDaFicha(mesaId, p.paraUid, opcoes);
        setEst((e) => {
          const existe = e.lista.some((c) => c.uid === p.paraUid);
          const lista = existe
            ? e.lista.map((c) => (c.uid === p.paraUid ? { ...c, ini: total, pv: ficha?.pv ?? c.pv, pvMax: ficha?.pvMax ?? c.pvMax } : c))
            : [...e.lista, { id: crypto.randomUUID(), nome: p.paraNome, ini: total, pv: ficha?.pv ?? null, pvMax: ficha?.pvMax, condicoes: [], jogador: true, uid: p.paraUid }];
          return { ...e, lista };
        });
        removerPedido(mesaId, p.id).catch(() => {});
      })();
    }
  }), [mesaId, setEst, opcoes]);

  async function pedirIniciativa() {
    setPedindo(true);
    try {
      await Promise.all(jogadores.filter((j) => j.uid).map((j) => pedirTeste(mesaId, { paraUid: j.uid!, paraNome: j.nome, tipo: "iniciativa", chave: "iniciativa", vantagem: null, motivo: "Combate! Role a iniciativa." })));
    } catch (e) { console.error(e); } finally { setPedindo(false); }
  }

  const atualizar = (id: string, patch: Partial<Combatente>) =>
    setEst((e) => ({ ...e, lista: e.lista.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  function proximo() {
    setEst((e) => {
      const n = e.lista.length;
      if (!n) return e;
      const t = Math.min(e.turno, n - 1) + 1;
      return t >= n ? { ...e, turno: 0, rodada: e.rodada + 1 } : { ...e, turno: t };
    });
  }

  const alternarCondicao = (c: Combatente, cond: string) =>
    atualizar(c.id, { condicoes: c.condicoes.includes(cond) ? c.condicoes.filter((x) => x !== cond) : [...c.condicoes, cond] });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Rodada <b className="font-display text-lg text-foreground">{est.rodada}</b></p>
        <div className="flex flex-wrap gap-2">
          <button onClick={proximo} disabled={!ordem.length} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
            Próximo turno <ChevronRight size={14} />
          </button>
          <button onClick={() => setEst(VAZIO)} title="Encerrar combate" aria-label="Encerrar combate" className="rounded-lg border border-border px-2.5 text-muted hover:text-danger"><RotateCcw size={14} /></button>
        </div>
      </div>

      {ordem.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Nenhum combatente. Adicione abaixo ou puxe os jogadores da mesa.</p>
      ) : (
        <ul className="space-y-2">
          {ordem.map((c, i) => (
            <li key={c.id} className={`rounded-xl border p-3 transition-colors ${i === turno ? "border-accent bg-accent/10 shadow-[0_0_24px_-10px_var(--accent)]" : "border-border bg-card"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" value={c.ini ?? ""} placeholder="—" onChange={(e) => atualizar(c.id, { ini: e.target.value === "" ? null : Number(e.target.value) })} aria-label={`Iniciativa de ${c.nome}`} className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-center font-display text-lg" />
                <span className={`min-w-[7rem] flex-1 truncate font-medium ${c.jogador ? "text-accent-soft" : ""}`}>{c.nome}</span>
                {c.uid && aoVivo ? <PvAoVivo mesaId={mesaId} uid={c.uid} opcoes={opcoes} nome={c.nome} /> : (
                <label className="flex items-center gap-1 text-muted">
                  <Heart size={14} className={c.pv !== null && c.pv <= 0 ? "text-danger" : ""} />
                  <input
                    type="number"
                    value={c.pv ?? ""}
                    placeholder={c.pvMax ? `PV/${c.pvMax}` : "PV"}
                    onChange={(e) => atualizar(c.id, { pv: e.target.value === "" ? null : Number(e.target.value) })}
                    aria-label={`PV de ${c.nome}`}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm text-foreground"
                  />
                </label>
                )}
                <button onClick={() => setEst((e) => ({ ...e, lista: e.lista.filter((x) => x.id !== c.id) }))} aria-label={`Remover ${c.nome}`} className="p-1 text-muted hover:text-danger"><X size={16} /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {CONDICOES.map((cond) => (
                  <button
                    key={cond}
                    onClick={() => alternarCondicao(c, cond)}
                    aria-pressed={c.condicoes.includes(cond)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${c.condicoes.includes(cond) ? "border-warn bg-warn/15 text-warn" : "border-border text-muted/70 hover:text-foreground"}`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => { e.preventDefault(); adicionar(nome, ini === "" ? null : Number(ini)); setNome(""); setIni(""); }} className="flex flex-wrap gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex.: Goblin 1)" aria-label="Nome do combatente" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="number" value={ini} onChange={(e) => setIni(e.target.value)} placeholder="Ini (vazio = d20)" aria-label="Iniciativa" className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-36" />
        <button className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent-hover"><Plus size={14} /> Adicionar</button>
      </form>
      {jogadores.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {jogadores.some((j) => j.uid) && (
            <button onClick={pedirIniciativa} disabled={pedindo} className="inline-flex items-center gap-1.5 text-sm text-accent-hover hover:underline disabled:opacity-50">
              <Send size={14} /> Pedir iniciativa aos jogadores
            </button>
          )}
          <button
            onClick={() => jogadores.filter((j) => !est.lista.some((c) => (j.uid && c.uid === j.uid) || c.nome === j.nome)).forEach((j) => adicionar(j.nome, null, true, j.uid, true))}
            className="inline-flex items-center gap-1.5 text-sm text-accent-hover hover:underline"
          >
            <Plus size={14} /> Puxar jogadores da mesa (com a vida atual, sem iniciativa)
          </button>
          {est.lista.some((c) => c.ini === null) && (
            <button
              onClick={() => est.lista.filter((c) => c.ini === null).forEach(async (c) => { const r = await rolar("d20", `Iniciativa de ${c.nome}`); if (r) atualizar(c.id, { ini: r.total }); })}
              className="inline-flex items-center gap-1.5 text-sm text-accent-hover hover:underline"
            >
              <Dices size={14} /> Rolar d20 para quem está sem iniciativa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** PV, CA e condições de um jogador, lidos AO VIVO da ficha (já calculados pelo livro). Editar o PV grava só esse campo. */
function PvAoVivo({ mesaId, uid, opcoes, nome }: { mesaId: string; uid: string; opcoes?: OpcoesMesa; nome: string }) {
  const { ficha, carregado } = useFichaEfetiva(mesaId, uid, opcoes);
  const [rascunho, setRascunho] = useState<string | null>(null);
  if (!carregado) return <span className="text-xs text-muted">lendo a ficha…</span>;
  const pvMax = pvMaxEfetivo(ficha.pvMax, ficha);
  const conds = condicoesEfetivas(ficha);
  const gravar = () => {
    const n = Number(rascunho);
    setRascunho(null);
    if (rascunho !== null && rascunho.trim() !== "" && Number.isFinite(n)) atualizarEstadoDaFicha(mesaId, uid, { pv: Math.max(0, Math.round(n)) }).catch((e) => console.error(e));
  };
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
      <label className="flex items-center gap-1" title="Vida atual da ficha (ao vivo)">
        <Heart size={14} className={ficha.pv <= 0 ? "text-danger" : ""} aria-hidden />
        <input
          type="number"
          value={rascunho ?? ficha.pv}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={gravar}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label={`PV de ${nome} (da ficha)`}
          className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm text-foreground"
        />
        <span className="text-xs">/{pvMax}{ficha.pvTemp > 0 ? <span className="text-sky-400"> +{ficha.pvTemp}</span> : null}</span>
      </label>
      <span className="flex items-center gap-1 text-xs" title="Classe de armadura"><Shield size={12} aria-hidden /> {ficha.ca}</span>
      {conds.map((id) => <span key={id} title={condicaoDe(id)?.resumo} className="rounded-full border border-danger/50 bg-danger/10 px-1.5 text-[11px] text-danger">{condicaoDe(id)?.nome ?? id}</span>)}
      {ficha.concentracao && <span className="rounded-full border border-gold/50 bg-gold/10 px-1.5 text-[11px] text-gold" title="Concentrando">Conc.: {ficha.concentracao.nome}</span>}
    </span>
  );
}
