"use client";

import { useState } from "react";
import { useUidJogador } from "../shell/VisaoJogadorContext";
import { STATUS_LABEL, paginasDe, useAnotacoes } from "@/lib/mesas";
import AvatarPersonagem from "../AvatarPersonagem";
import EditorMarkdown from "../EditorMarkdown";
import LivroNotas from "../LivroNotas";
import Markdown from "../Markdown";
import MarcasSecao from "../marcas/MarcasSecao";
import { nativaVisivel } from "@/lib/extensoes/nativas";
import { useExtensoesContexto } from "../shell/ExtensoesContext";
import { useMesaAtual } from "../shell/MesaContext";
import Slot from "../shell/Slot";

function formatarData(d: string) {
  if (!d) return "Sem data";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

// Tela inicial do jogador: apresentação da mesa, grupo, Marcas e diário de sessões com anotações privadas.
export default function DiarioJogador() {
  const { uid, vendoComo } = useUidJogador();
  const mesa = useMesaAtual();
  const { nativas, souMestre } = useExtensoesContexto();
  const { notas, notasJogadores, carregado, definirNota, definirNotaJogador } = useAnotacoes(mesa.id, uid, !!uid, vendoComo);
  const sessoes = [...mesa.sessoes].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="space-y-10">
      <header
        className="rounded-2xl border border-border p-6 sm:p-8"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${mesa.cor} 30%, var(--card)), var(--card) 70%)` }}
      >
        <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs">{STATUS_LABEL[mesa.status]}</span>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-wide sm:text-4xl">{mesa.nome}</h1>
        <p className="mt-1 text-muted">{mesa.sistema || "Sistema não informado"}</p>
        {mesa.descricao && <p className="mt-4 max-w-2xl">{mesa.descricao}</p>}
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-wide">Grupo</h2>
        {mesa.jogadores.length === 0 ? (
          <p className="text-muted">Nenhum jogador cadastrado.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {mesa.jogadores.map((j) => (
              <li key={j.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <AvatarPersonagem mesaId={mesa.id} jogadorId={j.id} foto={j.foto} nome={j.personagem || j.nome} editavel={j.uid === uid} />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {j.personagem || "Personagem sem nome"}
                      {j.uid && j.uid === uid && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-white">você</span>}
                    </p>
                    <p className="text-sm text-muted">{j.nome || "—"}</p>
                  </div>
                </div>
                {j.uid !== uid && (
                  <LivroNotas
                    className="mt-2"
                    paginas={paginasDe(notasJogadores[j.id])}
                    onChange={(p) => definirNotaJogador(j.id, p)}
                    desabilitado={!carregado}
                    placeholder="🔒 O que você descobriu sobre este jogador (só você vê)"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Encaixe "diário do jogador" da extensão nativa Marcas de Pacto (só na mesa autorizada) */}
      {nativaVisivel(mesa.id, "marcas-de-pacto", souMestre ? "mestre" : "jogador", nativas) && <MarcasSecao mesaId={mesa.id} />}

      <Slot nome="diario.jogador" />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-wide">Diário de sessões</h2>
        {sessoes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">Nenhuma sessão registrada ainda.</p>
        ) : (
          sessoes.map((s) => (
            <article key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{s.titulo || "Sessão sem título"}</h3>
                <time className="text-sm text-muted">{formatarData(s.data)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{s.resumoPublico || "Sem resumo."}</p>
              <NotasSessao texto={notas[s.id] ?? ""} carregado={carregado} onChange={(v) => definirNota(s.id, v)} />
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function NotasSessao({ texto, carregado, onChange }: { texto: string; carregado: boolean; onChange: (v: string) => void }) {
  const [editando, setEditando] = useState(false);

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          Minhas anotações <span className="font-normal text-muted">(só você vê · Markdown)</span>
        </h4>
        <button
          onClick={() => setEditando((v) => !v)}
          disabled={!carregado}
          className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-border/50 disabled:opacity-50"
        >
          {editando ? "Concluir" : texto ? "Editar" : "Escrever"}
        </button>
      </div>
      {editando ? (
        <EditorMarkdown valor={texto} onChange={onChange} desabilitado={!carregado} placeholder={"# Título da sessão\n\nO que seu personagem viveu, descobriu, suspeita…"} />
      ) : texto.trim() ? (
        <Markdown texto={texto} />
      ) : (
        <p className="text-sm text-muted">Nenhuma anotação nesta sessão.</p>
      )}
    </div>
  );
}
