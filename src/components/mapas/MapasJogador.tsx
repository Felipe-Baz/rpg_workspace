"use client";

import { useState } from "react";
import EditorMarkdown from "../EditorMarkdown";
import Markdown from "../Markdown";
import { uid } from "@/lib/mesas";
import { useMapasJogador, usePinos, type Colecao, type Cobertura, type Pino } from "@/lib/mapas";
import CamadaCobertura from "./CamadaCobertura";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function MapasJogador({
  mesaId,
  usuarioUid,
  colecao = "mapas",
}: {
  mesaId: string;
  usuarioUid: string;
  colecao?: Colecao;
}) {
  const { mapas, carregado } = useMapasJogador(mesaId, usuarioUid, true, colecao);
  const { carregado: pinosOk, pinosDe, definirPinos, notaDe, definirNota } = usePinos(mesaId, usuarioUid, true);
  const [sel, setSel] = useState<string | null>(null);
  const mapa = mapas.find((m) => m.id === sel) ?? mapas[0];

  if (!carregado) return <p className="text-muted">Carregando…</p>;
  if (!mapa) return <p className="text-muted">{colecao === "mapas" ? "Nenhum mapa foi liberado" : "Nenhuma imagem foi liberada"} pelo mestre ainda.</p>;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {mapas.map((m) => (
          <button
            key={m.id}
            onClick={() => setSel(m.id)}
            className={`rounded-lg border border-border px-3 py-1.5 text-sm ${
              m.id === mapa.id ? "bg-accent text-white" : "hover:bg-border/50"
            }`}
          >
            {m.nome || (colecao === "mapas" ? "Mapa" : "Imagem")}
          </button>
        ))}
      </div>
      <VisorMapa
        key={mapa.id}
        imagem={mapa.imagem}
        nome={mapa.nome}
        cobertas={mapa.cobertas}
        pinos={pinosDe(mapa.id)}
        nota={notaDe(mapa.id)}
        onNota={(v) => definirNota(mapa.id, v)}
        desabilitado={!pinosOk}
        onChange={(p) => definirPinos(mapa.id, p)}
      />
    </section>
  );
}

function VisorMapa({
  imagem,
  nome,
  cobertas,
  pinos,
  nota,
  onNota,
  desabilitado,
  onChange,
}: {
  imagem: string;
  nome: string;
  cobertas?: Cobertura[];
  pinos: Pino[];
  nota: string;
  onNota: (v: string) => void;
  desabilitado: boolean;
  onChange: (p: Pino[]) => void;
}) {
  const [colocando, setColocando] = useState(false);
  const [pinoId, setPinoId] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const pino = pinos.find((p) => p.id === pinoId);

  const alterar = (id: string, patch: Partial<Pino>) =>
    onChange(pinos.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  function clicar(e: React.MouseEvent<HTMLDivElement>) {
    if (!colocando || desabilitado) return;
    const r = e.currentTarget.getBoundingClientRect();
    const novo: Pino = {
      id: uid(),
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      titulo: "Novo local",
      texto: "",
    };
    onChange([...pinos, novo]);
    setPinoId(novo.id);
    setEditando(true);
    setColocando(false);
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <button
          onClick={() => setColocando((v) => !v)}
          disabled={desabilitado}
          className={`rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            colocando ? "bg-accent text-white" : "hover:bg-border/50"
          }`}
        >
          {colocando ? "Clique no mapa para fixar o pino…" : "📍 Adicionar pino"}
        </button>
        <div
          onClick={clicar}
          className={`relative overflow-hidden rounded-xl border border-border ${colocando ? "cursor-crosshair" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagem} alt={nome} className="block w-full select-none" draggable={false} />
          <CamadaCobertura cobertas={cobertas} modo="mostrar" />
          {pinos.map((p) => (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation();
                if (colocando) return;
                setPinoId(p.id);
                setEditando(false);
              }}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              className={`absolute -translate-x-1/2 -translate-y-full text-2xl drop-shadow ${
                p.id === pinoId ? "scale-125" : ""
              }`}
            >
              📍
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted">🔒 Anotações gerais sobre esta imagem · só você vê</p>
        <textarea
          value={nota}
          onChange={(e) => onNota(e.target.value)}
          disabled={desabilitado}
          rows={4}
          placeholder="O que você percebeu, deduziu ou quer lembrar…"
          className={campo}
        />
      </div>

      {pino && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setPinoId(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-h-full w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl"
        >

          <>
            <div className="flex items-center gap-2">
            <input
              value={pino.titulo}
              onChange={(e) => alterar(pino.id, { titulo: e.target.value })}
              placeholder="Nome do local (ruínas, campo…)"
              className={campo}
            />
            <button onClick={() => setPinoId(null)} aria-label="Fechar" className="px-2 text-muted hover:text-foreground">✕</button>
            </div>
            <p className="text-xs text-muted">🔒 Só você vê · Markdown</p>
            {editando ? (
              <EditorMarkdown
                valor={pino.texto}
                onChange={(v) => alterar(pino.id, { texto: v })}
                placeholder="O que você sabe, viu ou suspeita deste lugar…"
              />
            ) : pino.texto.trim() ? (
              <Markdown texto={pino.texto} />
            ) : (
              <p className="text-sm text-muted">Sem anotações.</p>
            )}
            <div className="flex justify-between">
              <button onClick={() => setEditando((v) => !v)} className="text-sm text-accent-hover hover:underline">
                {editando ? "Concluir" : "Editar anotações"}
              </button>
              <button
                onClick={() => {
                  onChange(pinos.filter((p) => p.id !== pino.id));
                  setPinoId(null);
                }}
                className="text-sm text-muted hover:text-danger"
              >
                Remover pino
              </button>
            </div>
          </>
        </div>
      </div>
      )}
    </div>
  );
}
