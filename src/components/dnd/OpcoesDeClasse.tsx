"use client";

import type { FichaDnd, Teste } from "@/lib/dnd5e";
import { acoesDeOpcoes, ID_REACAO_GASTA, type AcaoDeOpcao } from "@/lib/regras/dnd5e/opcoesAtivas";
import { gastarRecurso, type RecursoCalculado, type RecursoDef } from "@/lib/regras/dnd5e/recursos";
import TextoLivro from "./TextoLivro";

const GRUPOS: AcaoDeOpcao["grupo"][] = ["Metamagia", "Manobras", "Disciplinas Elementais", "Arma de Sopro", "Estilo de Luta"];
const RECURSO_ROTULO: Record<string, string> = { "pontos-de-feiticaria": "Pontos de Feitiçaria", "superioridade-em-combate": "Dados de Superioridade", "pontos-de-ki": "Pontos de Ki", "arma-de-sopro": "Arma de Sopro" };

/**
 * Opções escolhidas que gastam recurso: metamagia (pontos de feitiçaria), manobras (dados de superioridade), disciplinas
 * elementais (pontos de ki), Arma de Sopro e estilos de luta com reação. "Usar" gasta o recurso e, quando há, abre a rolagem.
 */
export default function OpcoesDeClasse({ ficha: f, defs, recursos, onMudar, onRolar }: {
  ficha: FichaDnd; defs: RecursoDef[]; recursos: RecursoCalculado[]; onMudar: (p: Partial<FichaDnd>) => void; onRolar: (t: Teste) => void;
}) {
  const acoes = acoesDeOpcoes(f);
  if (acoes.length === 0) return null;
  const restantes = (id: string) => recursos.find((r) => r.id === id);
  const reacaoGasta = (f.ativos ?? []).includes(ID_REACAO_GASTA);

  const usar = (a: AcaoDeOpcao) => {
    let ficha: FichaDnd = f;
    if (a.reacao) {
      if (reacaoGasta) { window.alert("Você já usou a reação neste turno. Ela volta no início do seu turno (ou clique no marcador para devolvê-la)."); return; }
      ficha = { ...ficha, ativos: [...(ficha.ativos ?? []), ID_REACAO_GASTA] };
    }
    if (a.custo) {
      let qtd = a.custo.qtd;
      if (a.custoVariavel) {
        const resp = window.prompt("Nível da magia que você duplica (truque = 0):", "1");
        if (resp === null) return;
        qtd = Math.max(1, Math.floor(Number(resp)) || 1);
      }
      const r = restantes(a.custo.recurso);
      if (!r || (!r.ilimitado && r.restantes < qtd)) { window.alert(`Faltam ${a.custo.rotulo}: ${qtd} necessário(s), ${r?.restantes ?? 0} disponível(is).`); return; }
      ficha = gastarRecurso(ficha, defs, a.custo.recurso, qtd);
    }
    if (ficha !== f) onMudar(ficha);
    if (a.teste) onRolar(a.teste);
    if (a.pedeFaces) {
      const faces = Math.floor(Number(window.prompt("Faces do dado de dano da arma (ex.: 6, 8, 10, 12):", "8")));
      if (faces >= 2) onRolar({ titulo: "Armas Grandes: novo dado (use este resultado)", dado: `1d${faces}`, partes: [], d20: false });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold">Opções de classe e raça</h2>
        {acoes.some((a) => a.reacao) && (
          <button
            onClick={() => onMudar({ ativos: reacaoGasta ? (f.ativos ?? []).filter((x) => x !== ID_REACAO_GASTA) : [...(f.ativos ?? []), ID_REACAO_GASTA] })}
            aria-pressed={reacaoGasta}
            className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs ${reacaoGasta ? "border-border text-muted" : "border-gold bg-gold/15 text-gold"}`}
            title="Marca se a reação já foi gasta. Na iniciativa ao vivo, volta sozinha quando o seu turno começa."
          >{reacaoGasta ? "Reação gasta (devolve no seu turno)" : "Reação disponível"}</button>
        )}
      </div>
      {GRUPOS.map((g) => {
        const lista = acoes.filter((a) => a.grupo === g);
        if (!lista.length) return null;
        const recId = lista.find((a) => a.custo)?.custo?.recurso;
        const r = recId ? restantes(recId) : undefined;
        return (
          <section key={g} className="rounded-xl border border-border bg-background/40 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {g}
              {r && <span className="ml-auto font-mono text-xs text-gold" title={RECURSO_ROTULO[r.id]}>{RECURSO_ROTULO[r.id] ?? r.nome}: {r.ilimitado ? "∞" : `${r.restantes}/${r.max}`}</span>}
            </h3>
            <ul className="space-y-2">
              {lista.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <details className="min-w-0 flex-1"><summary className="cursor-pointer font-semibold">{a.nome}{a.custo && !a.custoVariavel ? <span className="ml-1 text-xs font-normal text-muted">({a.custo.qtd} {a.custo.rotulo})</span> : a.custoVariavel ? <span className="ml-1 text-xs font-normal text-muted">(pontos = nível da magia)</span> : null}</summary><TextoLivro texto={a.texto} className="mt-1 text-xs" /></details>
                    {(a.custo || a.reacao || a.pedeFaces || a.teste) && (
                      <button onClick={() => usar(a)} className="rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold/20">{a.teste || a.pedeFaces ? "Usar e rolar" : "Usar"}</button>
                    )}
                  </div>
                  {a.info && <p className="text-xs text-muted">{a.info}</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
