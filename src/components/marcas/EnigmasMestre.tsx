"use client";

import { useState } from "react";
import { marcaPorId, type PuzzleEtapa } from "@/lib/marcas-data";
import {
  definirLiberadas,
  julgarEtapa,
  useAtribuicoes,
  useJogadores,
  usePuzzles,
  useTodasLiberadas,
  useTodasRespostas,
  useTodosVereditos,
} from "@/lib/marcas";

export default function EnigmasMestre({ mesaId }: { mesaId: string }) {
  const jogadores = useJogadores(mesaId);
  const atribuicoes = useAtribuicoes(mesaId);
  const puzzles = usePuzzles(mesaId);
  const liberadas = useTodasLiberadas(mesaId);
  const respostas = useTodasRespostas(mesaId);
  const vereditos = useTodosVereditos(mesaId);

  if (atribuicoes.length === 0) return <p className="dim">Nenhuma Marca atribuída.</p>;

  return (
    <div className="space-y-4">
      {atribuicoes.map((a) => {
        const nome = jogadores.find((j) => j.uid === a.uid)?.name ?? a.uid;
        const puzzle = puzzles.find((p) => p.id === a.markId)?.puzzle;
        const lib = liberadas.find((l) => l.uid === a.uid)?.etapas ?? [];
        const resp = respostas.find((r) => r.uid === a.uid)?.respostas ?? {};
        const ver = vereditos.find((v) => v.uid === a.uid)?.status ?? {};
        const resolvidas = Object.values(ver).filter((v) => v.estado === "aprovada").length;

        const alternar = (idx: number) => {
          if (!puzzle) return;
          const jaLiberada = lib.some((e) => e.idx === idx);
          const comIdx = (i: number) => ({ ...puzzle.etapas[i], idx: i, ambiente: puzzle.ambiente ?? a.markId });
          const base = lib.filter((e) => puzzle.etapas[e.idx]).map((e) => comIdx(e.idx));
          const novas = jaLiberada ? base.filter((e) => e.idx !== idx) : [...base, comIdx(idx)];
          return definirLiberadas(mesaId, a.uid, a.markId, novas);
        };

        return (
          <details key={a.uid} className="panel p-4">
            <summary className="display cursor-pointer">
              {nome} <span className="dim">— {marcaPorId(a.markId)?.name}</span>{" "}
              <span className="tag">{lib.length} liberada(s) · {resolvidas} resolvida(s)</span>
            </summary>
            {!puzzle ? (
              <p className="dim mt-3">Enigma desta Marca não importado. Use “Importar enigmas”.</p>
            ) : (
              <div className="mt-3 space-y-4">
                <h3 className="gold">{puzzle.titulo}</h3>
                {puzzle.etapas.map((e, idx) => (
                  <EtapaMestre
                    key={idx}
                    n={idx + 1}
                    etapa={e}
                    liberada={lib.some((x) => x.idx === idx)}
                    resposta={resp[String(idx)]}
                    decifrada={resp[`ok${idx}`]}
                    estado={ver[String(idx)]?.estado}
                    onAlternar={() => alternar(idx)}
                    onJulgar={(estado, nota) => julgarEtapa(mesaId, a.uid, idx, estado ? { estado, nota } : null)}
                  />
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

function EtapaMestre({
  n, etapa, liberada, resposta, decifrada, estado, onAlternar, onJulgar,
}: {
  n: number;
  etapa: PuzzleEtapa;
  liberada: boolean;
  resposta?: string;
  decifrada?: string;
  estado?: "aprovada" | "recusada";
  onAlternar: () => void;
  onJulgar: (estado: "aprovada" | "recusada" | null, nota?: string) => void;
}) {
  const [nota, setNota] = useState("");
  return (
    <div className="border-t pt-3" style={{ borderColor: "var(--m-line)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="display">{n}. {etapa.titulo}</h4>
        <button className={liberada ? "btn ghost" : "btn"} onClick={onAlternar}>
          {liberada ? "Recolher etapa" : "Liberar etapa"}
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap italic dim">{etapa.texto}</p>
      <p className="mt-1"><span className="gold">Pergunta:</span> {etapa.pergunta}</p>
      <p className="mt-1"><span className="gold">Gabarito:</span> {etapa.resposta}</p>
      {etapa.mecanica && (
        <p className="mt-1">
          <span className="gold">Mecânica:</span> <span className="tag">{etapa.mecanica.tipo}</span>
          {etapa.mecanica.solucao && <> solução: <code>{etapa.mecanica.solucao}</code></>}
        </p>
      )}
      {liberada && (
        <div className="mt-2 space-y-2">
          {etapa.mecanica && (
            <p>
              <span className="gold">Mecânica:</span>{" "}
              {decifrada !== undefined ? <span className="tag">Decifrada</span> : <span className="dim">ainda não decifrada</span>}
            </p>
          )}
          <p>
            <span className="gold">Resposta do jogador:</span>{" "}
            {resposta ? <span className="whitespace-pre-wrap">{resposta}</span> : <span className="dim">(ainda não respondeu)</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => onJulgar("aprovada", nota)}>Aprovar</button>
            <input className="max-w-xs" placeholder="Nota ao recusar (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
            <button className="btn ghost" onClick={() => onJulgar("recusada", nota)}>Recusar</button>
            {estado && <button className="text-xs underline dim" onClick={() => onJulgar(null)}>limpar veredito</button>}
            {estado && <span className="tag">{estado === "aprovada" ? "Aprovada" : "Recusada"}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
