"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { FichaDnd } from "@/lib/dnd5e";
import type { Catalogo } from "@/lib/regras/dnd5e/catalogo";
import {
  NIVEL_PACTO, PACTOS, armaDoPactoDaFicha, armasParaPacto, definirArmaPacto, definirInvocacoes, invocacoesConhecidas, invocacoesDaFicha, nivelDeBruxo, nomeDoPacto, pactoDaFicha,
  requisitosFaltando, rotuloUsoInvocacao, truquesDaFicha, type ContextoInvocacao,
} from "@/lib/regras/dnd5e/invocacoes";
import TextoLivro from "./TextoLivro";

const secao = "rounded-xl border border-border bg-background/40 p-3";
const titulo = "font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold";

/** Escolha da Dádiva do Pacto (3º nível do bruxo). */
export function SeletorPacto({ valor, onChange }: { valor: string | undefined; onChange: (id: string) => void }) {
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label="Dádiva do Pacto">
      {PACTOS.map((p) => (
        <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" name="pacto" checked={valor === p.id} onChange={() => onChange(p.id)} className="mt-1" />
          <span><strong>{p.nome}</strong> <span className="text-xs text-muted">{p.resumo}</span></span>
        </label>
      ))}
    </div>
  );
}

/**
 * Lista das invocações do livro para marcar. Pré-requisito não atendido desabilita a marcação (o mestre pode liberar);
 * no limite, só dá para desmarcar. `podeRemover` falso deixa as já escolhidas travadas (ficha publicada).
 */
export function SeletorInvocacoes({ cat, selecionadas, limite, ctx, onChange, liberado = false, podeRemover = true }: {
  cat: Catalogo; selecionadas: string[]; limite: number; ctx: ContextoInvocacao; onChange: (ids: string[]) => void; liberado?: boolean; podeRemover?: boolean;
}) {
  const lista = cat.invocacoes();
  const cheio = selecionadas.length >= limite;
  return (
    <div>
      <p className="mb-1 text-xs text-muted">
        <strong className={selecionadas.length > limite ? "text-danger" : "text-gold"}>{selecionadas.length}/{limite}</strong> escolhidas. Pré-requisitos de nível usam o nível de bruxo; dá para aprender junto com o pré-requisito.
      </p>
      <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
        {lista.map((inv) => {
          const marcada = selecionadas.includes(inv.id);
          const falta = requisitosFaltando(inv, ctx);
          const bloqueada = marcada ? !podeRemover : (cheio || (falta.length > 0 && !liberado));
          return (
            <li key={inv.id} className={`rounded-lg border px-2 py-1 ${marcada ? "border-gold/60 bg-gold/10" : "border-border"} ${bloqueada && !marcada ? "opacity-60" : ""}`}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox" checked={marcada} disabled={bloqueada} className="mt-1"
                  onChange={() => onChange(marcada ? selecionadas.filter((x) => x !== inv.id) : [...selecionadas, inv.id])}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{inv.nome}</span>{" "}
                  <span className="text-[11px] uppercase tracking-wider text-muted">{rotuloUsoInvocacao(inv.id)}</span>
                  {inv.requisitoTexto && <span className={`block text-xs ${falta.length ? "text-danger" : "text-muted"}`}>Pré-requisito: {inv.requisitoTexto}{falta.length ? ` (falta: ${falta.join(", ")})` : ""}</span>}
                </span>
              </label>
              <details className="ml-6">
                <summary className="cursor-pointer text-xs text-muted hover:text-foreground">Descrição</summary>
                <TextoLivro texto={inv.texto} className="mt-1" />
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Cartão da ficha (aba Traços) do bruxo: Dádiva do Pacto e Invocações Místicas escolhidas, com o que cada uma faz e
 * a edição. Trocar uma já escolhida é coisa de subida de nível (livro); aqui o jogador completa as que faltam e só o
 * mestre (ou ficha em rascunho) remove.
 */
export default function InvocacoesMisticas({ ficha: f, cat, papel, travada, onMudar }: {
  ficha: FichaDnd; cat: Catalogo; papel: "mestre" | "jogador"; travada: boolean; onMudar: (p: Partial<FichaDnd>) => void;
}) {
  const [editando, setEditando] = useState(false);
  const nivel = nivelDeBruxo(f);
  const b = f.build;
  if (!b || nivel < 2) return null;
  const escolhidas = invocacoesDaFicha(f);
  const pacto = pactoDaFicha(f);
  const limite = invocacoesConhecidas(nivel);
  const ctx: ContextoInvocacao = { nivelBruxo: nivel, pacto, truques: truquesDaFicha(f) };
  const faltam = limite - escolhidas.length;
  const mudar = (ids: string[], p?: string) => onMudar({ build: definirInvocacoes(b, ids, p) });

  return (
    <section className={secao} aria-label="Invocações Místicas">
      <div className="flex items-center gap-2">
        <h2 className={titulo}>Invocações Místicas {escolhidas.length}/{limite}</h2>
        <button onClick={() => setEditando(!editando)} className="ml-auto inline-flex items-center gap-1 text-xs text-accent-hover hover:underline">
          <Pencil size={13} /> {editando ? "Fechar" : "Escolher"}
        </button>
      </div>
      {faltam > 0 && !editando && <p className="mt-1 text-xs text-gold">Faltam {faltam} invocação(ões) para escolher.</p>}
      {nivel >= NIVEL_PACTO && (
        <p className="mt-1 text-sm">
          <strong>Dádiva do Pacto:</strong> {pacto ? <>{nomeDoPacto(pacto)} <span className="text-xs text-muted">{PACTOS.find((p) => p.id === pacto)?.resumo}</span></> : <span className="text-gold">não escolhida</span>}
        </p>
      )}
      {pacto === "lamina" && (
        <label className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <strong>Arma do pacto:</strong>
          <select
            value={armaDoPactoDaFicha(f) ?? ""} onChange={(e) => onMudar({ build: definirArmaPacto(b, e.target.value) })}
            aria-label="Forma da arma do pacto" className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">Escolha a forma…</option>
            {armasParaPacto(cat).map((a) => <option key={a.id} value={a.id}>{a.nome} ({a.dado} {a.tipoDano})</option>)}
          </select>
          <span className="text-xs text-muted">Aparece nos ataques; troque quando criar a arma de novo.</span>
        </label>
      )}
      {!editando && escolhidas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {escolhidas.map((id) => {
            const inv = cat.invocacao(id);
            return (
              <li key={id}>
                <details>
                  <summary className="cursor-pointer text-sm"><strong>{inv?.nome ?? id}</strong> <span className="text-[11px] uppercase tracking-wider text-muted">{rotuloUsoInvocacao(id)}</span></summary>
                  {inv && <TextoLivro texto={inv.texto} className="mt-1" />}
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {editando && (
        <div className="mt-2 space-y-3">
          {nivel >= NIVEL_PACTO && (!pacto || !travada) && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Dádiva do Pacto</h3>
              <SeletorPacto valor={pacto} onChange={(p) => mudar(escolhidas, p)} />
            </div>
          )}
          <SeletorInvocacoes
            cat={cat} selecionadas={escolhidas} limite={limite} ctx={ctx} liberado={papel === "mestre"} podeRemover={!travada}
            onChange={(ids) => mudar(ids)}
          />
          {travada && <p className="text-xs text-muted">Ficha publicada: você completa as que faltam; trocar uma já escolhida é feito ao subir de nível (ou pelo mestre).</p>}
        </div>
      )}
    </section>
  );
}
