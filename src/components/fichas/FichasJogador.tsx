"use client";

import IconeCategoria from "./IconeCategoria";
import { confirmar } from "@/components/ui/Dialogos";
import { useEffect, useRef, useState } from "react";
import EditorMarkdown from "../EditorMarkdown";
import Markdown from "../Markdown";
import { comprimirImagem } from "@/lib/mapas";
import type { Mesa } from "@/lib/mesas";
import { atualizarFicha, criarFicha, excluirFicha, useFichas, type CategoriaFicha, type Ficha } from "@/lib/fichas";

/** Opiniões privadas do jogador sobre fichas do mestre (chave = id da ficha). */
export type Opinioes = { valores: Record<string, string>; carregado: boolean; definir: (fichaId: string, texto: string) => void };

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function FichasJogador({
  mesaId,
  usuarioUid,
  categoria,
  rotulo,
  singular,
  mesa,
  opinioes,
}: {
  opinioes?: Opinioes;
  /** Presente = modo mestre: cadastra fichas e escolhe quem as vê. */
  mesa?: Mesa;
  mesaId: string;
  usuarioUid: string;
  categoria: CategoriaFicha;
  rotulo: string;
  singular: string;
  icone: string;
}) {
  const { fichas, carregado } = useFichas(mesaId, usuarioUid, true, !!mesa);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const lista = fichas.filter((f) => f.categoria === categoria);
  const aberta = fichas.find((f) => f.id === abertaId);

  async function nova() {
    setCriando(true);
    try {
      setAbertaId(await criarFicha(mesaId, usuarioUid, categoria, `Novo ${singular.toLowerCase()}`, !!mesa));
    } finally {
      setCriando(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{rotulo}</h2>
        <button
          onClick={nova}
          disabled={criando}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          + Cadastrar
        </button>
      </div>
      <p className="text-sm text-muted">
        {mesa
          ? "🔒 Os jogadores só veem o que você liberar (para todos ou para jogadores específicos)."
          : "🔒 Só você vê o que cadastra aqui. Itens liberados pelo mestre aparecem com 👁."}
      </p>
      {!carregado && <p className="text-muted">Carregando…</p>}
      {carregado && lista.length === 0 && <p className="text-muted">Nada cadastrado ainda.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {lista.map((f) => (
          <button
            key={f.id}
            onClick={() => setAbertaId(f.id)}
            className="overflow-hidden rounded-xl border border-border bg-card text-left hover:border-accent-hover"
          >
            {f.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.foto} alt={f.nome} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-border/30"><IconeCategoria categoria={f.categoria} size={44} /></div>
            )}
            <p className="truncate px-3 py-2 text-sm font-medium">
              {!mesa && f.mestre && "👁 "}
              {f.nome || "Sem nome"}
            </p>
            {mesa && (
              <p className="px-3 pb-2 text-xs text-muted">
                {f.todos ? "Todos" : f.liberadoPara.length ? `${f.liberadoPara.length} jogador(es)` : "Oculto"}
              </p>
            )}
          </button>
        ))}
      </div>
      {aberta && (
        <FichaModal
          key={aberta.id}
          mesaId={mesaId}
          ficha={aberta}
          mesa={mesa}
          somenteLeitura={aberta.mestre && !mesa}
          opinioes={opinioes}
          onFechar={() => setAbertaId(null)}
        />
      )}
    </section>
  );
}

function FichaModal({
  mesaId,
  ficha,
  mesa,
  somenteLeitura,
  opinioes,
  onFechar,
}: {
  opinioes?: Opinioes;
  mesaId: string;
  ficha: Ficha;
  mesa?: Mesa;
  somenteLeitura: boolean;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(ficha.nome);
  const [texto, setTexto] = useState(ficha.texto);
  const [editando, setEditando] = useState(!somenteLeitura && !ficha.texto.trim());
  const [erro, setErro] = useState("");
  const [ampliada, setAmpliada] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [opiniao, setOpiniao] = useState(opinioes?.valores[ficha.id] ?? "");
  const [editandoOpiniao, setEditandoOpiniao] = useState(false);
  const opiniaoCarregada = useRef(false);
  // Se o documento carregar depois de abrir o modal, adota o valor salvo (uma vez, sem edição em curso).
  useEffect(() => {
    if (!opinioes?.carregado || opiniaoCarregada.current) return;
    opiniaoCarregada.current = true;
    setOpiniao((atual) => atual || opinioes.valores[ficha.id] || "");
  }, [opinioes, ficha.id]);

  // Salva nome e texto com debounce.
  useEffect(() => {
    if (somenteLeitura || (nome === ficha.nome && texto === ficha.texto)) return;
    const t = setTimeout(() => atualizarFicha(mesaId, ficha.id, { nome, texto }).catch(console.error), 600);
    return () => clearTimeout(t);
  }, [nome, texto, mesaId, ficha.id, ficha.nome, ficha.texto, somenteLeitura]);

  async function trocarFoto(arquivo?: File) {
    if (!arquivo) return;
    setErro("");
    try {
      await atualizarFicha(mesaId, ficha.id, { foto: await comprimirImagem(arquivo, 800, 250_000) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function fechar() {
    if (!somenteLeitura && (nome !== ficha.nome || texto !== ficha.texto)) {
      await atualizarFicha(mesaId, ficha.id, { nome, texto }).catch(console.error);
    }
    onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={fechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome"
            readOnly={somenteLeitura}
            className={campo}
          />
          <button onClick={fechar} aria-label="Fechar" className="px-2 text-muted hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="flex items-start gap-3">
          {ficha.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ficha.foto}
              alt={ficha.nome}
              onClick={() => setAmpliada(true)}
              className="h-32 w-32 shrink-0 cursor-zoom-in rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-border/30">
              <IconeCategoria categoria={ficha.categoria} size={52} />
            </div>
          )}
          {!somenteLeitura && (
          <div className="space-y-2">
            <button
              onClick={() => input.current?.click()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50"
            >
              {ficha.foto ? "Trocar foto" : "Adicionar foto"}
            </button>
            {ficha.foto && (
              <button
                onClick={() => atualizarFicha(mesaId, ficha.id, { foto: "" })}
                className="block text-sm text-muted hover:text-danger"
              >
                Remover foto
              </button>
            )}
            {erro && <p className="text-sm text-danger">{erro}</p>}
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => trocarFoto(e.target.files?.[0])} />
          </div>
          )}
        </div>
        <p className="text-xs text-muted">
          {somenteLeitura ? "👁 Liberado pelo mestre" : mesa ? "Markdown" : "🔒 Só você vê · Markdown"}
        </p>
        {mesa && (
          <div className="space-y-1 rounded-lg border border-border p-3">
            <p className="text-xs uppercase tracking-wider text-muted">Quem pode ver</p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={ficha.todos}
                onChange={(e) => atualizarFicha(mesaId, ficha.id, { todos: e.target.checked })}
              />
              Todos os jogadores
            </label>
            {mesa.jogadores.filter((j) => j.uid).length === 0 && (
              <p className="text-sm text-muted">Nenhum jogador com personagem ainda.</p>
            )}
            {mesa.jogadores
              .filter((j) => j.uid)
              .map((j) => (
                <label key={j.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ficha.liberadoPara.includes(j.uid!)}
                    onChange={() =>
                      atualizarFicha(mesaId, ficha.id, {
                        liberadoPara: ficha.liberadoPara.includes(j.uid!)
                          ? ficha.liberadoPara.filter((u) => u !== j.uid)
                          : [...ficha.liberadoPara, j.uid!],
                      })
                    }
                  />
                  {j.personagem || j.nome || "Jogador"}
                </label>
              ))}
          </div>
        )}
        {editando ? (
          <EditorMarkdown valor={texto} onChange={setTexto} placeholder="O que você sabe, viu ou suspeita…" />
        ) : texto.trim() ? (
          <Markdown texto={texto} />
        ) : (
          <p className="text-sm text-muted">Sem anotações.</p>
        )}
        {somenteLeitura && opinioes && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Minha opinião <span className="font-normal text-muted">(só você vê · Markdown)</span>
              </h4>
              <button
                onClick={() => setEditandoOpiniao((v) => !v)}
                disabled={!opinioes.carregado}
                className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-border/50 disabled:opacity-50"
              >
                {editandoOpiniao ? "Concluir" : opiniao ? "Editar" : "Escrever"}
              </button>
            </div>
            {editandoOpiniao ? (
              <EditorMarkdown
                valor={opiniao}
                onChange={(v) => {
                  setOpiniao(v);
                  opinioes.definir(ficha.id, v);
                }}
                desabilitado={!opinioes.carregado}
                placeholder="O que você acha, desconfia ou quer lembrar…"
              />
            ) : opiniao.trim() ? (
              <Markdown texto={opiniao} />
            ) : (
              <p className="text-sm text-muted">Nenhuma opinião ainda.</p>
            )}
          </div>
        )}
        {!somenteLeitura && (
        <div className="flex justify-between">
          <button onClick={() => setEditando((v) => !v)} className="text-sm text-accent-hover hover:underline">
            {editando ? "Concluir" : "Editar anotações"}
          </button>
          <button
            onClick={async () => {
              if (await confirmar({ texto: `Excluir "${nome}"?`, confirmar: "Excluir", perigo: true })) {
                excluirFicha(mesaId, ficha.id);
                onFechar();
              }
            }}
            className="text-sm text-muted hover:text-danger"
          >
            Excluir
          </button>
        </div>
        )}
      </div>
      {ampliada && ficha.foto && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setAmpliada(false);
          }}
          className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ficha.foto} alt={ficha.nome} className="max-h-full max-w-full" />
        </div>
      )}
    </div>
  );
}
