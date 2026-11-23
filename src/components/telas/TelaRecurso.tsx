"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { tituloDoRegistro, validarValores, type DefRecurso } from "@/lib/extensoes/efeitos";
import { definirLiberado, excluirRegistro, salvarRegistro, useRegistros, type RegistroRecurso } from "@/lib/extensoes/recursos";
import { useExtensoesContexto } from "../shell/ExtensoesContext";
import { useMesaAtual } from "../shell/MesaContext";
import Dialog from "../ui/Dialog";
import { confirmar } from "../ui/Dialogos";
import { ListaSkeleton } from "../ui/Skeleton";
import { toast } from "../ui/Toasts";
import Titulo, { campo } from "./Titulo";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Tela genérica de um tipo de dado criado por extensão: lista, busca e formulário gerados da definição.
export default function TelaRecurso({ modo }: { modo: "mestre" | "jogador" }) {
  const { extId, recId } = useParams<{ extId: string; recId: string }>();
  const { efeitos } = useExtensoesContexto();
  const def = efeitos.recursos.find((r) => r.extId === extId && r.id === recId);
  const mesa = useMesaAtual();
  const base = modo === "mestre" ? `/mesas/${mesa.id}` : `/mesas/${mesa.id}/jogador`;

  if (!def)
    return (
      <p className="text-muted">
        Este tipo de dado não existe ou a extensão está desativada. <Link href={base} className="underline">Voltar</Link>
      </p>
    );
  return <Conteudo def={def} extId={extId} modo={modo} />;
}

function Conteudo({ def, extId, modo }: { def: DefRecurso & { extTitulo: string }; extId: string; modo: "mestre" | "jogador" }) {
  const mesa = useMesaAtual();
  const mestre = modo === "mestre";
  const { registros, carregado } = useRegistros(mesa.id, extId, def.id, mestre);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<RegistroRecurso | "novo" | null>(null);
  const q = norm(busca.trim());
  const lista = registros.filter((r) => !q || norm(Object.values(r.valores).join(" ")).includes(q));

  return (
    <>
      <Titulo
        titulo={def.plural}
        texto={`Criado pela extensão “${def.extTitulo}”.${mestre ? " Cada registro só aparece aos jogadores se você liberar." : ""}`}
        acao={
          mestre && (
            <button onClick={() => setEditando("novo")} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong">
              <Plus size={16} /> Novo {def.singular.toLowerCase()}
            </button>
          )
        }
      />
      <label className="relative mb-4 block max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar em ${def.plural.toLowerCase()}…`} aria-label="Buscar" className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm" />
      </label>

      {!carregado ? (
        <ListaSkeleton />
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
          {registros.length ? "Nada encontrado." : mestre ? `Nenhum registro ainda. Crie o primeiro ${def.singular.toLowerCase()}.` : `O mestre ainda não liberou nenhum registro de ${def.plural.toLowerCase()}.`}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lista.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">{tituloDoRegistro(def, r.valores)}</h2>
                {mestre && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => definirLiberado(mesa.id, r.id, !r.liberado)} aria-label={r.liberado ? "Ocultar dos jogadores" : "Liberar para jogadores"} title={r.liberado ? "Visível aos jogadores" : "Só você vê"} className="p-1.5 text-muted hover:text-foreground">
                      {r.liberado ? <Eye size={15} className="text-ok" /> : <EyeOff size={15} />}
                    </button>
                    <button onClick={() => setEditando(r)} aria-label="Editar" className="p-1.5 text-muted hover:text-foreground"><Pencil size={15} /></button>
                    <button
                      onClick={async () => {
                        if (await confirmar({ perigo: true, titulo: `Excluir ${def.singular.toLowerCase()}`, texto: `“${tituloDoRegistro(def, r.valores)}” será excluído.`, confirmar: "Excluir" })) excluirRegistro(mesa.id, r.id);
                      }}
                      aria-label="Excluir"
                      className="p-1.5 text-muted hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                {def.campos.map((c) =>
                  r.valores[c.id] === undefined ? null : (
                    <div key={c.id} className="flex gap-2">
                      <dt className="shrink-0 text-muted">{c.rotulo}:</dt>
                      <dd className="min-w-0 whitespace-pre-wrap break-words">{String(r.valores[c.id])}</dd>
                    </div>
                  ),
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {editando && <Formulario def={def} extId={extId} inicial={editando === "novo" ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
}

function Formulario({ def, extId, inicial, onClose }: { def: DefRecurso; extId: string; inicial: RegistroRecurso | null; onClose: () => void }) {
  const mesa = useMesaAtual();
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = validarValores(def, Object.fromEntries(def.campos.map((c) => [c.id, f.get(c.id) ?? ""])));
    if (!v.ok) return setErro(v.erro);
    setOcupado(true);
    try {
      await salvarRegistro(mesa.id, { id: inicial?.id, extId, recursoId: def.id, valores: v.valores, liberado: inicial?.liberado, criadoEm: inicial?.criadoEm });
      toast(`${def.singular} salvo`);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setOcupado(false);
    }
  }

  return (
    <Dialog titulo={inicial ? `Editar ${def.singular.toLowerCase()}` : `Novo ${def.singular.toLowerCase()}`} onClose={onClose} largura="max-w-lg">
      <form onSubmit={enviar} className="space-y-3">
        {def.campos.map((c) => (
          <label key={c.id} className="block text-sm">
            {c.rotulo}
            {c.tipo === "longo" ? (
              <textarea name={c.id} rows={4} defaultValue={String(inicial?.valores[c.id] ?? "")} className={`${campo} mt-1`} />
            ) : c.tipo === "selecao" ? (
              <select name={c.id} defaultValue={String(inicial?.valores[c.id] ?? "")} className={`${campo} mt-1`}>
                <option value="">—</option>
                {c.opcoes.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input name={c.id} type={c.tipo === "numero" ? "number" : "text"} step="any" defaultValue={String(inicial?.valores[c.id] ?? "")} className={`${campo} mt-1`} />
            )}
          </label>
        ))}
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancelar</button>
          <button disabled={ocupado} className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60">Salvar</button>
        </div>
      </form>
    </Dialog>
  );
}
