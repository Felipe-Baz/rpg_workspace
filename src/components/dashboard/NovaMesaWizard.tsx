"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CORES, STATUS_LABEL, criarMesa, type Status } from "@/lib/mesas";
import Dialog from "../ui/Dialog";

const SISTEMAS = ["D&D 5e", "Tormenta20", "Pathfinder 2e", "Call of Cthulhu", "Vampiro", "Sistema próprio"];
const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Cadastro da mesa em uma tela só: só o nome é obrigatório; o resto tem padrões e dá para editar depois.
export default function NovaMesaWizard({ uid, onClose }: { uid: string; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [sistema, setSistema] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [status, setStatus] = useState<Status>("planejando");
  const [descricao, setDescricao] = useState("");
  const [mais, setMais] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      const id = await criarMesa(uid, { nome: nome.trim(), sistema: sistema.trim(), descricao: descricao.trim(), status, cor });
      onClose();
      router.push(`/mesas/${id}`);
    } catch {
      setErro("Não foi possível criar a mesa. Tente novamente.");
      setOcupado(false);
    }
  }

  return (
    <Dialog titulo="Nova mesa" onClose={onClose} largura="max-w-3xl">
      <form onSubmit={enviar} className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <label className="block text-sm">
            Nome da mesa
            <input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="O Juramento de Cinzas" className={`${campo} mt-1`} />
          </label>

          <div className="text-sm">
            Sistema
            <input value={sistema} onChange={(e) => setSistema(e.target.value)} placeholder="Escolha abaixo ou digite" className={`${campo} mt-1`} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SISTEMAS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSistema(s === "Sistema próprio" ? "" : s)}
                  className={`rounded-full border px-3 py-1 text-xs ${sistema === s ? "border-accent bg-accent/15 text-accent-soft" : "border-border text-muted hover:border-accent-hover hover:text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm">
            Cor
            <div className="mt-2 flex gap-2">
              {CORES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCor(c)}
                  aria-label={`Cor ${c}`}
                  aria-pressed={c === cor}
                  className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, outline: c === cor ? "2px solid currentColor" : "none", outlineOffset: 2 }}
                />
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setMais(!mais)} className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ChevronDown size={14} className={`transition-transform ${mais ? "rotate-180" : ""}`} /> Mais opções
          </button>
          {mais && (
            <div className="anim-surgir space-y-3">
              <label className="block text-sm">
                Status inicial
                <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={`${campo} mt-1`}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                Descrição
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={`${campo} mt-1`} />
              </label>
            </div>
          )}
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        </div>

        {/* Pré-visualização do card */}
        <div className="hidden flex-col md:flex">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">Pré-visualização</p>
          <div className="overflow-hidden rounded-2xl border-2 bg-card" style={{ borderColor: `color-mix(in srgb, ${cor} 60%, var(--border))`, borderStyle: status === "planejando" ? "dashed" : "solid" }}>
            <div className="h-20 transition-[background] duration-500" style={{ background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 30%, #0b0910))` }} />
            <div className="space-y-1 p-3">
              <p className="font-display font-semibold">{nome || "Nome da mesa"}</p>
              <p className="text-xs text-muted">{sistema || "Sistema"} · {STATUS_LABEL[status]}</p>
            </div>
          </div>
          <div className="mt-auto flex justify-end gap-2 pt-6">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancelar</button>
            <button disabled={ocupado || !nome.trim()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong disabled:opacity-60">
              {ocupado ? "Criando…" : "Criar mesa"}
            </button>
          </div>
        </div>

        {/* Ações no mobile */}
        <div className="flex justify-end gap-2 md:hidden">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">Cancelar</button>
          <button disabled={ocupado || !nome.trim()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
            {ocupado ? "Criando…" : "Criar mesa"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
