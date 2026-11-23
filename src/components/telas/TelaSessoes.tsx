"use client";

import { atualizarMesa, uid, useSegredos, type Sessao } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo, { campo } from "./Titulo";

export default function TelaSessoes() {
  const mesa = useMesaAtual();
  const { segredos, atualizar: atualizarSegredos } = useSegredos(mesa.id, true);
  const set = (sessoes: Sessao[]) => atualizarMesa(mesa.id, { sessoes });
  const setSessao = (sid: string, patch: Partial<Sessao>) =>
    set(mesa.sessoes.map((s) => (s.id === sid ? { ...s, ...patch } : s)));

  return (
    <>
      <Titulo termo="sessoes" titulo="Sessões" texto="Registre cada sessão: resumo público para os jogadores e notas secretas só para você." />
      <section className="space-y-4">
        {mesa.sessoes.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">Nenhuma sessão registrada.</p>
        )}
        {mesa.sessoes.map((s) => (
          <div key={s.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              <input value={s.titulo} onChange={(e) => setSessao(s.id, { titulo: e.target.value })} placeholder="Título da sessão" className={campo} />
              <input type="date" value={s.data} onChange={(e) => setSessao(s.id, { data: e.target.value })} className={`${campo} max-w-44`} />
              <button
                onClick={() => set(mesa.sessoes.filter((x) => x.id !== s.id))}
                aria-label="Remover sessão"
                className="px-2 text-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
            <textarea
              value={s.resumoPublico}
              onChange={(e) => setSessao(s.id, { resumoPublico: e.target.value })}
              rows={2}
              placeholder="Resumo público (jogadores veem)"
              className={campo}
            />
            <textarea
              value={segredos.notasSessoes[s.id] ?? ""}
              onChange={(e) => atualizarSegredos({ ...segredos, notasSessoes: { ...segredos.notasSessoes, [s.id]: e.target.value } })}
              rows={3}
              placeholder="🔒 Notas secretas do mestre"
              className={`${campo} border-warn/50`}
            />
          </div>
        ))}
        <button
          onClick={() => set([...mesa.sessoes, { id: uid(), titulo: "", data: "", resumoPublico: "" }])}
          className="text-sm text-accent-hover hover:underline"
        >
          + Adicionar sessão
        </button>
      </section>
    </>
  );
}
