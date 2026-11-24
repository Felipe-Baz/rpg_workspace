"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { CORES, STATUS_LABEL, criarMesa, type Status } from "@/lib/mesas";
import { criarSistemaPessoal, excluirSistemaPessoal, useSistemas } from "@/lib/sistemas";
import Dialog from "../ui/Dialog";

const NOVO = "__novo__";
const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Cadastro da mesa em uma tela só: só o nome é obrigatório; o resto tem padrões e dá para editar depois.
export default function NovaMesaWizard({ uid, onClose }: { uid: string; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [sistema, setSistema] = useState("");
  const [novoSistema, setNovoSistema] = useState<string | null>(null); // texto do sistema próprio em cadastro
  const opcoes = useSistemas(uid);
  const publicos = opcoes.filter((o) => !o.proprio);
  const proprios = opcoes.filter((o) => o.proprio);
  const atualProprio = proprios.find((o) => o.nome === sistema);
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
            <label htmlFor="sistema-mesa">Sistema</label>
            <select
              id="sistema-mesa"
              value={novoSistema !== null ? NOVO : sistema}
              onChange={(e) => {
                if (e.target.value === NOVO) setNovoSistema("");
                else {
                  setNovoSistema(null);
                  setSistema(e.target.value);
                }
              }}
              className={`${campo} mt-1`}
            >
              <option value="">Sem sistema definido</option>
              {publicos.length > 0 && (
                <optgroup label="Sistemas">
                  {publicos.map((o) => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
                </optgroup>
              )}
              {proprios.length > 0 && (
                <optgroup label="Meus sistemas (só você vê)">
                  {proprios.map((o) => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                </optgroup>
              )}
              <option value={NOVO}>+ Cadastrar sistema próprio…</option>
            </select>

            {novoSistema !== null && (
              <div className="anim-surgir mt-2 flex gap-2">
                <input
                  value={novoSistema}
                  onChange={(e) => setNovoSistema(e.target.value)}
                  maxLength={60}
                  placeholder="Nome do seu sistema"
                  aria-label="Nome do sistema próprio"
                  className={campo}
                />
                <button
                  type="button"
                  disabled={!novoSistema.trim()}
                  onClick={async () => {
                    const nome = novoSistema.trim();
                    try {
                      if (!opcoes.some((o) => o.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) await criarSistemaPessoal(uid, nome);
                      setSistema(opcoes.find((o) => o.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))?.nome ?? nome);
                      setNovoSistema(null);
                    } catch {
                      setErro("Não foi possível salvar o sistema. Tente novamente.");
                    }
                  }}
                  className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Salvar
                </button>
              </div>
            )}
            {atualProprio?.id && novoSistema === null && (
              <button
                type="button"
                onClick={async () => {
                  await excluirSistemaPessoal(atualProprio.id!).catch(() => setErro("Não foi possível remover o sistema."));
                  setSistema("");
                }}
                className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-danger"
              >
                <Trash2 size={12} /> Remover “{atualProprio.nome}” dos meus sistemas
              </button>
            )}
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
