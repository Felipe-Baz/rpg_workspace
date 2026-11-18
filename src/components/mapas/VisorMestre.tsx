"use client";

import { useEffect, useRef, useState } from "react";
import { uid } from "@/lib/mesas";
import { atualizarMapa, type Colecao, type Cobertura, type Mapa, type Ponto, type Zona } from "@/lib/mapas";
import CamadaCobertura from "./CamadaCobertura";

type Ferramenta = "sel" | "ret" | "poli" | "livre";

const FERRAMENTAS: { id: Ferramenta; rotulo: string; dica: string }[] = [
  { id: "sel", rotulo: "↖ Selecionar", dica: "Clique numa área para selecionar" },
  { id: "ret", rotulo: "▭ Retângulo", dica: "Arraste para tampar" },
  { id: "poli", rotulo: "⬠ Polígono", dica: "Clique nos vértices; Enter ou clique no 1º ponto conclui" },
  { id: "livre", rotulo: "✎ Livre", dica: "Mantenha pressionado e desenhe o contorno" },
];

const btn = "rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-border/50";
const btnAtivo = "rounded-lg border border-violet-600 bg-violet-600 px-2.5 py-1.5 text-sm text-white";

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
const retangulo = (a: Ponto, b: Ponto): Ponto[] => [
  { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
  { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
  { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
  { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
];

/**
 * Visor em tela cheia do mestre. Dois modos:
 * - Mostrar (padrão, para a tela compartilhada): só o mapa; áreas ocultas ficam pretas.
 *   Duplo clique numa área preta revela a zona inteira.
 * - Editar: vê através das coberturas, desenha formas e gerencia zonas.
 */
export default function VisorMestre({
  mesaId,
  mapa,
  colecao,
  onFechar,
}: {
  mesaId: string;
  mapa: Mapa;
  colecao: Colecao;
  onFechar: () => void;
}) {
  const zonas = mapa.zonas ?? [];
  const cobertas = mapa.cobertas ?? [];

  const [editar, setEditar] = useState(false);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("ret");
  const [zonaAtiva, setZonaAtiva] = useState<string>("");
  const [selId, setSelId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Ponto[]>([]);
  const [cursor, setCursor] = useState<Ponto | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const inicio = useRef<Ponto | null>(null);

  const zonaEf = zonas.some((z) => z.id === zonaAtiva) ? zonaAtiva : (zonas[0]?.id ?? "");
  const sel = cobertas.find((c) => c.id === selId);

  const salvar = (patch: { cobertas?: Cobertura[]; zonas?: Zona[] }) => atualizarMapa(mesaId, mapa.id, patch, colecao);

  function commit(pontos: Ponto[]) {
    let zs = zonas;
    let zid = zonaEf;
    if (!zid) {
      zid = uid();
      zs = [...zs, { id: zid, nome: `Zona ${zs.length + 1}` }];
      setZonaAtiva(zid);
    }
    salvar({ zonas: zs, cobertas: [...cobertas, { id: uid(), zonaId: zid, pontos, revelada: false }] });
  }

  const definirRevelada = (zonaId: string | null, revelada: boolean) =>
    salvar({ cobertas: cobertas.map((c) => (zonaId === null || c.zonaId === zonaId ? { ...c, revelada } : c)) });

  const alternarZona = (zonaId: string) => {
    const daZona = cobertas.filter((c) => c.zonaId === zonaId);
    definirRevelada(zonaId, !daZona.every((c) => c.revelada));
  };

  const concluirPoligono = () => {
    if (rascunho.length >= 3) commit(rascunho);
    setRascunho([]);
    setCursor(null);
  };

  function pos(e: { clientX: number; clientY: number }): Ponto {
    const r = caixa.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }

  function aoPressionar(e: React.PointerEvent) {
    const p = pos(e);
    if (ferramenta === "poli") {
      if (rascunho.length >= 3 && dist(p, rascunho[0]) < 0.02) concluirPoligono();
      else setRascunho([...rascunho, p]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = p;
    setRascunho(ferramenta === "ret" ? retangulo(p, p) : [p]);
  }

  function aoMover(e: React.PointerEvent) {
    const p = pos(e);
    if (ferramenta === "poli") return setCursor(p);
    if (!inicio.current) return;
    if (ferramenta === "ret") setRascunho(retangulo(inicio.current, p));
    else setRascunho((r) => (r.length && dist(r[r.length - 1], p) < 0.004 ? r : [...r, p]));
  }

  function aoSoltar() {
    if (!inicio.current) return;
    inicio.current = null;
    const xs = rascunho.map((p) => p.x);
    const ys = rascunho.map((p) => p.y);
    const grande = Math.max(...xs) - Math.min(...xs) > 0.005 && Math.max(...ys) - Math.min(...ys) > 0.005;
    if (ferramenta === "ret" ? grande : rascunho.length >= 3 && grande) commit(rascunho);
    setRascunho([]);
  }

  const excluirSel = () => {
    if (!sel) return;
    salvar({ cobertas: cobertas.filter((c) => c.id !== sel.id) });
    setSelId(null);
  };

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (alvo.tagName === "INPUT" || alvo.tagName === "SELECT" || alvo.tagName === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (rascunho.length) { setRascunho([]); setCursor(null); inicio.current = null; }
        else if (selId) setSelId(null);
        else onFechar();
      } else if (e.key === "Enter" && ferramenta === "poli" && editar) concluirPoligono();
      else if (e.key === "Backspace" && ferramenta === "poli" && rascunho.length) setRascunho(rascunho.slice(0, -1));
      else if ((e.key === "Delete" || e.key === "Backspace") && editar && sel) excluirSel();
      else if (e.key.toLowerCase() === "e") { setEditar((v) => !v); setRascunho([]); setSelId(null); }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const desenhando = editar && ferramenta !== "sel";
  const previa = ferramenta === "poli" && cursor && rascunho.length ? [...rascunho, cursor] : rascunho;

  return (
    <div className="fixed inset-0 z-50 flex bg-black">
      <div className="flex min-w-0 flex-1 items-center justify-center p-2">
        <div ref={caixa} className="relative leading-[0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapa.imagem}
            alt={mapa.nome}
            draggable={false}
            className="block max-w-full select-none"
            style={{ maxHeight: "calc(100vh - 1rem)" }}
          />
          <CamadaCobertura
            cobertas={cobertas}
            modo={editar ? "editar" : "mostrar"}
            selecionadaId={selId}
            onSelecionar={editar && ferramenta === "sel" ? setSelId : undefined}
            onRevelarZona={editar ? undefined : (z) => definirRevelada(z, true)}
          />
          {desenhando && (
            <div
              onPointerDown={aoPressionar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              className="absolute inset-0 cursor-crosshair touch-none"
            >
              {previa.length > 0 && (
                <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
                  <polygon
                    points={previa.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="rgba(139,92,246,0.3)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              {ferramenta === "poli" &&
                rascunho.map((p, i) => (
                  <span
                    key={i}
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                    className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${
                      i === 0 ? "bg-yellow-400" : "bg-violet-500"
                    }`}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modo mostrar: controles quase invisíveis para não poluir a tela compartilhada */}
      {!editar && (
        <div className="absolute right-3 top-3 flex gap-2 opacity-20 transition-opacity hover:opacity-100">
          <button onClick={() => setEditar(true)} title="Editar coberturas (E)" className="rounded-lg bg-card px-3 py-1.5 text-sm">
            ✎
          </button>
          <button onClick={onFechar} title="Fechar (Esc)" className="rounded-lg bg-card px-3 py-1.5 text-sm">
            ✕
          </button>
        </div>
      )}

      {editar && (
        <aside className="w-80 space-y-4 overflow-y-auto border-l border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => { setEditar(false); setRascunho([]); setSelId(null); }} className={btnAtivo}>
              👁 Voltar ao modo mesa
            </button>
            <button onClick={onFechar} aria-label="Fechar" className="px-2 text-muted hover:text-foreground">✕</button>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted">Ferramenta</p>
            <div className="grid grid-cols-2 gap-2">
              {FERRAMENTAS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFerramenta(f.id); setRascunho([]); setSelId(null); }}
                  title={f.dica}
                  className={ferramenta === f.id ? btnAtivo : btn}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{FERRAMENTAS.find((f) => f.id === ferramenta)!.dica}.</p>
            {ferramenta === "poli" && rascunho.length >= 3 && (
              <button onClick={concluirPoligono} className={btn}>Concluir polígono (Enter)</button>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted">Zonas</p>
              <button
                onClick={() => {
                  const z = { id: uid(), nome: `Zona ${zonas.length + 1}` };
                  salvar({ zonas: [...zonas, z] });
                  setZonaAtiva(z.id);
                }}
                className="text-xs text-violet-500 hover:underline"
              >
                + Nova zona
              </button>
            </div>
            {zonas.length === 0 && <p className="text-xs text-muted">Desenhe uma área: a primeira zona é criada sozinha.</p>}
            {zonas.map((z) => {
              const formas = cobertas.filter((c) => c.zonaId === z.id);
              const aberta = formas.length > 0 && formas.every((c) => c.revelada);
              return (
                <div key={z.id} className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={z.id === zonaEf}
                      onChange={() => setZonaAtiva(z.id)}
                      title="Zona onde as próximas formas serão criadas"
                    />
                    <input
                      value={z.nome}
                      onChange={(e) => salvar({ zonas: zonas.map((x) => (x.id === z.id ? { ...x, nome: e.target.value } : x)) })}
                      className="w-full rounded border border-border bg-background px-2 py-1"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">{formas.length} forma(s)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => alternarZona(z.id)}
                        disabled={formas.length === 0}
                        className={`${aberta ? btn : btnAtivo} disabled:opacity-40`}
                      >
                        {aberta ? "Esconder zona" : "Revelar zona"}
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`Excluir a zona "${z.nome}" e suas formas?`)) return;
                          salvar({ zonas: zonas.filter((x) => x.id !== z.id), cobertas: cobertas.filter((c) => c.zonaId !== z.id) });
                        }}
                        className="px-1 text-muted hover:text-red-500"
                        aria-label="Excluir zona"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {cobertas.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => definirRevelada(null, true)} className={btn}>Revelar tudo</button>
                <button onClick={() => definirRevelada(null, false)} className={btn}>Esconder tudo</button>
              </div>
            )}
          </div>

          {sel && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs uppercase tracking-wider text-muted">Forma selecionada</p>
              <select
                value={sel.zonaId}
                onChange={(e) => salvar({ cobertas: cobertas.map((c) => (c.id === sel.id ? { ...c, zonaId: e.target.value } : c)) })}
                className="w-full rounded border border-border bg-background px-2 py-1"
              >
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>{z.nome}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => salvar({ cobertas: cobertas.map((c) => (c.id === sel.id ? { ...c, revelada: !c.revelada } : c)) })}
                  className={btn}
                >
                  {sel.revelada ? "Esconder" : "Revelar"}
                </button>
                <button onClick={excluirSel} className={`${btn} hover:text-red-500`}>Excluir (Del)</button>
              </div>
            </div>
          )}

          <p className="border-t border-border pt-3 text-xs text-muted">
            Os jogadores veem o mapa com as áreas escuras cobertas e as reveladas visíveis. No modo mesa,
            dê <b>duplo clique</b> numa área preta para revelar a zona inteira. Atalho <b>E</b> alterna os modos.
          </p>
        </aside>
      )}
    </div>
  );
}
