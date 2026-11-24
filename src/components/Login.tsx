"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Map as MapIcon, Users, WandSparkles } from "lucide-react";
import {
  criarConta,
  entrarComEmail,
  entrarComGoogle,
  mensagemErro,
  redefinirSenha,
  useAuth,
} from "@/lib/auth";
import Brasas from "./landing/Brasas";
import { LogoCompleta, LogoIcone } from "./Logo";
import ThemeToggle from "./ThemeToggle";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2.5 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const PONTOS = [
  { icone: MapIcon, texto: "Mapas e cenas editáveis, com criação por IA" },
  { icone: Users, texto: "Convide jogadores por código e libere só o que quiser" },
  { icone: WandSparkles, texto: "Mundo, missões e fichas em um só workspace" },
];

export default function Login() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [modo, setModo] = useState<"entrar" | "criar">(params.get("modo") === "criar" ? "criar" : "entrar");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (user) router.replace("/mesas");
  }, [user, router]);

  async function executar(fn: () => Promise<unknown>) {
    setErro("");
    setAviso("");
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const senha = String(f.get("senha"));
    executar(() =>
      modo === "entrar"
        ? entrarComEmail(email, senha)
        : criarConta(String(f.get("nome")).trim(), email, senha),
    );
  }

  function esqueci(form: HTMLFormElement | null) {
    const email = form ? String(new FormData(form).get("email") ?? "").trim() : "";
    if (!email) {
      setErro("Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    executar(async () => {
      await redefinirSenha(email);
      setAviso("Enviamos um link de redefinição para o seu e-mail.");
    });
  }

  return (
    <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca */}
      <aside className="relative isolate hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_0%,color-mix(in_srgb,var(--accent)_40%,transparent),transparent_60%),radial-gradient(ellipse_at_80%_90%,color-mix(in_srgb,var(--gold)_18%,transparent),transparent_55%)]" />
        <Brasas quantidade={45} />
        <span aria-hidden />
        <div className="anim-surgir max-w-md">
          <LogoCompleta altura={150} className="mb-6 drop-shadow-[0_0_30px_color-mix(in_srgb,var(--gold)_30%,transparent)]" />
          <h2 className="font-display text-4xl font-bold leading-tight tracking-wide">
            Sua campanha, <span className="text-gold">inteira</span> em um só lugar.
          </h2>
          <ul className="mt-8 space-y-4">
            {PONTOS.map((p, i) => (
              <li key={p.texto} className="anim-surgir flex items-center gap-3 text-muted" style={{ "--d": `${200 + i * 120}ms` } as React.CSSProperties}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card/70 text-gold backdrop-blur">
                  <p.icone size={18} />
                </span>
                {p.texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">Para mestres e jogadores, em qualquer sistema.</p>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-col justify-center px-4 py-12 sm:px-12">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="mx-auto w-full max-w-sm space-y-5">
          <div>
            <Link href="/" className="mb-6 flex items-center gap-2 font-display text-lg font-semibold tracking-wide lg:hidden">
              <LogoIcone altura={30} /> RPG Workspace
            </Link>
            <h1 className="font-display text-3xl font-bold tracking-wide">{modo === "entrar" ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
            <p className="mt-1 text-sm text-muted">
              {modo === "entrar" ? "Entre para acessar suas mesas." : "Leva menos de um minuto. Seu papel é definido em cada mesa."}
            </p>
          </div>

          <button
            type="button"
            disabled={ocupado}
            onClick={() => executar(entrarComGoogle)}
            className="w-full rounded-lg border border-border px-4 py-2.5 font-medium hover:border-accent-hover hover:bg-card disabled:opacity-60"
          >
            Continuar com Google
          </button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />ou com e-mail<span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={enviar} className="space-y-3">
            {modo === "criar" && (
              <label className="block text-sm">
                Nome
                <input name="nome" required className={campo} />
              </label>
            )}
            <label className="block text-sm">
              E-mail
              <input name="email" type="email" required autoComplete="email" className={campo} />
            </label>
            <label className="block text-sm">
              <span className="flex items-center justify-between">
                Senha
                {modo === "entrar" && (
                  <button type="button" onClick={(e) => esqueci(e.currentTarget.closest("form"))} className="text-xs text-accent-hover hover:underline">
                    Esqueci minha senha
                  </button>
                )}
              </span>
              <input
                name="senha"
                type="password"
                required
                minLength={6}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                className={campo}
              />
            </label>
            {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
            {aviso && <p role="status" className="text-sm text-ok">{aviso}</p>}
            <button
              disabled={ocupado}
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-white shadow-lg shadow-accent/25 hover:bg-accent-strong disabled:opacity-60"
            >
              {ocupado ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            onClick={() => { setErro(""); setAviso(""); setModo(modo === "entrar" ? "criar" : "entrar"); }}
            className="text-sm text-muted hover:text-foreground"
          >
            {modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </div>
      </main>
    </div>
  );
}
