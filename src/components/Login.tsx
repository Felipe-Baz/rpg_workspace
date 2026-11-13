"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  criarConta,
  entrarComEmail,
  entrarComGoogle,
  mensagemErro,
  useAuth,
} from "@/lib/auth";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2";

export default function Login() {
  const { user } = useAuth();
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function executar(fn: () => Promise<unknown>) {
    setErro("");
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

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">RPG Workspace</h1>
        <p className="text-muted">Entre para acessar suas mesas.</p>
      </div>

      <form onSubmit={enviar} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">{modo === "entrar" ? "Entrar" : "Criar conta"}</h2>
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
          Senha
          <input
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            className={campo}
          />
        </label>
        {erro && <p role="alert" className="text-sm text-red-500">{erro}</p>}
        <button
          disabled={ocupado}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => executar(entrarComGoogle)}
          className="w-full rounded-lg border border-border px-4 py-2 font-medium hover:bg-border/50 disabled:opacity-60"
        >
          Continuar com Google
        </button>
      </form>

      <button
        onClick={() => {
          setErro("");
          setModo(modo === "entrar" ? "criar" : "entrar");
        }}
        className="text-sm text-muted hover:underline"
      >
        {modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
    </main>
  );
}
