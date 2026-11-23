"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { assumirPersonagem, criarPersonagem, type Mesa } from "@/lib/mesas";
import { campo } from "./Titulo";

// Primeiro acesso do jogador: assumir um personagem cadastrado pelo mestre ou criar o seu.
export default function EscolherPersonagem({ mesa, uid, nomeConta }: { mesa: Mesa; uid: string; nomeConta: string }) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const livres = mesa.jogadores.filter((j) => !j.uid);

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
    executar(() => criarPersonagem(mesa.id, uid, String(f.get("nome")).trim(), String(f.get("personagem")).trim()));
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" style={{ background: `radial-gradient(ellipse at 50% -20%, color-mix(in srgb, ${mesa.cor} 40%, transparent), transparent 70%)` }} />
      <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10 sm:px-6">
        <Link href="/mesas" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft size={14} /> Minhas mesas</Link>
        <header className="anim-surgir">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Você foi convidado para</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">{mesa.nome}</h1>
          <p className="mt-2 text-muted">Quem é você nesta mesa?</p>
        </header>

        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}

        {livres.length > 0 && (
          <section className="anim-surgir space-y-3" style={{ "--d": "100ms" } as React.CSSProperties}>
            <h2 className="font-semibold">Assumir um personagem existente</h2>
            <ul className="space-y-2">
              {livres.map((j) => (
                <li key={j.id}>
                  <button
                    disabled={ocupado}
                    onClick={() => executar(() => assumirPersonagem(mesa.id, j.id, uid, nomeConta))}
                    className="elevar flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left disabled:opacity-60"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-2 text-gold"><UserRound size={18} /></span>
                    <span>
                      <span className="block font-medium">{j.personagem || "Personagem sem nome"}</span>
                      {j.nome && <span className="block text-sm text-muted">{j.nome}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form onSubmit={criar} className="anim-surgir space-y-3 rounded-xl border border-border bg-card p-5" style={{ "--d": "200ms" } as React.CSSProperties}>
          <h2 className="font-semibold">Ou criar o meu personagem</h2>
          <label className="block text-sm">
            Seu nome
            <input name="nome" required defaultValue={nomeConta} className={`${campo} mt-1`} />
          </label>
          <label className="block text-sm">
            Nome do personagem
            <input name="personagem" required className={`${campo} mt-1`} />
          </label>
          <button disabled={ocupado} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60">
            Criar personagem
          </button>
        </form>
      </main>
    </div>
  );
}
