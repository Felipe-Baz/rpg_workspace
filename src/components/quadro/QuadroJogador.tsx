"use client";

import { ListaSkeleton } from "@/components/ui/Skeleton";
import { confirmar } from "@/components/ui/Dialogos";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { comprimirImagem } from "@/lib/mapas";
import { CORES_NOTA, atualizarNo, criarNo, excluirNo, useQuadro, type No, type TipoNo } from "@/lib/quadro";

type Vista = { x: number; y: number; s: number };
type Rascunho = Record<string, Partial<Pick<No, "x" | "y" | "w" | "texto">>>;

const ESC_MIN = 0.25;
const ESC_MAX = 2.5;

export default function QuadroJogador({ mesaId, usuarioUid }: { mesaId: string; usuarioUid: string }) {
  const { nos, carregado } = useQuadro(mesaId, usuarioUid, true);
  const [vista, setVista] = useState<Vista>({ x: 0, y: 0, s: 1 });
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [alturas, setAlturas] = useState<Record<string, number>>({});
  const [ligando, setLigando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const area = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const vistaRef = useRef(vista);
  vistaRef.current = vista;

  // Posição efetiva (servidor + rascunho local durante arraste/edição).
  const nosEf = useMemo(() => nos.map((n) => ({ ...n, ...rascunho[n.id] })), [nos, rascunho]);
  const porId = useMemo(() => new Map(nosEf.map((n) => [n.id, n])), [nosEf]);

  const mudar = useCallback((id: string, p: Rascunho[string]) => setRascunho((r) => ({ ...r, [id]: { ...r[id], ...p } })), []);
  const salvar = useCallback(
    (id: string, p: Parameters<typeof atualizarNo>[2]) => {
      const limpar = () =>
        setRascunho((r) => {
          const { [id]: _descartado, ...resto } = r;
          void _descartado;
          return resto;
        });
      atualizarNo(mesaId, id, p)
        .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao salvar."))
        .finally(limpar);
    },
    [mesaId],
  );

  // Zoom com a roda, centrado no cursor.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const v = vistaRef.current;
      const s = Math.min(ESC_MAX, Math.max(ESC_MIN, v.s * Math.exp(-e.deltaY * 0.0015)));
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setVista({ s, x: cx - ((cx - v.x) / v.s) * s, y: cy - ((cy - v.y) / v.s) * s });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [carregado]);

  useEffect(() => {
    const t = (e: KeyboardEvent) => e.key === "Escape" && setLigando(null);
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, []);

  function arrastarFundo(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.fundo) return;
    setLigando(null);
    const ini = { cx: e.clientX, cy: e.clientY, ...vista };
    e.currentTarget.setPointerCapture(e.pointerId);
    const mover = (ev: PointerEvent) => setVista((v) => ({ ...v, x: ini.x + ev.clientX - ini.cx, y: ini.y + ev.clientY - ini.cy }));
    const fim = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", fim);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", fim);
  }

  function centro() {
    const r = area.current?.getBoundingClientRect();
    const v = vistaRef.current;
    const n = nos.length % 6;
    return {
      x: ((r?.width ?? 600) / 2 - v.x) / v.s - 100 + n * 18,
      y: ((r?.height ?? 400) / 2 - v.y) / v.s - 60 + n * 18,
    };
  }

  async function adicionar(tipo: TipoNo, extra: Partial<No> = {}) {
    setErro("");
    try {
      await criarNo(mesaId, usuarioUid, {
        tipo,
        w: tipo === "texto" ? 240 : tipo === "imagem" ? 220 : 200,
        cor: tipo === "nota" ? CORES_NOTA[nos.filter((n) => n.tipo === "nota").length % CORES_NOTA.length] : CORES_NOTA[0],
        ...centro(),
        ...extra,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível adicionar.");
    }
  }

  async function adicionarImagem(arquivo?: File) {
    if (!arquivo) return;
    try {
      await adicionar("imagem", { imagem: await comprimirImagem(arquivo, 900, 200_000) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    }
    if (input.current) input.current.value = "";
  }

  function clicarLigar(id: string) {
    if (!ligando) return setLigando(id);
    if (ligando === id) return setLigando(null);
    const a = porId.get(ligando);
    const b = porId.get(id);
    setLigando(null);
    if (!a || !b) return;
    desligarOuLigar(a, b);
  }

  function desligarOuLigar(a: No, b: No) {
    if (a.ligacoes.includes(b.id)) salvar(a.id, { ligacoes: a.ligacoes.filter((x) => x !== b.id) });
    else if (b.ligacoes.includes(a.id)) salvar(b.id, { ligacoes: b.ligacoes.filter((x) => x !== a.id) });
    else salvar(a.id, { ligacoes: [...a.ligacoes, b.id] });
  }

  async function remover(n: No) {
    if (!(await confirmar({ texto: "Excluir este elemento do quadro?", confirmar: "Excluir", perigo: true }))) return;
    excluirNo(mesaId, n.id).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao excluir."));
    // Limpa ligações que apontavam para ele.
    nos.filter((o) => o.ligacoes.includes(n.id)).forEach((o) => salvar(o.id, { ligacoes: o.ligacoes.filter((x) => x !== n.id) }));
  }

  const linhas = nosEf.flatMap((a) =>
    a.ligacoes.flatMap((id) => {
      const b = porId.get(id);
      return b ? [{ a, b }] : [];
    }),
  );
  const cx = (n: No) => n.x + n.w / 2;
  const cy = (n: No) => n.y + (alturas[n.id] ?? 80) / 2;

  if (!carregado) return <ListaSkeleton />;

  const botao = "rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-border/50";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={botao} onClick={() => adicionar("nota")}>🟨 Post-it</button>
        <button className={botao} onClick={() => adicionar("texto")}>🔤 Texto</button>
        <button className={botao} onClick={() => input.current?.click()}>🖼️ Imagem</button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => adicionarImagem(e.target.files?.[0])} />
        <span className="ml-auto flex items-center gap-1 text-sm text-muted">
          <button className={botao} onClick={() => setVista((v) => ({ ...v, s: Math.max(ESC_MIN, v.s / 1.2) }))} aria-label="Diminuir zoom">−</button>
          <span className="w-12 text-center">{Math.round(vista.s * 100)}%</span>
          <button className={botao} onClick={() => setVista((v) => ({ ...v, s: Math.min(ESC_MAX, v.s * 1.2) }))} aria-label="Aumentar zoom">+</button>
          <button className={botao} onClick={() => setVista({ x: 0, y: 0, s: 1 })}>Centralizar</button>
        </span>
      </div>

      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <p className="text-xs text-muted">
        {ligando
          ? "Clique no 🔗 de outro elemento para ligar com uma linha (Esc cancela)."
          : "Arraste o fundo para mover a visão, a roda do mouse dá zoom. Use ⠿ para mover, 🔗 para ligar elementos e clique numa linha para removê-la. Só você vê este quadro."}
      </p>

      <div
        ref={area}
        onPointerDown={arrastarFundo}
        className="relative h-[70vh] min-h-[420px] touch-none overflow-hidden rounded-xl border border-border bg-card"
        style={{
          cursor: "grab",
          backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--muted) 35%, transparent) 1px, transparent 1px)",
          backgroundSize: `${24 * vista.s}px ${24 * vista.s}px`,
          backgroundPosition: `${vista.x}px ${vista.y}px`,
        }}
      >
        {nos.length === 0 && (
          <p data-fundo="1" className="pointer-events-none absolute inset-0 grid place-items-center text-muted">
            Quadro vazio — adicione post-its, textos ou imagens.
          </p>
        )}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            {linhas.map(({ a, b }) => (
              <g key={`${a.id}-${b.id}`}>
                <line x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
                <line
                  x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)}
                  stroke="transparent" strokeWidth={16}
                  className="pointer-events-auto cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => desligarOuLigar(a, b)}
                >
                  <title>Remover linha</title>
                </line>
                <circle cx={cx(a)} cy={cy(a)} r={5} fill="#991b1b" />
                <circle cx={cx(b)} cy={cy(b)} r={5} fill="#991b1b" />
              </g>
            ))}
          </svg>

          {nosEf.map((n) => (
            <Elemento
              key={n.id}
              no={n}
              escala={vista.s}
              ligando={ligando}
              onMedir={(h) => setAlturas((a) => (a[n.id] === h ? a : { ...a, [n.id]: h }))}
              onMudar={(p) => mudar(n.id, p)}
              onSalvar={(p) => salvar(n.id, p)}
              onLigar={() => clicarLigar(n.id)}
              onExcluir={() => remover(n)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Elemento({
  no,
  escala,
  ligando,
  onMedir,
  onMudar,
  onSalvar,
  onLigar,
  onExcluir,
}: {
  no: No;
  escala: number;
  ligando: string | null;
  onMedir: (h: number) => void;
  onMudar: (p: Partial<Pick<No, "x" | "y" | "w" | "texto">>) => void;
  onSalvar: (p: Partial<Pick<No, "x" | "y" | "w" | "texto" | "cor">>) => void;
  onLigar: () => void;
  onExcluir: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onMedir(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function arrastar(e: React.PointerEvent, modo: "mover" | "largura") {
    e.stopPropagation();
    e.preventDefault();
    const ini = { cx: e.clientX, cy: e.clientY, x: no.x, y: no.y, w: no.w };
    let ult: Partial<Pick<No, "x" | "y" | "w">> = {};
    const mover = (ev: PointerEvent) => {
      const dx = (ev.clientX - ini.cx) / escala;
      const dy = (ev.clientY - ini.cy) / escala;
      ult = modo === "mover" ? { x: ini.x + dx, y: ini.y + dy } : { w: Math.min(700, Math.max(120, ini.w + dx)) };
      onMudar(ult);
    };
    const fim = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", fim);
      if (Object.keys(ult).length) onSalvar(ult);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", fim);
  }

  const nota = no.tipo === "nota";
  const origemLigacao = ligando === no.id;
  const botaoBarra = "rounded px-1 text-xs hover:bg-black/10";

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className={`group absolute rounded-md ${
        nota ? "shadow-lg" : no.tipo === "imagem" ? "bg-white p-2 pb-3 shadow-lg" : "border border-dashed border-border bg-card/70"
      } ${origemLigacao ? "ring-2 ring-danger" : ""}`}
      style={{
        left: no.x,
        top: no.y,
        width: no.w,
        background: nota ? no.cor : undefined,
        color: nota || no.tipo === "imagem" ? "#1c1917" : undefined,
        cursor: "default",
      }}
    >
      <div
        onPointerDown={(e) => arrastar(e, "mover")}
        className="flex cursor-move items-center justify-between rounded-t-md px-1 text-black/50"
        title="Arraste para mover"
      >
        <span className="select-none text-sm">⠿</span>
        <span className="flex items-center opacity-60 transition-opacity group-hover:opacity-100" onPointerDown={(e) => e.stopPropagation()}>
          {nota &&
            CORES_NOTA.map((c) => (
              <button
                key={c}
                aria-label="Mudar cor"
                onClick={() => onSalvar({ cor: c })}
                className={`mx-0.5 size-3 rounded-full border border-black/20 ${no.cor === c ? "ring-1 ring-black/60" : ""}`}
                style={{ background: c }}
              />
            ))}
          <button className={botaoBarra} onClick={onLigar} title="Ligar a outro elemento" aria-label="Ligar">🔗</button>
          <button className={botaoBarra} onClick={onExcluir} title="Excluir" aria-label="Excluir">✕</button>
        </span>
      </div>

      {no.tipo === "imagem" && no.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={no.imagem} alt={no.texto} draggable={false} className="mb-1 block w-full select-none" />
      )}

      <textarea
        value={no.texto}
        onChange={(e) => onMudar({ texto: e.target.value })}
        onBlur={(e) => onSalvar({ texto: e.target.value })}
        placeholder={no.tipo === "imagem" ? "Legenda…" : no.tipo === "texto" ? "Texto…" : "Anotação…"}
        rows={no.tipo === "imagem" ? 1 : 3}
        className={`block w-full resize-none bg-transparent px-2 py-1 outline-none [field-sizing:content] placeholder:text-black/35 ${
          no.tipo === "texto" ? "text-lg font-semibold placeholder:text-muted" : "text-sm"
        } ${no.tipo === "imagem" ? "text-center" : ""}`}
      />

      <div
        onPointerDown={(e) => arrastar(e, "largura")}
        className="absolute bottom-0 right-0 size-3 cursor-ew-resize opacity-0 group-hover:opacity-60"
        title="Ajustar largura"
        style={{ background: "linear-gradient(135deg, transparent 50%, currentColor 50%)" }}
      />
    </div>
  );
}
