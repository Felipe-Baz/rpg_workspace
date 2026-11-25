"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FichaDnd, Habilidade } from "@/lib/dnd5e";
import { defDeHabilidade, gastarRecurso, idHabilidade, type RecursoCalculado, type RecursoDef } from "@/lib/regras/dnd5e/recursos";

const campo = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const ROTULO = { curto: "descanso curto", longo: "descanso longo", manual: "recarga manual" } as const;
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Habilidades com usos limitados (traço de raça, subclasse, talento ou item que o motor não conhece).
 * Os usos gastos ficam em `recursos["hab-{id}"]`, então os descansos e o card de recursos do Combate já os tratam.
 */
export default function HabilidadesUsos({ ficha: f, defs, recursos, onMudar }: { ficha: FichaDnd; defs: RecursoDef[]; recursos: RecursoCalculado[]; onMudar: (p: Partial<FichaDnd>) => void }) {
  // o que vem do livro (raça, classe, subclasse, talento): calculado, só gasta/devolve os usos
  const doLivro = recursos.filter((r) => !r.id.startsWith("hab-"));
  const lista = f.habilidades ?? [];
  const mudar = (id: string, p: Partial<Habilidade>) => onMudar({ habilidades: lista.map((h) => (h.id === id ? { ...h, ...p } : h)) });
  const remover = (h: Habilidade) => {
    if (!window.confirm(`Remover "${h.nome || "habilidade"}" da ficha?`)) return;
    const { [idHabilidade(h.id)]: _gasto, ...resto } = f.recursos ?? {};
    onMudar({ habilidades: lista.filter((x) => x.id !== h.id), recursos: resto });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold">Habilidades e usos</h2>
        <button
          onClick={() => onMudar({ habilidades: [...lista, { id: uid(), nome: "", max: 1, recarga: "longo", fonte: "", descricao: "" }] })}
          className="ml-auto inline-flex items-center gap-1 text-xs text-accent-hover hover:underline"
        ><Plus size={13} /> Adicionar habilidade</button>
      </div>
      {doLivro.length > 0 && (
        <ul className="space-y-1.5">
          {doLivro.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-40 font-semibold" title={r.descricao}>{r.nome}</span>
              <span className="text-xs text-muted">{r.fonte} · {ROTULO[r.recarga]}</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="font-mono text-gold">{r.ilimitado ? "∞" : `${r.restantes}/${r.max}`}</span>
                {!r.ilimitado && !r.reserva && Array.from({ length: r.max }, (_, i) => (
                  <button
                    key={i}
                    aria-label={`${r.nome}: uso ${i + 1}`}
                    aria-pressed={i < r.usados}
                    onClick={() => onMudar(gastarRecurso(f, defs, r.id, i < r.usados ? -1 : 1))}
                    className={`bolinha h-4 w-4 rounded-full border ${i < r.usados ? "border-border" : "border-gold bg-gold/70"}`}
                    title={i < r.usados ? "Gasto (clique para devolver)" : "Disponível (clique para gastar)"}
                  />
                ))}
              </span>
              <p className="basis-full text-xs text-muted">{r.descricao}</p>
            </li>
          ))}
        </ul>
      )}
      {lista.length === 0 && doLivro.length === 0 && (
        <p className="text-sm text-muted">O que vem do livro (raça, classe, subclasse, talentos) aparece sozinho. Anote aqui o que tem usos limitados e não vem pronto (ex.: um traço de raça ou subclasse, um talento, um item). Os descansos devolvem os usos sozinhos.</p>
      )}
      <ul className="space-y-2">
        {lista.map((h) => {
          const def = defDeHabilidade(h);
          const usados = Math.min(Math.max(0, f.recursos?.[def.id] ?? 0), def.max);
          return (
            <li key={h.id} className="space-y-2 rounded-xl border border-border bg-background/50 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input value={h.nome} onChange={(e) => mudar(h.id, { nome: e.target.value })} placeholder="Nome (ex.: Golpe de Sorte)" aria-label="Nome da habilidade" className={`${campo} min-w-40 flex-1 font-semibold`} />
                <input value={h.fonte} onChange={(e) => mudar(h.id, { fonte: e.target.value })} placeholder="Origem (ex.: Halfling)" aria-label="Origem" className={`${campo} !w-36`} />
                <button onClick={() => remover(h)} aria-label={`Remover ${h.nome || "habilidade"}`} className="text-muted hover:text-danger"><Trash2 size={15} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <label className="flex items-center gap-1">Usos
                  <input type="number" min={1} max={99} value={h.max} onChange={(e) => mudar(h.id, { max: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} className={`${campo} !w-16 !py-0.5 text-center`} />
                </label>
                <label className="flex items-center gap-1">Recarrega no
                  <select value={h.recarga} onChange={(e) => mudar(h.id, { recarga: e.target.value as Habilidade["recarga"] })} className={`${campo} !w-auto !py-0.5`}>
                    {(Object.keys(ROTULO) as (keyof typeof ROTULO)[]).map((r) => <option key={r} value={r}>{ROTULO[r]}</option>)}
                  </select>
                </label>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="font-mono text-gold">{def.max - usados}/{def.max}</span>
                  {Array.from({ length: def.max }, (_, i) => (
                    <button
                      key={i}
                      aria-label={`${def.nome}: uso ${i + 1}`}
                      aria-pressed={i < usados}
                      onClick={() => onMudar({ ...gastarRecurso(f, [def], def.id, i < usados ? -1 : 1) })}
                      className={`bolinha h-4 w-4 rounded-full border ${i < usados ? "border-border" : "border-gold bg-gold/70"}`}
                      title={i < usados ? "Gasto (clique para devolver)" : "Disponível (clique para gastar)"}
                    />
                  ))}
                  {usados > 0 && <button onClick={() => onMudar({ ...gastarRecurso(f, [def], def.id, -usados) })} className="text-accent-hover hover:underline">repor</button>}
                </span>
              </div>
              <textarea value={h.descricao} onChange={(e) => mudar(h.id, { descricao: e.target.value })} rows={2} placeholder="O que faz (para consulta rápida na mesa)" aria-label="Descrição" className={`${campo} resize-y`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
