"use client";

import { useState } from "react";
import { uid } from "@/lib/mesas";
import { alternarMagia, contagemMagias, type FichaDnd, type Magia } from "@/lib/dnd5e";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Pós-descanso longo: pergunta se o jogador quer trocar as magias e truques ativos e, se quiser,
 * mostra todas as cadastradas com liga/desliga respeitando os limites. Dá para cadastrar uma nova
 * já ativa (se couber). As mudanças são gravadas na hora; "Concluir" só fecha o painel.
 */
export default function TrocaMagias({ ficha: f, etapa, onMudar, onTrocar, onFechar }: {
  ficha: FichaDnd; etapa: "perguntar" | "trocar";
  onMudar: (f: FichaDnd) => void; onTrocar: () => void; onFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState(0);
  const cont = contagemMagias(f);
  if (!cont.lim) return null;

  const adicionar = () => {
    if (!nome.trim()) return;
    const cheio = nivel === 0 ? cont.truquesCheio : cont.magiasCheio;
    const nova: Magia = { id: uid(), nome: nome.trim(), nivel, ativa: !cheio, escola: "", tempo: "1 ação", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des" };
    onMudar({ ...f, magias: [...f.magias, nova] });
    setNome("");
  };

  const cor = (n: number, max: number, cheio: boolean) => (n > max ? "text-danger" : cheio ? "text-gold" : "text-foreground");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Trocar magias ativas">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border-2 border-gold/50 bg-card p-5 shadow-xl">
        {etapa === "perguntar" ? (
          <>
            <h2 className="font-display text-lg font-bold text-gold">Descanso longo concluído</h2>
            <p className="mt-2 text-sm text-muted">Quer trocar os truques e as magias ativos? Você ativa outra (desativando uma) ou cadastra uma nova para ficar ativa.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onFechar} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">Manter como está</button>
              <button onClick={onTrocar} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/25">Trocar magias</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold text-gold">Trocar magias ativas</h2>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
              <span>Truques <strong className={cor(cont.truques, cont.lim.truques, cont.truquesCheio)}>{cont.truques}/{cont.lim.truques}</strong></span>
              <span>Magias <strong className={cor(cont.magias, cont.lim.magias, cont.magiasCheio)}>{cont.magias}/{cont.lim.magias}</strong></span>
            </p>
            <p className="mt-1 text-xs text-muted">No limite, desative uma para poder ativar outra.</p>

            {f.magias.length === 0 && <p className="mt-3 text-sm text-muted">Nenhuma magia cadastrada ainda.</p>}
            {Array.from({ length: 10 }, (_, nv) => nv).map((nv) => {
              const lista = f.magias.filter((m) => m.nivel === nv);
              if (!lista.length) return null;
              const cheio = nv === 0 ? cont.truquesCheio : cont.magiasCheio;
              return (
                <div key={nv} className="mt-3">
                  <h3 className="mb-1 border-b border-gold/20 pb-1 font-display text-sm text-gold">{nv === 0 ? "Truques" : `${nv}º círculo`}</h3>
                  <ul className="space-y-1">
                    {lista.map((m) => {
                      const bloqueada = !m.ativa && cheio;
                      return (
                        <li key={m.id}>
                          <label className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${bloqueada ? "opacity-50" : "hover:bg-background/60"}`} title={bloqueada ? "Limite atingido: desative outra primeiro" : "Ativa: magia preparada ou conhecida, que pode ser conjurada."}>
                            <input type="checkbox" checked={m.ativa} disabled={bloqueada} onChange={() => onMudar(alternarMagia(f, m.id))} />
                            <span className={m.ativa ? "text-foreground" : "text-muted"}>{m.nome || "Magia sem nome"}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="Nova magia" aria-label="Nome da nova magia" className={`${campo} min-w-32 flex-1`} />
              <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))} aria-label="Círculo da nova magia" className={campo}>
                <option value={0}>Truque</option>
                {Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1}º círculo</option>)}
              </select>
              <button onClick={adicionar} disabled={!nome.trim()} className="rounded-lg border border-border px-3 py-1.5 text-sm text-accent-hover hover:border-accent disabled:cursor-not-allowed disabled:opacity-40">
                {(nivel === 0 ? cont.truquesCheio : cont.magiasCheio) ? "Cadastrar (inativa)" : "Cadastrar e ativar"}
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={onFechar} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/25">Concluir</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
