"use client";

import { useState } from "react";
import { ChevronRight, Dices, Heart, Plus, RotateCcw, X } from "lucide-react";
import { useRolagem } from "../dados/RolagemProvider";
import { usePersistido } from "@/lib/persistido";

type Combatente = { id: string; nome: string; ini: number; pv: number | null; condicoes: string[]; jogador: boolean };
type Estado = { lista: Combatente[]; turno: number; rodada: number };
const VAZIO: Estado = { lista: [], turno: 0, rodada: 1 };
const CONDICOES = ["Caído", "Atordoado", "Envenenado", "Amedrontado", "Invisível", "Concentrando"];

const ordenar = (l: Combatente[]) => [...l].sort((a, b) => b.ini - a.ini);

// Rastreador de iniciativa: ordem, turno, rodada, PV e condições. Persiste por mesa no navegador.
export default function Iniciativa({ mesaId, jogadores }: { mesaId: string; jogadores: string[] }) {
  const [est, setEst] = usePersistido<Estado>(`iniciativa:${mesaId}`, VAZIO);
  const { rolar } = useRolagem();
  const [nome, setNome] = useState("");
  const [ini, setIni] = useState("");
  const ordem = ordenar(est.lista);
  const turno = Math.min(est.turno, Math.max(0, ordem.length - 1));

  async function adicionar(n: string, valor: number | null, jogador = false) {
    const nomeFinal = n.trim();
    if (!nomeFinal) return;
    const iniFinal = valor ?? (await rolar("d20", `Iniciativa de ${nomeFinal}`))!.total;
    setEst((e) => ({ ...e, lista: [...e.lista, { id: crypto.randomUUID(), nome: nomeFinal, ini: iniFinal, pv: null, condicoes: [], jogador }] }));
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
        <div className="flex gap-2">
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
              <div className="flex items-center gap-2">
                <input type="number" value={c.ini} onChange={(e) => atualizar(c.id, { ini: Number(e.target.value) || 0 })} aria-label={`Iniciativa de ${c.nome}`} className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-center font-display text-lg" />
                <span className={`min-w-0 flex-1 truncate font-medium ${c.jogador ? "text-accent-soft" : ""}`}>{c.nome}</span>
                <label className="flex items-center gap-1 text-muted">
                  <Heart size={14} className={c.pv !== null && c.pv <= 0 ? "text-danger" : ""} />
                  <input
                    type="number"
                    value={c.pv ?? ""}
                    placeholder="PV"
                    onChange={(e) => atualizar(c.id, { pv: e.target.value === "" ? null : Number(e.target.value) })}
                    aria-label={`PV de ${c.nome}`}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm text-foreground"
                  />
                </label>
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
        <input type="number" value={ini} onChange={(e) => setIni(e.target.value)} placeholder="Ini (vazio = d20)" aria-label="Iniciativa" className="w-36 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent-hover"><Plus size={14} /> Adicionar</button>
      </form>
      {jogadores.length > 0 && (
        <button
          onClick={() => jogadores.filter((j) => !est.lista.some((c) => c.nome === j)).forEach((j) => adicionar(j, null, true))}
          className="inline-flex items-center gap-1.5 text-sm text-accent-hover hover:underline"
        >
          <Dices size={14} /> Puxar jogadores da mesa (rola d20 para cada)
        </button>
      )}
    </div>
  );
}
