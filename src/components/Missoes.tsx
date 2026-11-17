"use client";

import { useState } from "react";
import EditorMarkdown from "./EditorMarkdown";
import Markdown from "./Markdown";
import {
  STATUS_MISSAO,
  atualizarMissao,
  criarMissao,
  excluirMissao,
  useMissoes,
  type Missao,
  type StatusMissao,
} from "@/lib/missoes";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** Aba "Missões": em andamento, concluídas e fracassadas. O mestre edita; os jogadores leem. */
export default function Missoes({ mesaId, ehMestre }: { mesaId: string; ehMestre: boolean }) {
  const { missoes, carregado } = useMissoes(mesaId, true);
  const [titulo, setTitulo] = useState("");

  async function adicionar() {
    const t = titulo.trim();
    if (!t) return;
    setTitulo("");
    await criarMissao(mesaId, t);
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Missões</h2>

      {ehMestre && (
        <div className="flex gap-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="Título da nova missão"
            className={campo}
          />
          <button
            onClick={adicionar}
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            + Missão
          </button>
        </div>
      )}

      {carregado && missoes.length === 0 && (
        <p className="text-muted">{ehMestre ? "Nenhuma missão ainda." : "O mestre ainda não registrou missões."}</p>
      )}

      {STATUS_MISSAO.map((s) => {
        const lista = missoes.filter((m) => m.status === s.id);
        if (lista.length === 0) return null;
        return (
          <div key={s.id} className="space-y-3">
            <h3 className={`text-sm font-semibold uppercase tracking-wider ${s.cor}`}>
              {s.icone} {s.rotulo} ({lista.length})
            </h3>
            {lista.map((m) => (
              <CartaoMissao key={m.id} mesaId={mesaId} missao={m} ehMestre={ehMestre} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function CartaoMissao({ mesaId, missao, ehMestre }: { mesaId: string; missao: Missao; ehMestre: boolean }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(missao.titulo);
  const [descricao, setDescricao] = useState(missao.descricao);

  async function concluirEdicao() {
    await atualizarMissao(mesaId, missao.id, { titulo: titulo.trim() || missao.titulo, descricao });
    setEditando(false);
  }

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      {editando ? (
        <>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo} aria-label="Título" />
          <EditorMarkdown valor={descricao} onChange={setDescricao} placeholder="Objetivo, pistas, recompensas…" />
        </>
      ) : (
        <>
          <h4 className="text-lg font-semibold">{missao.titulo}</h4>
          {missao.descricao.trim() ? <Markdown texto={missao.descricao} /> : <p className="text-sm text-muted">Sem descrição.</p>}
        </>
      )}

      {ehMestre && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <select
            value={missao.status}
            onChange={(e) => atualizarMissao(mesaId, missao.id, { status: e.target.value as StatusMissao })}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            aria-label="Situação"
          >
            {STATUS_MISSAO.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icone} {s.rotulo}
              </option>
            ))}
          </select>
          <div className="flex gap-4 text-sm">
            <button
              onClick={() => (editando ? concluirEdicao() : setEditando(true))}
              className="text-violet-500 hover:underline"
            >
              {editando ? "Salvar" : "Editar"}
            </button>
            <button
              onClick={() => confirm(`Excluir a missão "${missao.titulo}"?`) && excluirMissao(mesaId, missao.id)}
              className="text-muted hover:text-red-500"
            >
              Excluir
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
