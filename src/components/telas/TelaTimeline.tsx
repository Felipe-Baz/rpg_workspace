"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, GitBranch, Locate, Maximize2, Plus, Search, Trash2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { uid, useDocSincronizado } from "@/lib/mesas";
import {
  CORES_RAMO, LIMITE_BYTES, RAMO_PRINCIPAL, TIPOS_EVENTO, ZOOM_MAX, ZOOM_MIN, buscar, clamp, encaixe, enquadrar, formatarX, importar, inicioDoRamo,
  normalizar, passoDaRegua, removerEvento, removerRamo, rotulosVisiveis, tamanhoBytes, timelineVazia, zoomAncorado,
  type Evento, type Ramo, type Timeline, type TipoEvento,
} from "@/lib/timeline";
import { confirmar, perguntar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo, { campo } from "./Titulo";

const ALTURA_RAMO = 88;
const ALTURA_REGUA = 30;
const LARGURA_ROTULOS = 150;
const botao = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:border-accent disabled:opacity-40";

type Vista = { vx: number; zoom: number };
type Arrasto =
  | { tipo: "pan"; x0: number; vx0: number; mexeu: boolean }
  | { tipo: "evento"; id: string; x0: number; ex0: number; y0: number; mexeu: boolean };

export default function TelaTimeline() {
  const mesa = useMesaAtual();
  const { dados, carregado, atualizar } = useDocSincronizado<Timeline>(["mesas", mesa.id, "segredos", "timeline"], timelineVazia(), true);
  const t = useMemo(() => normalizar(dados), [dados]);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const mudar = useCallback((f: (t: Timeline) => Timeline) => atualizar(f(tRef.current)), [atualizar]);

  const area = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(900);
  const [vista, setVista] = useState<Vista>({ vx: -20, zoom: 4 });
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [bytes, setBytes] = useState(0);
  const arrasto = useRef<Arrasto | null>(null);
  const enquadrou = useRef(false);
  const { vx, zoom } = vista;

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Ao carregar, enquadra a linha inteira uma única vez.
  useEffect(() => {
    if (carregado && !enquadrou.current && largura > 0) {
      enquadrou.current = true;
      setVista(enquadrar(tRef.current, largura));
    }
  }, [carregado, largura]);

  useEffect(() => {
    const id = setTimeout(() => setBytes(tamanhoBytes(t)), 400);
    return () => clearTimeout(id);
  }, [t]);

  // Roda do mouse = zoom ancorado no cursor; Shift/trackpad horizontal = arrastar. Precisa de listener não passivo.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ancora = e.clientX - el.getBoundingClientRect().left;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setVista((v) => ({ ...v, vx: v.vx + (e.shiftKey ? e.deltaY : e.deltaX) / v.zoom }));
      } else {
        setVista((v) => zoomAncorado(v.vx, v.zoom, v.zoom * Math.exp(-e.deltaY * 0.0015), ancora));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const ramosVisiveis = useMemo(() => t.ramos.filter((r) => !r.oculto), [t.ramos]);
  const indiceRamo = useMemo(() => new Map(ramosVisiveis.map((r, i) => [r.id, i])), [ramosVisiveis]);
  const corRamo = useMemo(() => new Map(t.ramos.map((r) => [r.id, r.cor])), [t.ramos]);
  const porRamo = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of t.eventos) (m.get(e.ramoId) ?? m.set(e.ramoId, []).get(e.ramoId)!).push(e);
    for (const l of m.values()) l.sort((a, b) => a.x - b.x);
    return m;
  }, [t.eventos]);
  const comRotulo = useMemo(() => {
    const s = new Set<string>();
    for (const l of porRamo.values()) for (const id of rotulosVisiveis(l, zoom)) s.add(id);
    return s;
  }, [porRamo, zoom]);

  const evSel = t.eventos.find((e) => e.id === selecionado) ?? null;
  const px = (x: number) => (x - vx) * zoom;
  const xDoPx = (p: number) => vx + p / zoom;
  const alturaCorpo = Math.max(ramosVisiveis.length, 1) * ALTURA_RAMO;
  const resultados = useMemo(() => buscar(t, busca), [t, busca]);

  const irPara = (x: number) => setVista((v) => ({ ...v, vx: x - largura / 2 / v.zoom }));
  const aplicarZoom = (novo: number) => setVista((v) => zoomAncorado(v.vx, v.zoom, novo, largura / 2));
  const ajustar = () => setVista(enquadrar(t, largura));

  // ---------- criação e edição ----------
  const cheio = bytes > LIMITE_BYTES;
  const ramoAlvo = (): Ramo => (evSel && ramosVisiveis.find((r) => r.id === evSel.ramoId)) || ramosVisiveis[0] || t.ramos[0];

  function novoEvento(ramo: Ramo, x: number) {
    if (cheio) return toast("A timeline atingiu o limite de tamanho. Exporte um backup e apague eventos antigos.", "erro");
    const e: Evento = { id: uid(), ramoId: ramo.id, x: Math.max(Math.round(x / encaixe(zoom)) * encaixe(zoom), inicioDoRamo(t, ramo)), titulo: "Novo evento", rotulo: "", texto: "", tipo: "evento", feito: false };
    mudar((c) => ({ ...c, eventos: [...c.eventos, e] }));
    setSelecionado(e.id);
  }

  function editar(id: string, patch: Partial<Evento>) {
    mudar((c) => ({ ...c, eventos: c.eventos.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }

  async function ramificar(origem: Evento) {
    const nome = await perguntar({ titulo: "Novo ramo a partir de “" + (origem.titulo || "evento") + "”", rotulo: "Nome do ramo (ex.: E se o rei morrer?)", confirmar: "Criar ramo" });
    if (!nome) return;
    const ramo: Ramo = { id: uid(), nome: nome.slice(0, 80), cor: CORES_RAMO[t.ramos.length % CORES_RAMO.length], origemId: origem.id };
    const e: Evento = { id: uid(), ramoId: ramo.id, x: origem.x + Math.max(encaixe(zoom), 90 / zoom), titulo: "Início do ramo", rotulo: "", texto: "", tipo: "evento", feito: false };
    mudar((c) => ({ ...c, ramos: [...c.ramos, ramo], eventos: [...c.eventos, e] }));
    setSelecionado(e.id);
  }

  async function novoRamoSolto() {
    const nome = await perguntar({ titulo: "Nova linha paralela", rotulo: "Nome (ex.: Plano do vilão)", confirmar: "Criar" });
    if (!nome) return;
    mudar((c) => ({ ...c, ramos: [...c.ramos, { id: uid(), nome: nome.slice(0, 80), cor: CORES_RAMO[c.ramos.length % CORES_RAMO.length], origemId: null }] }));
  }

  async function renomearRamo(r: Ramo) {
    const nome = await perguntar({ titulo: "Renomear ramo", rotulo: "Nome", inicial: r.nome, confirmar: "Salvar" });
    if (nome) mudar((c) => ({ ...c, ramos: c.ramos.map((x) => (x.id === r.id ? { ...x, nome: nome.slice(0, 80) } : x)) }));
  }

  const patchRamo = (id: string, patch: Partial<Ramo>) => mudar((c) => ({ ...c, ramos: c.ramos.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  async function excluirRamo(r: Ramo) {
    const n = t.eventos.filter((e) => e.ramoId === r.id).length;
    if (!(await confirmar({ titulo: "Excluir ramo", texto: `Excluir “${r.nome}” e seus ${n} evento(s)? Isso não pode ser desfeito.`, confirmar: "Excluir", perigo: true }))) return;
    if (evSel?.ramoId === r.id) setSelecionado(null);
    mudar((c) => removerRamo(c, r.id));
  }

  async function excluirEvento(e: Evento) {
    if (!(await confirmar({ titulo: "Excluir evento", texto: `Excluir “${e.titulo || "sem título"}”?`, confirmar: "Excluir", perigo: true }))) return;
    setSelecionado(null);
    mudar((c) => removerEvento(c, e.id));
  }

  function exportar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: "application/json" }));
    a.download = `timeline-${mesa.nome.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importarArquivo(f: File | undefined) {
    if (!f) return;
    const nova = importar(await f.text());
    if (!nova) return toast("Arquivo não reconhecido como timeline.", "erro");
    if (!(await confirmar({ titulo: "Importar timeline", texto: `Substituir a timeline atual (${t.eventos.length} eventos) por esta (${nova.eventos.length} eventos)?`, confirmar: "Substituir", perigo: true }))) return;
    atualizar(nova);
    setSelecionado(null);
    setVista(enquadrar(nova, largura));
  }

  // ---------- ponteiro: arrastar fundo (pan) e eventos (posição e ramo) ----------
  const ramoNaAltura = (clientY: number): Ramo | undefined => {
    const topo = area.current!.getBoundingClientRect().top + ALTURA_REGUA;
    return ramosVisiveis[clamp(Math.floor((clientY - topo) / ALTURA_RAMO), 0, ramosVisiveis.length - 1)];
  };

  function aoApertar(e: React.PointerEvent) {
    if (e.button !== 0) return;
    area.current!.setPointerCapture(e.pointerId);
    arrasto.current = { tipo: "pan", x0: e.clientX, vx0: vx, mexeu: false };
  }

  function aoApertarEvento(e: React.PointerEvent, ev: Evento) {
    if (e.button !== 0) return;
    e.stopPropagation();
    area.current!.setPointerCapture(e.pointerId);
    arrasto.current = { tipo: "evento", id: ev.id, x0: e.clientX, ex0: ev.x, y0: e.clientY, mexeu: false };
    setSelecionado(ev.id);
  }

  function aoMover(e: React.PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    if (Math.abs(e.clientX - a.x0) > 3 || ("y0" in a && Math.abs(e.clientY - a.y0) > 3)) a.mexeu = true;
    if (!a.mexeu) return;
    if (a.tipo === "pan") return setVista((v) => ({ ...v, vx: a.vx0 - (e.clientX - a.x0) / v.zoom }));
    const ev = tRef.current.eventos.find((x) => x.id === a.id);
    if (!ev) return;
    const ramo = ramoNaAltura(e.clientY) ?? tRef.current.ramos[0];
    const passo = encaixe(zoom);
    const x = Math.max(Math.round((a.ex0 + (e.clientX - a.x0) / zoom) / passo) * passo, inicioDoRamo(tRef.current, ramo));
    if (x !== ev.x || ramo.id !== ev.ramoId) editar(ev.id, { x, ramoId: ramo.id });
  }

  function aoSoltar() {
    const a = arrasto.current;
    arrasto.current = null;
    if (a?.tipo === "pan" && !a.mexeu) setSelecionado(null);
  }

  function aoClicarDuplo(e: React.MouseEvent) {
    const r = ramoNaAltura(e.clientY);
    if (r && e.clientY - area.current!.getBoundingClientRect().top > ALTURA_REGUA) novoEvento(r, xDoPx(e.clientX - area.current!.getBoundingClientRect().left));
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,textarea,select")) return;
    if (e.key === "ArrowLeft") setVista((v) => ({ ...v, vx: v.vx - 120 / v.zoom }));
    else if (e.key === "ArrowRight") setVista((v) => ({ ...v, vx: v.vx + 120 / v.zoom }));
    else if (e.key === "+" || e.key === "=") aplicarZoom(zoom * 1.4);
    else if (e.key === "-") aplicarZoom(zoom / 1.4);
    else if (e.key === "0") ajustar();
    else return;
    e.preventDefault();
  }

  // ---------- régua ----------
  const passo = passoDaRegua(zoom);
  const marcas: number[] = [];
  for (let m = Math.ceil(vx / passo) * passo; px(m) < largura && marcas.length < 400; m += passo) marcas.push(m);

  const minimapa = useMemo(() => {
    const xs = t.eventos.map((e) => e.x);
    if (t.agora !== null) xs.push(t.agora);
    const min = Math.min(...xs, vx), max = Math.max(...xs, vx + largura / zoom);
    return { min, span: Math.max(max - min, 1) };
  }, [t.eventos, t.agora, vx, largura, zoom]);
  const mm = (x: number) => ((x - minimapa.min) / minimapa.span) * 100;
  const moverMinimapa = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.type === "pointermove" && e.buttons !== 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    irPara(minimapa.min + ((e.clientX - r.left) / r.width) * minimapa.span);
  };

  return (
    <>
      <Titulo titulo="Timeline" texto="A linha do tempo da campanha, com ramificações. Só você vê esta página." />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className={botao} onClick={() => novoEvento(ramoAlvo(), xDoPx(largura / 2))}><Plus size={14} /> Evento</button>
        <button className={botao} onClick={novoRamoSolto}><GitBranch size={14} /> Linha paralela</button>
        <button className={botao} disabled={!evSel} onClick={() => evSel && ramificar(evSel)} title="Cria um ramo que nasce do evento selecionado"><GitBranch size={14} /> Ramificar do selecionado</button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button className={botao} onClick={() => aplicarZoom(zoom / 1.6)} aria-label="Menos zoom"><ZoomOut size={14} /></button>
        <input type="range" min={0} max={1000} aria-label="Zoom" className="w-28 accent-[var(--accent)]"
          value={Math.round((Math.log(zoom / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 1000)}
          onChange={(e) => aplicarZoom(ZOOM_MIN * (ZOOM_MAX / ZOOM_MIN) ** (Number(e.target.value) / 1000))} />
        <button className={botao} onClick={() => aplicarZoom(zoom * 1.6)} aria-label="Mais zoom"><ZoomIn size={14} /></button>
        <button className={botao} onClick={ajustar} title="Enquadrar tudo (tecla 0)"><Maximize2 size={14} /> Ver tudo</button>
        <button className={botao} onClick={() => (t.agora !== null ? irPara(t.agora) : toast("Defina o “Agora” primeiro.", "info"))}><Locate size={14} /> Ir ao agora</button>
        <button className={botao} onClick={() => mudar((c) => ({ ...c, agora: Math.round(xDoPx(largura / 2)) }))} title="Marca o centro da tela como o ponto atual da campanha">Marcar agora aqui</button>
        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar evento…" className={`${campo} w-52 pl-8`} />
          {resultados.length > 0 && (
            <ul className="absolute right-0 z-30 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button className="block w-full px-3 py-2 text-left text-sm hover:bg-card-2" onClick={() => { setSelecionado(r.id); irPara(r.x); setBusca(""); }}>
                    <span className="font-medium">{r.titulo || "Sem título"}</span>
                    <span className="ml-2 text-xs text-muted">{r.rotulo || `${formatarX(r.x)} ${t.unidade}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mb-2 cursor-pointer" onPointerDown={moverMinimapa} onPointerMove={moverMinimapa} role="presentation">
        <div className="relative h-7 overflow-hidden rounded-lg border border-border bg-card">
          {t.eventos.map((e) => <i key={e.id} className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ left: `${mm(e.x)}%`, background: corRamo.get(e.ramoId) }} />)}
          {t.agora !== null && <i className="absolute inset-y-0 w-px bg-warn" style={{ left: `${mm(t.agora)}%` }} />}
          <div className="absolute inset-y-0 border border-accent bg-accent/15" style={{ left: `${mm(vx)}%`, width: `${Math.max((largura / zoom / minimapa.span) * 100, 0.6)}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <div className="max-h-[62vh] overflow-y-auto">
            <div className="flex">
              <div className="shrink-0 border-r border-border bg-card-2/40" style={{ width: LARGURA_ROTULOS }}>
                <div style={{ height: ALTURA_REGUA }} className="border-b border-border px-3 pt-2 text-[11px] text-muted">{t.unidade}</div>
                {ramosVisiveis.map((r) => (
                  <div key={r.id} style={{ height: ALTURA_RAMO }} className="flex flex-col justify-center gap-1 border-b border-border px-2">
                    <div className="flex items-center gap-1.5">
                      <button className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: r.cor }} title="Trocar cor"
                        onClick={() => patchRamo(r.id, { cor: CORES_RAMO[(CORES_RAMO.indexOf(r.cor) + 1) % CORES_RAMO.length] })} />
                      <button className="min-w-0 flex-1 truncate text-left text-sm font-medium" title="Renomear" onClick={() => renomearRamo(r)}>{r.nome}</button>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <button title="Ir ao início do ramo" className="text-[11px] underline-offset-2 hover:underline" onClick={() => irPara(inicioDoRamo(t, r))}>início</button>
                      <button title="Esconder ramo" className="hover:text-foreground" onClick={() => patchRamo(r.id, { oculto: true })}><EyeOff size={13} /></button>
                      {r.id !== RAMO_PRINCIPAL && <button title="Excluir ramo" className="hover:text-danger" onClick={() => excluirRamo(r)}><Trash2 size={13} /></button>}
                    </div>
                  </div>
                ))}
              </div>

              <div ref={area} tabIndex={0} onKeyDown={aoTeclar} onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onDoubleClick={aoClicarDuplo}
                className="relative min-w-0 flex-1 touch-none select-none overflow-hidden outline-none" style={{ height: ALTURA_REGUA + alturaCorpo, cursor: "grab" }}>
                {/* régua */}
                <div className="absolute inset-x-0 top-0 border-b border-border bg-card-2/40" style={{ height: ALTURA_REGUA }}>
                  {marcas.map((m) => <span key={m} className="absolute top-2 -translate-x-1/2 text-[11px] text-muted" style={{ left: px(m) }}>{formatarX(m)}</span>)}
                </div>
                {/* linhas, grade e curvas de ramificação */}
                <svg className="pointer-events-none absolute left-0" style={{ top: ALTURA_REGUA }} width={largura} height={alturaCorpo}>
                  {marcas.map((m) => <line key={m} x1={px(m)} x2={px(m)} y1={0} y2={alturaCorpo} className="stroke-border" strokeDasharray="2 6" />)}
                  {ramosVisiveis.map((r, i) => {
                    const y = i * ALTURA_RAMO + ALTURA_RAMO / 2;
                    const origem = r.origemId ? t.eventos.find((e) => e.id === r.origemId) : null;
                    const oi = origem ? indiceRamo.get(origem.ramoId) : undefined;
                    const x0 = px(inicioDoRamo(t, r));
                    const fim = origem && oi !== undefined ? x0 + 36 : x0;
                    return (
                      <g key={r.id} stroke={r.cor} fill="none" strokeWidth={3} strokeLinecap="round" opacity={0.85}>
                        {origem && oi !== undefined && <path d={`M${x0},${oi * ALTURA_RAMO + ALTURA_RAMO / 2} C${x0 + 30},${oi * ALTURA_RAMO + ALTURA_RAMO / 2} ${x0 + 6},${y} ${fim},${y}`} />}
                        <line x1={Math.max(fim, -10)} x2={largura} y1={y} y2={y} />
                      </g>
                    );
                  })}
                  {t.agora !== null && <line x1={px(t.agora)} x2={px(t.agora)} y1={0} y2={alturaCorpo} className="stroke-warn" strokeWidth={2} strokeDasharray="6 4" />}
                </svg>
                {t.agora !== null && <span className="pointer-events-none absolute rounded bg-warn px-1.5 text-[10px] font-semibold text-black" style={{ left: px(t.agora) + 4, top: ALTURA_REGUA + 2 }}>agora</span>}
                {/* eventos (só os que estão na janela) */}
                {t.eventos.map((e) => {
                  const i = indiceRamo.get(e.ramoId);
                  const x = px(e.x);
                  if (i === undefined || x < -120 || x > largura + 120) return null;
                  const ativo = e.id === selecionado;
                  const cor = corRamo.get(e.ramoId);
                  return (
                    <button key={e.id} onPointerDown={(ev) => aoApertarEvento(ev, e)} onDoubleClick={(ev) => ev.stopPropagation()}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center"
                      style={{ left: x, top: ALTURA_REGUA + i * ALTURA_RAMO + ALTURA_RAMO / 2, zIndex: ativo ? 20 : 10 }} title={`${e.titulo} — ${e.rotulo || formatarX(e.x)}`}>
                      <i className={`block h-4 w-4 border-2 ${e.tipo === "marco" ? "rotate-45 rounded-[3px]" : "rounded-full"} ${e.tipo === "segredo" ? "border-dashed" : ""} ${ativo ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
                        style={{ borderColor: cor, background: e.feito ? cor : "var(--card)" }} />
                      {e.tipo === "gancho" && <span className="absolute -top-3.5 text-[11px] font-bold leading-none" style={{ color: cor }}>!</span>}
                      {(ativo || comRotulo.has(e.id)) && <span className="absolute top-5 w-max max-w-[130px] truncate rounded bg-background/80 px-1 text-[11px]">{e.titulo || "Sem título"}</span>}
                    </button>
                  );
                })}
                {!carregado && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">Carregando…</p>}
                {carregado && !t.eventos.length && <p className="pointer-events-none absolute inset-x-0 top-1/2 px-4 text-center text-sm text-muted">Dê dois cliques numa linha para criar o primeiro evento.</p>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted">
            <span>Roda: zoom · Arrastar: mover · Shift+roda: rolar · Duplo clique: novo evento · Setas, + − e 0 no teclado</span>
            <span className="ml-auto">{t.eventos.length} eventos · {t.ramos.length} ramos · zoom {zoom < 1 ? zoom.toFixed(2) : zoom.toFixed(1)}×{bytes > LIMITE_BYTES * 0.8 && <b className="ml-2 text-warn">{Math.round((bytes / LIMITE_BYTES) * 100)}% do limite</b>}</span>
          </div>
        </div>

        <aside className="w-full shrink-0 xl:w-80">
          {evSel ? (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <input value={evSel.titulo} onChange={(e) => editar(evSel.id, { titulo: e.target.value })} placeholder="Título" className={`${campo} font-medium`} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">Posição ({t.unidade})
                  <input type="number" value={evSel.x} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && editar(evSel.id, { x: e.target.valueAsNumber })} className={campo} />
                </label>
                <label className="text-xs text-muted">Rótulo de data
                  <input value={evSel.rotulo} onChange={(e) => editar(evSel.id, { rotulo: e.target.value })} placeholder="Ano 312…" className={campo} />
                </label>
                <label className="text-xs text-muted">Tipo
                  <select value={evSel.tipo} onChange={(e) => editar(evSel.id, { tipo: e.target.value as TipoEvento })} className={campo}>
                    {TIPOS_EVENTO.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted">Ramo
                  <select value={evSel.ramoId} onChange={(e) => editar(evSel.id, { ramoId: e.target.value })} className={campo}>
                    {t.ramos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={evSel.feito} onChange={(e) => editar(evSel.id, { feito: e.target.checked })} /> Já aconteceu na campanha</label>
              <textarea value={evSel.texto} onChange={(e) => editar(evSel.id, { texto: e.target.value })} rows={7} placeholder="Notas, consequências, quem sabe disto…" className={campo} />
              <div className="flex flex-wrap gap-2">
                <button className={botao} onClick={() => ramificar(evSel)}><GitBranch size={14} /> Ramificar daqui</button>
                <button className={`${botao} hover:!border-danger`} onClick={() => excluirEvento(evSel)}><Trash2 size={14} /> Excluir</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
              <p>Selecione um evento para editar. Arraste-o para mudar a posição ou levá-lo a outro ramo.</p>
              <label className="block text-xs">Unidade do eixo
                <input value={t.unidade} onChange={(e) => mudar((c) => ({ ...c, unidade: e.target.value.slice(0, 20) }))} placeholder="dias, anos, sessões…" className={campo} />
              </label>
              {t.agora !== null && <button className={botao} onClick={() => mudar((c) => ({ ...c, agora: null }))}>Remover marcador “agora”</button>}
              {t.ramos.some((r) => r.oculto) && (
                <div>
                  <p className="mb-1 text-xs">Ramos escondidos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.ramos.filter((r) => r.oculto).map((r) => (
                      <button key={r.id} className={botao} onClick={() => patchRamo(r.id, { oculto: false })}><Eye size={13} /> {r.nome}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button className={botao} onClick={exportar}><Download size={14} /> Exportar</button>
                <label className={`${botao} cursor-pointer`}><Upload size={14} /> Importar
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importarArquivo(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
