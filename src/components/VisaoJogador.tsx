"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import EditorMarkdown from "./EditorMarkdown";
import Markdown from "./Markdown";
import LivroNotas from "./LivroNotas";
import Abas from "./Abas";
import MapasJogador from "./mapas/MapasJogador";
import QuadroJogador from "./quadro/QuadroJogador";
import Mundo from "./Mundo";
import FichasJogador from "./fichas/FichasJogador";
import { CATEGORIAS, type CategoriaFicha } from "@/lib/fichas";
import MarcasSecao from "./marcas/MarcasSecao";
import { STATUS_LABEL, paginasDe, assumirPersonagem, criarPersonagem, useAnotacoes, useMesas, type Mesa } from "@/lib/mesas";

function formatarData(d: string) {
  if (!d) return "Sem data";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

export default function VisaoJogador({ id }: { id: string }) {
  const { user } = useAuth();
  const [aba, setAba] = useState<"geral" | "mapas" | "mundo" | "quadro" | CategoriaFicha>("geral");
  const { mesas, pronto } = useMesas();
  const mesa = mesas.find((m) => m.id === id);
  const { notas, notasJogadores, carregado, definirNota, definirNotaJogador } = useAnotacoes(id, user?.uid ?? "", !!user && !!mesa);

  if (!pronto) return null;
  if (!mesa)
    return (
      <main className="p-8">
        Mesa não encontrada. <Link href="/" className="underline">Voltar</Link>
      </main>
    );

  const souMestre = mesa.donoUid === user?.uid;
  const escolher = !!user && !souMestre && !mesa.jogadores.some((j) => j.uid === user.uid);

  if (escolher)
    return (
      <EscolherPersonagem
        mesa={mesa}
        uid={user.uid}
        nomeConta={user.displayName || user.email || ""}
      />
    );

  const sessoes = [...mesa.sessoes].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <main className={`mx-auto w-full space-y-8 px-4 py-8 sm:px-6 ${aba === "quadro" ? "max-w-6xl" : "max-w-3xl"}`}>
      <nav className="flex items-center justify-between text-sm">
        <Link href="/" className="text-muted hover:underline">← Dashboard</Link>
        {mesa.donoUid === user?.uid ? (
          <Link href={`/mesas/${mesa.id}/mestre`} className="text-muted hover:underline">
          Ver como mestre →
        </Link>
        ) : (
          <span />
        )}
      </nav>

      <header className="space-y-1 border-l-4 pl-4" style={{ borderColor: mesa.cor }}>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Visão do jogador · {STATUS_LABEL[mesa.status]}
        </span>
        <h1 className="text-3xl font-bold">{mesa.nome}</h1>
        <p className="text-muted">{mesa.sistema || "Sistema não informado"}</p>
        {mesa.descricao && <p className="pt-2">{mesa.descricao}</p>}
      </header>

      <Abas
        abas={[
          { id: "geral", rotulo: "Geral" },
          { id: "mapas", rotulo: "Mapas" },
          { id: "mundo", rotulo: "Mundo" },
          { id: "quadro", rotulo: "Quadro" },
          ...CATEGORIAS.map((c) => ({ id: c.id, rotulo: c.rotulo })),
        ]}
        ativa={aba}
        onChange={setAba}
      />

      {aba === "mundo" && <Mundo mesaId={mesa.id} ehMestre={false} />}

      {aba === "quadro" && user && <QuadroJogador mesaId={mesa.id} usuarioUid={user.uid} />}

      {aba === "mapas" && user && <MapasJogador mesaId={mesa.id} usuarioUid={user.uid} />}

      {user &&
        CATEGORIAS.filter((c) => c.id === aba).map((c) => (
          <FichasJogador
            key={c.id}
            mesaId={mesa.id}
            usuarioUid={user.uid}
            categoria={c.id}
            rotulo={c.rotulo}
            singular={c.singular}
            icone={c.icone}
          />
        ))}

      {aba === "geral" && (
        <>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Grupo</h2>
        {mesa.jogadores.length === 0 ? (
          <p className="text-muted">Nenhum jogador cadastrado.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {mesa.jogadores.map((j) => (
              <li key={j.id} className="rounded-xl border border-border bg-card p-3">
                <p className="font-medium">
                  {j.personagem || "Personagem sem nome"}
                  {j.uid && j.uid === user?.uid && (
                    <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">você</span>
                  )}
                </p>
                <p className="text-sm text-muted">{j.nome || "—"}</p>
                {j.uid !== user?.uid && (
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

      <MarcasSecao mesaId={mesa.id} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Diário de sessões</h2>
        {sessoes.length === 0 ? (
          <p className="text-muted">Nenhuma sessão registrada ainda.</p>
        ) : (
          sessoes.map((s) => (
            <article key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{s.titulo || "Sessão sem título"}</h3>
                <time className="text-sm text-muted">{formatarData(s.data)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {s.resumoPublico || "Sem resumo."}
              </p>
              <NotasSessao
                texto={notas[s.id] ?? ""}
                carregado={carregado}
                onChange={(v) => definirNota(s.id, v)}
              />
            </article>
          ))
        )}
      </section>
        </>
      )}
    </main>
  );
}

function EscolherPersonagem({ mesa, uid, nomeConta }: { mesa: Mesa; uid: string; nomeConta: string }) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const livres = mesa.jogadores.filter((j) => !j.uid);
  const campo = "w-full rounded-lg border border-border bg-background px-3 py-2";

  async function executar(fn: () => Promise<void>) {
    setErro("");
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(false);
    }
  }

  function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    executar(() =>
      criarPersonagem(mesa.id, uid, String(f.get("nome")).trim(), String(f.get("personagem")).trim()),
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-8 px-4 py-8 sm:px-6">
      <nav className="text-sm">
        <Link href="/" className="text-muted hover:underline">← Dashboard</Link>
      </nav>
      <header className="space-y-1 border-l-4 pl-4" style={{ borderColor: mesa.cor }}>
        <h1 className="text-2xl font-bold">{mesa.nome}</h1>
        <p className="text-muted">Quem é você nesta mesa?</p>
      </header>

      {erro && <p role="alert" className="text-sm text-red-500">{erro}</p>}

      {livres.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Escolher um personagem existente</h2>
          <ul className="space-y-2">
            {livres.map((j) => (
              <li key={j.id}>
                <button
                  disabled={ocupado}
                  onClick={() => executar(() => assumirPersonagem(mesa.id, j.id, uid, nomeConta))}
                  className="w-full rounded-xl border border-border bg-card p-3 text-left hover:bg-border/50 disabled:opacity-60"
                >
                  <span className="font-medium">{j.personagem || "Personagem sem nome"}</span>
                  {j.nome && <span className="block text-sm text-muted">{j.nome}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={criar} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Ou criar meu personagem</h2>
        <label className="block text-sm">
          Seu nome
          <input name="nome" required defaultValue={nomeConta} className={campo} />
        </label>
        <label className="block text-sm">
          Nome do personagem
          <input name="personagem" required className={campo} />
        </label>
        <button
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          Criar personagem
        </button>
      </form>
    </main>
  );
}

function NotasSessao({
  texto,
  carregado,
  onChange,
}: {
  texto: string;
  carregado: boolean;
  onChange: (v: string) => void;
}) {
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
        <EditorMarkdown
          valor={texto}
          onChange={onChange}
          desabilitado={!carregado}
          placeholder={"# Título da sessão\n\nO que seu personagem viveu, descobriu, suspeita…"}
        />
      ) : texto.trim() ? (
        <Markdown texto={texto} />
      ) : (
        <p className="text-sm text-muted">Nenhuma anotação nesta sessão.</p>
      )}
    </div>
  );
}
