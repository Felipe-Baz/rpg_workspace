"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { STATUS_LABEL } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import { gruposNav } from "../shell/navegacao";

function formatarData(d: string) {
  if (!d) return "sem data";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

export default function VisaoGeral() {
  const mesa = useMesaAtual();
  const base = `/mesas/${mesa.id}`;
  const ultima = [...mesa.sessoes].sort((a, b) => b.data.localeCompare(a.data))[0];
  const atalhos = gruposNav(base).grupos.flatMap((g) => g.itens).slice(0, 6);

  const passos = [
    { ok: !!mesa.sistema, texto: "Defina o sistema de jogo", href: `${base}/configuracoes` },
    { ok: mesa.jogadores.length > 0, texto: "Convide ou adicione jogadores", href: `${base}/jogadores` },
    { ok: mesa.sessoes.length > 0, texto: "Registre a primeira sessão", href: `${base}/sessoes` },
  ];

  return (
    <div className="space-y-8">
      <header
        className="relative overflow-hidden rounded-2xl border border-border p-6 sm:p-8"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${mesa.cor} 35%, var(--card)), var(--card) 70%)` }}
      >
        <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs">{STATUS_LABEL[mesa.status]}</span>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-wide sm:text-4xl">{mesa.nome || "Mesa sem nome"}</h1>
        <p className="mt-1 text-muted">
          {mesa.sistema || "Sistema não informado"} · {mesa.jogadores.length} jogador(es) · {mesa.sessoes.length} sessão(ões)
        </p>
        {mesa.descricao && <p className="mt-4 max-w-2xl">{mesa.descricao}</p>}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Última sessão</h2>
          {ultima ? (
            <>
              <p className="font-medium">
                {ultima.titulo || "Sem título"} <span className="text-sm font-normal text-muted">· {formatarData(ultima.data)}</span>
              </p>
              <p className="mt-2 line-clamp-4 text-sm text-muted">{ultima.resumoPublico || "Sem resumo público."}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Nenhuma sessão registrada ainda.</p>
          )}
          <Link href={`${base}/sessoes`} className="mt-3 inline-flex items-center gap-1 text-sm text-accent-hover hover:underline">
            Ver sessões <ArrowRight size={14} />
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">Para começar</h2>
          <ul className="space-y-2">
            {passos.map((p) => (
              <li key={p.texto}>
                <Link href={p.href} className="flex items-center gap-3 text-sm hover:text-accent-hover">
                  {p.ok ? <Check size={16} className="text-ok" /> : <Circle size={16} className="text-muted" />}
                  <span className={p.ok ? "text-muted line-through" : ""}>{p.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Atalhos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {atalhos.map((a) => (
            <Link key={a.href} href={a.href} className="elevar flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <a.icone size={20} className="text-gold" /> <span className="font-medium">{a.rotulo}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
