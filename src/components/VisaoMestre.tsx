"use client";

import Link from "next/link";
import { useState } from "react";
import LivroNotas from "./LivroNotas";
import Abas from "./Abas";
import MapasMestre from "./mapas/MapasMestre";
import { useAuth } from "@/lib/auth";
import {
  STATUS_LABEL,
  paginasDe,
  atualizarMesa,
  uid,
  useMesas,
  useSegredos,
  type Mesa,
  type Sessao,
  type Status,
} from "@/lib/mesas";

const ABAS = [
  { id: "geral" as const, rotulo: "Geral" },
  { id: "mapas" as const, rotulo: "Mapas" },
];

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function VisaoMestre({ id }: { id: string }) {
  const { user } = useAuth();
  const [aba, setAba] = useState<"geral" | "mapas">("geral");
  const { mesas, pronto } = useMesas();
  const mesa = mesas.find((m) => m.id === id);
  const ehMestre = !!mesa && mesa.donoUid === user?.uid;
  const { segredos, atualizar: atualizarSegredos } = useSegredos(id, ehMestre);

  if (!pronto) return null;
  if (!mesa || !ehMestre)
    return (
      <main className="p-8">
        Mesa não encontrada ou você não é o mestre dela.{" "}
        <Link href="/" className="underline">Voltar</Link>
      </main>
    );

  const set = (patch: Partial<Mesa>) => atualizarMesa(mesa.id, patch);

  const setSessao = (sid: string, patch: Partial<Sessao>) =>
    set({ sessoes: mesa.sessoes.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <nav className="flex items-center justify-between text-sm">
        <Link href="/" className="text-muted hover:underline">← Dashboard</Link>
        <div className="flex gap-4">
          <Link href={`/mesas/${mesa.id}/marcas`} className="text-muted hover:underline">
            Marcas de Pacto
          </Link>
          <Link href={`/mesas/${mesa.id}/jogador`} className="text-muted hover:underline">
            Ver como jogador →
          </Link>
        </div>
      </nav>

      <header className="space-y-3 border-l-4 pl-4" style={{ borderColor: mesa.cor }}>
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-500">
          Visão do mestre · convite: <code className="font-mono">{mesa.codigo}</code>
        </span>
        <input
          value={mesa.nome}
          onChange={(e) => set({ nome: e.target.value })}
          className="w-full bg-transparent text-3xl font-bold outline-none"
          aria-label="Nome da mesa"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={mesa.sistema}
            onChange={(e) => set({ sistema: e.target.value })}
            placeholder="Sistema"
            className={campo}
          />
          <select
            value={mesa.status}
            onChange={(e) => set({ status: e.target.value as Status })}
            className={campo}
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <textarea
          value={mesa.descricao}
          onChange={(e) => set({ descricao: e.target.value })}
          rows={3}
          placeholder="Descrição (visível aos jogadores)"
          className={campo}
        />
      </header>

      <Abas abas={ABAS} ativa={aba} onChange={setAba} />

      {aba === "mapas" && <MapasMestre mesa={mesa} />}

      {aba === "geral" && (
        <>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Jogadores</h2>
        {mesa.jogadores.map((j) => (
          <div key={j.id} className="space-y-2">
            <div className="flex gap-2">
              <input
                value={j.nome}
                onChange={(e) =>
                  set({ jogadores: mesa.jogadores.map((x) => (x.id === j.id ? { ...x, nome: e.target.value } : x)) })
                }
                placeholder="Jogador"
                className={campo}
              />
              <input
                value={j.personagem}
                onChange={(e) =>
                  set({ jogadores: mesa.jogadores.map((x) => (x.id === j.id ? { ...x, personagem: e.target.value } : x)) })
                }
                placeholder="Personagem"
                className={campo}
              />
              <button
                onClick={() => {
                  set({ jogadores: mesa.jogadores.filter((x) => x.id !== j.id) });
                  const resto = { ...segredos.notasJogadores };
                  delete resto[j.id];
                  atualizarSegredos({ ...segredos, notasJogadores: resto });
                }}
                aria-label="Remover jogador"
                className="px-2 text-muted hover:text-red-500"
              >
                ✕
              </button>
            </div>
            <LivroNotas
              paginas={paginasDe(segredos.notasJogadores?.[j.id])}
              onChange={(p) =>
                atualizarSegredos({
                  ...segredos,
                  notasJogadores: { ...segredos.notasJogadores, [j.id]: p },
                })
              }
              placeholder="🔒 Notas secretas sobre este jogador (só o mestre vê)"
            />
          </div>
        ))}
        <button
          onClick={() => set({ jogadores: [...mesa.jogadores, { id: uid(), nome: "", personagem: "" }] })}
          className="text-sm text-violet-500 hover:underline"
        >
          + Adicionar jogador
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Sessões</h2>
        {mesa.sessoes.map((s) => (
          <div key={s.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              <input
                value={s.titulo}
                onChange={(e) => setSessao(s.id, { titulo: e.target.value })}
                placeholder="Título da sessão"
                className={campo}
              />
              <input
                type="date"
                value={s.data}
                onChange={(e) => setSessao(s.id, { data: e.target.value })}
                className={`${campo} max-w-44`}
              />
              <button
                onClick={() => set({ sessoes: mesa.sessoes.filter((x) => x.id !== s.id) })}
                aria-label="Remover sessão"
                className="px-2 text-muted hover:text-red-500"
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
              onChange={(e) =>
                atualizarSegredos({
                  ...segredos,
                  notasSessoes: { ...segredos.notasSessoes, [s.id]: e.target.value },
                })
              }
              rows={3}
              placeholder="🔒 Notas secretas do mestre"
              className={`${campo} border-amber-500/50`}
            />
          </div>
        ))}
        <button
          onClick={() =>
            set({
              sessoes: [
                ...mesa.sessoes,
                { id: uid(), titulo: "", data: "", resumoPublico: "" },
              ],
            })
          }
          className="text-sm text-violet-500 hover:underline"
        >
          + Adicionar sessão
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">🔒 Segredos da campanha</h2>
        <textarea
          value={segredos.segredosMestre}
          onChange={(e) => atualizarSegredos({ ...segredos, segredosMestre: e.target.value })}
          rows={6}
          placeholder="Tramas, vilões, reviravoltas… só você vê isto."
          className={`${campo} border-amber-500/50`}
        />
      </section>
        </>
      )}
    </main>
  );
}
