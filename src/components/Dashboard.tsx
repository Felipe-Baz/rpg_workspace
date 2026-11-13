"use client";

import { MESA_PADRAO } from "@/lib/marcas-const";
import Link from "next/link";
import { useState } from "react";
import { sair, useAuth } from "@/lib/auth";
import {
  CORES,
  STATUS_LABEL,
  criarMesa,
  entrarPorCodigo,
  excluirMesa,
  sairDaMesa,
  useMesas,
  type Mesa,
  type Status,
} from "@/lib/mesas";

export default function Dashboard() {
  const { user } = useAuth();
  const { mesas, pronto } = useMesas();
  const [abrindo, setAbrindo] = useState(false);
  const [entrando, setEntrando] = useState(false);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RPG Workspace</h1>
          <p className="text-muted">Suas mesas, campanhas e personagens em um só lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{user?.displayName || user?.email}</span>
          <Link
            href={`/mesas/${MESA_PADRAO}/marcas`}
            className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-border/50"
          >
            Marcas de Pacto
          </Link>
          <button
            onClick={() => setEntrando(true)}
            className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-border/50"
          >
            Entrar com código
          </button>
          <button
            onClick={() => setAbrindo(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700"
          >
            + Nova mesa
          </button>
          <button onClick={sair} className="px-2 py-2 text-sm text-muted hover:underline">
            Sair
          </button>
        </div>
      </header>

      {pronto && mesas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="mb-1 text-lg font-medium">Nenhuma mesa cadastrada</p>
          <p className="text-muted">Crie sua primeira mesa para começar.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mesas.map((m) => (
            <MesaCard key={m.id} mesa={m} uid={user?.uid ?? ""} />
          ))}
        </ul>
      )}

      {abrindo && user && <NovaMesaDialog uid={user.uid} onClose={() => setAbrindo(false)} />}
      {entrando && user && <EntrarDialog uid={user.uid} onClose={() => setEntrando(false)} />}
    </main>
  );
}

function MesaCard({ mesa, uid }: { mesa: Mesa; uid: string }) {
  const mestre = mesa.donoUid === uid;
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-2" style={{ background: mesa.cor }} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold leading-tight">{mesa.nome}</h2>
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              {STATUS_LABEL[mesa.status]}
            </span>
          </div>
          <p className="text-sm text-muted">{mesa.sistema || "Sistema não informado"}</p>
        </div>
        <p className="line-clamp-3 flex-1 text-sm">{mesa.descricao || "Sem descrição."}</p>
        <p className="text-xs text-muted">
          {mesa.jogadores.length} jogador(es) · {mesa.sessoes.length} sessão(ões)
        </p>
        {mestre && (
          <p className="text-xs text-muted">
            Código de convite: <code className="font-mono font-semibold">{mesa.codigo}</code>
          </p>
        )}
        <div className="flex gap-2">
          {mestre && (
            <Link
              href={`/mesas/${mesa.id}/mestre`}
              className="flex-1 rounded-lg bg-violet-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-violet-700"
            >
              Mestre
            </Link>
          )}
          <Link
            href={`/mesas/${mesa.id}/jogador`}
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-center text-sm font-medium hover:bg-border/50"
          >
            Jogador
          </Link>
          <button
            onClick={() =>
              mestre
                ? confirm(`Excluir "${mesa.nome}" para todos?`) && excluirMesa(mesa)
                : confirm(`Sair de "${mesa.nome}"?`) && sairDaMesa(mesa, uid)
            }
            aria-label={`${mestre ? "Excluir" : "Sair de"} ${mesa.nome}`}
            title={mestre ? "Excluir mesa" : "Sair da mesa"}
            className="rounded-lg px-2 text-muted hover:text-red-500"
          >
            {mestre ? "✕" : "↩"}
          </button>
        </div>
      </div>
    </li>
  );
}

function NovaMesaDialog({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [cor, setCor] = useState(CORES[0]);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    criarMesa(uid, {
      nome: String(f.get("nome")).trim(),
      sistema: String(f.get("sistema")).trim(),
      descricao: String(f.get("descricao")).trim(),
      status: f.get("status") as Status,
      cor,
    });
    onClose();
  }

  const campo = "w-full rounded-lg border border-border bg-background px-3 py-2";

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <h2 className="text-xl font-semibold">Nova mesa</h2>
        <label className="block text-sm">
          Nome
          <input name="nome" required autoFocus className={campo} />
        </label>
        <label className="block text-sm">
          Sistema
          <input name="sistema" placeholder="D&D 5e, Tormenta20, Call of Cthulhu…" className={campo} />
        </label>
        <label className="block text-sm">
          Descrição
          <textarea name="descricao" rows={3} className={campo} />
        </label>
        <label className="block text-sm">
          Status
          <select name="status" defaultValue="planejando" className={campo}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {CORES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCor(c)}
              aria-label={`Cor ${c}`}
              className="h-7 w-7 rounded-full"
              style={{
                background: c,
                outline: c === cor ? "2px solid currentColor" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">
            Cancelar
          </button>
          <button className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700">
            Criar
          </button>
        </div>
      </form>
    </div>
  );
}

function EntrarDialog({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const codigo = String(new FormData(e.currentTarget).get("codigo"));
    setErro("");
    setOcupado(true);
    try {
      await entrarPorCodigo(codigo, uid);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar na mesa.");
      setOcupado(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <h2 className="text-xl font-semibold">Entrar em uma mesa</h2>
        <label className="block text-sm">
          Código de convite
          <input
            name="codigo"
            required
            autoFocus
            autoCapitalize="characters"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono uppercase"
          />
        </label>
        {erro && <p role="alert" className="text-sm text-red-500">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">
            Cancelar
          </button>
          <button
            disabled={ocupado}
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Entrar
          </button>
        </div>
      </form>
    </div>
  );
}
