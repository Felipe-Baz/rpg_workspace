"use client";

import { toast } from "../ui/Toasts";
import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Eye, LogOut, MoreHorizontal, Trash2, Users } from "lucide-react";
import { STATUS_LABEL, type Mesa } from "@/lib/mesas";

const DIA = 86_400_000;

export function quandoFoi(sessoes: Mesa["sessoes"], agora: number): string {
  const datas = sessoes.map((s) => s.data).filter(Boolean).sort();
  const ultima = datas[datas.length - 1];
  if (!ultima) return "Nenhuma sessão ainda";
  const dias = Math.floor((agora - new Date(`${ultima}T12:00:00`).getTime()) / DIA);
  if (dias <= 0) return "Última sessão: hoje";
  if (dias === 1) return "Última sessão: ontem";
  if (dias < 31) return `Última sessão: há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return `Última sessão: há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

// Padrão geométrico discreto para a capa (hexágonos), sobre o gradiente da cor da mesa.
const PADRAO = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='64'><path d='M28 2l24 14v32L28 62 4 48V16z' fill='none' stroke='white' stroke-opacity='0.12' stroke-width='1.5'/></svg>\")";

export default function CardMesa({ mesa, mestre, agora, atraso, onRemover }: { mesa: Mesa; mestre: boolean; agora: number; atraso: number; onRemover: () => void }) {
  const [menu, setMenu] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const arquivada = mesa.status === "pausada" || mesa.status === "encerrada";
  const href = mestre ? `/mesas/${mesa.id}` : `/mesas/${mesa.id}/jogador`;

  // O status é a informação principal: ativa = borda viva; planejando = tracejada; arquivo = esmaecida.
  const estado = mesa.status === "ativa"
    ? "border-solid"
    : mesa.status === "planejando"
      ? "border-dashed"
      : "border-solid opacity-70 saturate-50 hover:opacity-100 hover:saturate-100";

  async function copiar() {
    try { await navigator.clipboard.writeText(mesa.codigo); setCopiado(true); toast("Código de convite copiado"); setTimeout(() => setCopiado(false), 1600); } catch {}
  }

  return (
    <li className="anim-surgir relative" style={{ "--d": `${atraso}ms` } as React.CSSProperties}>
      <Link
        href={href}
        className={`elevar group flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-card ${estado}`}
        style={{ borderColor: arquivada ? "var(--border)" : `color-mix(in srgb, ${mesa.cor} ${mesa.status === "ativa" ? 70 : 50}%, var(--border))`, boxShadow: mesa.status === "ativa" ? `0 10px 30px -18px ${mesa.cor}` : undefined }}
      >
        <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${mesa.cor}, color-mix(in srgb, ${mesa.cor} 30%, #0b0910))` }}>
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: PADRAO }} />
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${mesa.status === "ativa" ? "bg-ok" : mesa.status === "planejando" ? "bg-warn" : "bg-muted"}`} style={mesa.status === "ativa" ? { animation: "brilho 2s infinite" } : undefined} />
            {STATUS_LABEL[mesa.status]}
          </span>
          <span className="absolute -bottom-5 right-4 font-display text-7xl font-bold text-white/15">{(mesa.nome || "?").trim().charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className="font-display text-lg font-semibold leading-tight tracking-wide">{mesa.nome || "Sem nome"}</h2>
          <p className="text-sm text-muted">{mesa.sistema || "Sistema não informado"}</p>
          <p className="line-clamp-2 flex-1 text-sm">{mesa.descricao || <span className="text-muted">Sem descrição.</span>}</p>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><Users size={13} /> {mesa.jogadores.length}</span>
            <span>{quandoFoi(mesa.sessoes, agora)}</span>
          </div>
        </div>
      </Link>

      {/* Menu de contexto */}
      <button
        onClick={() => setMenu(!menu)}
        aria-label={`Ações de ${mesa.nome}`}
        aria-expanded={menu}
        className="absolute right-3 top-3 rounded-full bg-black/45 p-1.5 text-white backdrop-blur hover:bg-black/70"
      >
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="anim-surgir absolute right-3 top-12 z-20 w-52 space-y-0.5 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
            {mestre && (
              <button onClick={copiar} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-card-2">
                {copiado ? <Check size={14} className="text-ok" /> : <Copy size={14} />} Código: <code className="font-mono font-semibold">{mesa.codigo}</code>
              </button>
            )}
            {mestre && (
              <Link href={`/mesas/${mesa.id}/jogador`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-card-2">
                <Eye size={14} /> Ver como jogador
              </Link>
            )}
            <button onClick={() => { setMenu(false); onRemover(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-card-2">
              {mestre ? <Trash2 size={14} /> : <LogOut size={14} />} {mestre ? "Excluir mesa" : "Sair da mesa"}
            </button>
          </div>
        </>
      )}
    </li>
  );
}
