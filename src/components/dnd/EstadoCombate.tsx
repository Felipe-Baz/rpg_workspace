"use client";

import type { FichaDnd, Teste } from "@/lib/dnd5e";
import { ATIVAVEIS, CONDICOES, EXAUSTAO, ataquesContraVoce, ativaveisDisponiveis, deslocamentoEfetivo, estadoVital, pvMaxEfetivo, type EstadoJogo } from "@/lib/regras/dnd5e/combate";
import { desligarAtivavel, gastarRecurso, imposicaoDasMaos, ligarAtivavel, testeAtaqueFurtivo, type RecursoCalculado, type RecursoDef } from "@/lib/regras/dnd5e/recursos";

const botao = "rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-sm font-semibold text-gold hover:bg-gold/20";
const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const lista = (t: string) => t.split(",").map((x) => x.trim()).filter(Boolean);

const ESTADO_ROTULO = { vivo: "", inconsciente: "Inconsciente (0 PV)", estavel: "Estável (0 PV)", morto: "Morto" } as const;

/**
 * Recursos com usos, características ativáveis, condições e exaustão, defesas manuais e o resumo do que isso muda
 * (deslocamento, PV máximos, ataques contra você). Tudo vem do motor (`regras/dnd5e`); aqui só há controles.
 */
export default function EstadoCombate({ ficha: f, defs, recursos, estado, deslocamentoBase, papel, onMudar, onRolar }: {
  ficha: FichaDnd;
  defs: RecursoDef[];
  recursos: RecursoCalculado[];
  estado: EstadoJogo;
  deslocamentoBase: number;
  papel: "jogador" | "mestre";
  onMudar: (f: FichaDnd) => void;
  onRolar: (t: Teste) => void;
}) {
  const condicoes = f.condicoes ?? [];
  const exaustao = f.exaustao ?? 0;
  const vital = estadoVital(f);
  const desl = deslocamentoEfetivo(deslocamentoBase, estado);
  const pvMaxEf = pvMaxEfetivo(f.pvMax, f);
  const contra = ataquesContraVoce(estado);
  const furtivo = testeAtaqueFurtivo(f);
  const ativaveis = ativaveisDisponiveis(f);
  const nada = !recursos.length && !ativaveis.length && !furtivo;

  const alternarCondicao = (id: string) => onMudar({ ...f, condicoes: condicoes.includes(id) ? condicoes.filter((c) => c !== id) : [...condicoes, id] });
  const mudaDefesa = (k: "resistencias" | "vulnerabilidades" | "imunidades", v: string) =>
    onMudar({ ...f, defesas: { resistencias: [], vulnerabilidades: [], imunidades: [], ...f.defesas, [k]: lista(v) } });

  return (
    <div className="space-y-4 text-sm">
      {(vital !== "vivo" || desl.valor !== deslocamentoBase || pvMaxEf !== f.pvMax || contra.length > 0) && (
        <div role="status" className="space-y-0.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs">
          {vital !== "vivo" && <p className="font-semibold text-gold">{ESTADO_ROTULO[vital]}</p>}
          {desl.valor !== deslocamentoBase && <p>Deslocamento {String(desl.valor).replace(".", ",")} m ({desl.motivos.join(", ")})</p>}
          {pvMaxEf !== f.pvMax && <p>PV máximos {pvMaxEf} (exaustão 4)</p>}
          {contra.map((c) => <p key={c} className="text-muted">Ataques contra você: {c}</p>)}
        </div>
      )}

      {!nada && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted">Recursos e características</p>
          <ul className="space-y-1.5">
            {recursos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-36 font-semibold" title={r.descricao}>{r.nome}</span>
                {r.reserva ? (
                  <>
                    <span className="font-mono text-gold">{r.restantes}/{r.max}</span>
                    <input type="number" min={1} max={r.restantes} defaultValue={1} id={`reserva-${r.id}`} aria-label="Pontos a gastar" className={`${campo} !w-16 !py-0.5 text-center`} />
                    <button className={botao} onClick={() => {
                      const n = Number((document.getElementById(`reserva-${r.id}`) as HTMLInputElement | null)?.value) || 0;
                      const novo = imposicaoDasMaos(f, defs, n);
                      if (novo) onMudar(novo); else window.alert("Reserva insuficiente.");
                    }}>curar</button>
                    <button className="text-xs text-muted hover:text-foreground" onClick={() => onMudar(gastarRecurso(f, defs, r.id, -r.usados))}>repor</button>
                  </>
                ) : r.ilimitado ? <span className="text-xs text-muted">ilimitado</span> : (
                  <span className="flex items-center gap-1">
                    {Array.from({ length: r.max }, (_, i) => (
                      <button
                        key={i}
                        aria-label={`${r.nome}: uso ${i + 1}`}
                        aria-pressed={i < r.usados}
                        onClick={() => onMudar(gastarRecurso(f, defs, r.id, i < r.usados ? -1 : 1))}
                        className={`h-4 w-4 rounded-full border ${i < r.usados ? "border-border" : "border-gold bg-gold/70"}`}
                        title={i < r.usados ? "Gasto (clique para devolver)" : "Disponível (clique para gastar)"}
                      />
                    ))}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wider text-muted">{r.recarga === "curto" ? "descanso curto" : "descanso longo"}</span>
                {r.rolagem && <button className={botao} onClick={() => onRolar({ ...r.rolagem!, d20: false })}>{r.rolagem.titulo} {r.rolagem.dado}</button>}
              </li>
            ))}
            {furtivo && <li className="flex items-center gap-2"><span className="min-w-36 font-semibold">Ataque Furtivo</span><button className={botao} onClick={() => onRolar(furtivo)}>{furtivo.dado}</button></li>}
          </ul>
          {ativaveis.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ativaveis.map((a) => {
                const ligado = (f.ativos ?? []).includes(a.id);
                return (
                  <button
                    key={a.id}
                    aria-pressed={ligado}
                    title={a.descricao}
                    onClick={() => {
                      if (ligado) return onMudar(desligarAtivavel(f, a.id));
                      const novo = ligarAtivavel(f, defs, a.id);
                      if (novo) onMudar(novo); else if (papel === "mestre") onMudar({ ...f, ativos: [...(f.ativos ?? []), a.id] }); else window.alert(`Sem usos de ${ATIVAVEIS.find((x) => x.id === a.id)?.nome} restantes.`);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs ${ligado ? "border-gold bg-gold/20 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}
                  >
                    {a.nome}{ligado ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          Condições
          <span className="ml-auto flex items-center gap-1 normal-case tracking-normal" title={EXAUSTAO.slice(0, Math.max(1, exaustao)).map((e) => `${e.nivel}: ${e.efeito}`).join("\n")}>
            Exaustão
            <button aria-label="Diminuir exaustão" onClick={() => onMudar({ ...f, exaustao: Math.max(0, exaustao - 1) })} className="rounded border border-border px-1.5">−</button>
            <strong className={exaustao ? "text-danger" : ""}>{exaustao}</strong>
            <button aria-label="Aumentar exaustão" onClick={() => onMudar({ ...f, exaustao: Math.min(6, exaustao + 1) })} className="rounded border border-border px-1.5">+</button>
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CONDICOES.map((c) => {
            const on = condicoes.includes(c.id);
            return (
              <button key={c.id} aria-pressed={on} title={c.resumo} onClick={() => alternarCondicao(c.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-danger bg-danger/15 font-semibold text-danger" : "border-border text-muted hover:text-foreground"}`}>
                {c.nome}
              </button>
            );
          })}
        </div>
        {condicoes.map((id) => <p key={id} className="text-xs text-muted"><strong className="text-foreground">{CONDICOES.find((c) => c.id === id)?.nome}:</strong> {CONDICOES.find((c) => c.id === id)?.resumo}</p>)}
        {exaustao > 0 && <p className="text-xs text-muted"><strong className="text-foreground">Exaustão {exaustao}:</strong> {EXAUSTAO.slice(0, exaustao).map((e) => e.efeito).join("; ")}.</p>}
      </div>

      <details>
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-muted">Resistências, vulnerabilidades e imunidades (manual)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([["resistencias", "Resistências"], ["vulnerabilidades", "Vulnerabilidades"], ["imunidades", "Imunidades"]] as const).map(([k, r]) => (
            <label key={k} className="text-[10px] uppercase tracking-widest text-muted">
              {r}
              <input defaultValue={(f.defesas?.[k] ?? []).join(", ")} onBlur={(e) => mudaDefesa(k, e.target.value)} placeholder="fogo, frio" className={`${campo} mt-0.5 w-full normal-case tracking-normal`} />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Somam-se às da raça, da Fúria e das condições. Separe por vírgula.</p>
      </details>
    </div>
  );
}
