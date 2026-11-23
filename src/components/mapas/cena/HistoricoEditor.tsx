"use client";

import type { Entrada, Historico } from "@/lib/cena/comandos";

const btn = "rounded-lg border border-border px-2 py-1 text-xs hover:bg-border/50 disabled:opacity-40";

type Grupo =
  | { tipo: "ia"; entrada: Entrada }
  | { tipo: "reversao"; entrada: Entrada }
  | { tipo: "manual"; quantidade: number };

/** Mais recente primeiro; edições manuais seguidas viram uma linha só. */
function agrupar(h: Historico): Grupo[] {
  const grupos: Grupo[] = [];
  for (const e of [...h.passado].reverse()) {
    if (e.meta.passo) grupos.push({ tipo: "ia", entrada: e });
    else if (e.meta.reverte) grupos.push({ tipo: "reversao", entrada: e });
    else {
      const ult = grupos[grupos.length - 1];
      if (ult?.tipo === "manual") ult.quantidade++;
      else grupos.push({ tipo: "manual", quantidade: 1 });
    }
  }
  return grupos;
}

export default function HistoricoEditor({
  historico,
  revertidos,
  destacarIa,
  onDestacarIa,
  onReverterPasso,
  onReverterIa,
}: {
  historico: Historico;
  revertidos: Set<string>;
  destacarIa: boolean;
  onDestacarIa: (v: boolean) => void;
  onReverterPasso: (id: string) => void;
  onReverterIa: () => void;
}) {
  const grupos = agrupar(historico);
  const iaAtivos = historico.passado.some((e) => e.meta.autor === "ia" && e.meta.passo && !revertidos.has(e.meta.passo.id));

  return (
    <section className="space-y-1.5 border-t border-border pt-2">
      <h3 className="text-xs uppercase tracking-wider text-muted">Histórico</h3>
      <div className="flex flex-wrap items-center gap-1">
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={destacarIa} onChange={(e) => onDestacarIa(e.target.checked)} /> Destacar IA
        </label>
        <button className={btn} disabled={!iaAtivos} onClick={onReverterIa} title="Desfaz só o que a IA fez; o que você fez à mão permanece">
          Reverter ações da IA
        </button>
      </div>
      {!grupos.length && <p className="text-xs text-muted">Nenhuma alteração nesta sessão.</p>}
      <ul className="space-y-1">
        {grupos.slice(0, 50).map((g, i) => {
          if (g.tipo === "manual")
            return (
              <li key={i} className="text-xs text-muted">✎ Edição manual{g.quantidade > 1 ? ` ×${g.quantidade}` : ""}</li>
            );
          if (g.tipo === "reversao")
            return (
              <li key={i} className="text-xs text-muted">↺ Reverteu {g.entrada.meta.reverte!.length} passo(s) da IA</li>
            );
          const p = g.entrada.meta.passo!;
          const revertido = revertidos.has(p.id);
          return (
            <li key={i}>
              <details className="rounded-md border border-border/70 px-1.5 py-1">
                <summary className="flex cursor-pointer items-center gap-1 text-xs">
                  <span className="rounded bg-cyan-500/20 px-1 text-[10px] text-cyan-400">IA</span>
                  <span className={`truncate ${revertido ? "text-muted line-through" : ""}`}>{p.titulo}</span>
                  {!revertido && (
                    <button className={`${btn} ml-auto`} onClick={(e) => (e.preventDefault(), onReverterPasso(p.id))}>Reverter</button>
                  )}
                </summary>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted">
                  {p.resumo.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
