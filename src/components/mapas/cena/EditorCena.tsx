"use client";

import { confirmar } from "@/components/ui/Dialogos";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uid } from "@/lib/mesas";
import { atualizarMapa, type Colecao, type Mapa } from "@/lib/mapas";
import { enviarArquivo, excluirPorUrl } from "@/lib/storage";
import { carregarCena, enviarAsset, salvarCena, useAssets } from "@/lib/cena/cenas";
import {
  aplicar,
  desfazer,
  executar,
  historicoVazio,
  passosRevertidos,
  refazer,
  reverterIa,
  reverterPassos,
  type Comando,
  type Historico,
} from "@/lib/cena/comandos";
import { patchSalvarRender } from "@/lib/cena/compat";
import { alcaEm, baseDoObjeto, clamp01, larguraCelulaFracao, objetoEm, snapGrid, snapVertice, type Alca, type Pt } from "@/lib/cena/geometria";
import { RenderCena } from "@/lib/cena/render";
import type { Camada, Cena, ObjetoCena } from "@/lib/cena/tipos";
import { aplicarPasso, previa } from "@/lib/mapas-ia/agente/passos";
import type { Passo } from "@/lib/mapas-ia/agente/tipos";
import { PERSPECTIVAS, mostrarSeletor, obterPerspectiva } from "@/lib/mapas-ia/perspectivas/registro";
import { useTemas } from "@/lib/mapas-ia/temas/temas";
import BibliotecaAssets from "./BibliotecaAssets";
import ChatIA from "./ChatIA";
import ExportarCena from "./ExportarCena";
import HistoricoEditor from "./HistoricoEditor";

const btn = "rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-border/50 disabled:opacity-40";
const btnAtivo = "rounded-lg border border-accent bg-accent px-2.5 py-1.5 text-sm text-white";

type Arraste =
  | { tipo: "mover"; inicio: Cena; id: string; desloc: Pt }
  | { tipo: "escala"; inicio: Cena; id: string; d0: number; escala0: number }
  | { tipo: "rotacao"; inicio: Cena; id: string };

/** Maior retângulo com a proporção da cena que cabe no container. */
function useEncaixe(ref: React.RefObject<HTMLDivElement | null>, largura?: number, altura?: number) {
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || !largura || !altura) return;
    const calc = () => {
      const esc = Math.min(el.clientWidth / largura, el.clientHeight / altura);
      setTam({ w: Math.floor(largura * esc), h: Math.floor(altura * esc) });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, largura, altura]);
  return tam;
}

export default function EditorCena({
  mesaId,
  mapa,
  colecao,
  pedidoInicial,
  onFechar,
}: {
  mesaId: string;
  mapa: Mapa;
  colecao: Colecao;
  /** Descrição feita ao criar o mapa: abre o chat e já envia ao agente. */
  pedidoInicial?: string;
  onFechar: () => void;
}) {
  const assetsLista = useAssets(mesaId);
  const assets = useMemo(() => new Map(assetsLista.map((a) => [a.id, a])), [assetsLista]);
  const temas = useTemas(mesaId);

  const [cena, setCena] = useState<Cena | null>(null);
  const [cenaSalva, setCenaSalva] = useState<Cena | null>(null);
  const [hist, setHist] = useState<Historico>(historicoVazio());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [selId, setSelId] = useState<string | null>(null);
  const [camadaId, setCamadaId] = useState<string>("");
  const [assetSel, setAssetSel] = useState<string | null>(null);
  const [mostrarGrid, setMostrarGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [medida, setMedida] = useState("");
  const [chatAberto, setChatAberto] = useState(!!pedidoInicial);
  const [previaPassos, setPreviaPassos] = useState<Passo[]>([]);
  const [destaquePrevia, setDestaquePrevia] = useState<string[]>([]);
  const [destacarIa, setDestacarIa] = useState(false);
  const [ferramenta, setFerramenta] = useState<"selecionar" | "paredes">("selecionar");
  const [rascunho, setRascunho] = useState<Pt[]>([]);
  const [exportando, setExportando] = useState(false);

  const area = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const render = useRef<RenderCena | null>(null);
  const [pronto, setPronto] = useState(false);
  const arraste = useRef<Arraste | null>(null);
  const inputAsset = useRef<HTMLInputElement>(null);
  const tam = useEncaixe(area, cena?.largura, cena?.altura);

  const sujo = !!cena && cena !== cenaSalva;

  // Carrega a cena.
  useEffect(() => {
    let vivo = true;
    carregarCena(mesaId, mapa.cenaId!)
      .then((c) => {
        if (!vivo) return;
        if (!c) return setErro("Cena não encontrada.");
        setCena(c);
        setCenaSalva(c);
        setCamadaId(c.camadas.find((x) => x.tipo === "objetos")?.id ?? c.camadas[0]?.id ?? "");
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Falha ao carregar a cena."));
    return () => {
      vivo = false;
    };
  }, [mesaId, mapa.cenaId]);

  // Cria o Pixi (sob demanda) quando a cena chega.
  const temCena = !!cena;
  const dims = cena ? `${cena.largura}x${cena.altura}` : "";
  useEffect(() => {
    if (!temCena || !host.current || !cena) return;
    let cancelado = false;
    let r: RenderCena | null = null;
    RenderCena.criar(host.current, cena)
      .then((nova) => {
        if (cancelado) return nova.destruir();
        r = nova;
        render.current = nova;
        setPronto(true);
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Falha ao iniciar o renderizador."));
    return () => {
      cancelado = true;
      render.current = null;
      setPronto(false);
      r?.destruir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temCena, dims]);

  const pxPorTela = useCallback(() => {
    const c = render.current?.canvas;
    return c && cena ? cena.largura / Math.max(1, c.getBoundingClientRect().width) : 1;
  }, [cena]);

  // Prévia do plano da IA: a cena como ficaria, sem tocar no histórico.
  const emPrevia = previaPassos.length > 0;
  const cenaVista = useMemo(() => (cena && emPrevia ? previa(cena, previaPassos) : cena), [cena, emPrevia, previaPassos]);
  const onPrevia = useCallback((passos: Passo[], destaque: string[]) => {
    setPreviaPassos(passos);
    setDestaquePrevia(destaque);
  }, []);

  // Objetos criados/alterados por passos da IA ainda ativos (para destacar).
  const revertidos = useMemo(() => passosRevertidos(hist), [hist]);
  const aplicados = useMemo(() => new Set(hist.passado.flatMap((e) => (e.meta.passo ? [e.meta.passo.id] : []))), [hist]);
  const objetosIa = useMemo(
    () => hist.passado.flatMap((e) => (e.meta.passo && !revertidos.has(e.meta.passo.id) ? (e.meta.passo.objetos ?? []) : [])),
    [hist, revertidos],
  );
  const destacados = emPrevia ? destaquePrevia : destacarIa ? objetosIa : undefined;

  // Redesenha quando algo muda.
  useEffect(() => {
    if (!pronto || !cenaVista || !render.current) return;
    render.current.atualizar(cenaVista, assets, {
      selecionadoId: emPrevia ? null : selId,
      mostrarGrid,
      pxPorTela: pxPorTela(),
      destacados,
      mostrarParedes: true,
      rascunhoParede: rascunho,
    });
  }, [pronto, cenaVista, assets, selId, mostrarGrid, tam, pxPorTela, emPrevia, destacados, rascunho]);

  // ---- Comandos ----
  const rodar = useCallback(
    (cmd: Comando) => {
      if (!cena) return;
      try {
        const r = executar(cena, hist, cmd);
        setCena(r.cena);
        setHist(r.historico);
        setErro("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Operação inválida.");
      }
    },
    [cena, hist],
  );

  const desfazerFn = useCallback(() => {
    if (!cena) return;
    const r = desfazer(cena, hist);
    setCena(r.cena);
    setHist(r.historico);
    if (selId && !r.cena.objetos.some((o) => o.id === selId)) setSelId(null);
  }, [cena, hist, selId]);

  const refazerFn = useCallback(() => {
    if (!cena) return;
    const r = refazer(cena, hist);
    setCena(r.cena);
    setHist(r.historico);
    if (selId && !r.cena.objetos.some((o) => o.id === selId)) setSelId(null);
  }, [cena, hist, selId]);

  // ---- Passos da IA: cada passo é uma entrada de undo (autoria IA) ----
  const aplicarPassosIa = useCallback(
    (passos: Passo[]) => {
      if (!cena) return 0;
      let c = cena;
      let h = hist;
      let ignorados = 0;
      for (const p of passos) {
        const r = aplicarPasso(c, h, p);
        c = r.cena;
        h = r.historico;
        ignorados += r.ignorados;
      }
      setCena(c);
      setHist(h);
      setErro("");
      return ignorados;
    },
    [cena, hist],
  );

  const reverterResultado = useCallback(
    (r: { cena: Cena; historico: Historico; ignorados: number }) => {
      setCena(r.cena);
      setHist(r.historico);
      setErro(r.ignorados ? `${r.ignorados} ação(ões) da IA já tinham sido alteradas à mão e foram mantidas.` : "");
      if (selId && !r.cena.objetos.some((o) => o.id === selId)) setSelId(null);
    },
    [selId],
  );
  const reverterPassosIa = useCallback((ids: string[]) => cena && reverterResultado(reverterPassos(cena, hist, ids)), [cena, hist, reverterResultado]);
  const reverterTudoIa = useCallback(() => cena && reverterResultado(reverterIa(cena, hist)), [cena, hist, reverterResultado]);

  const sel = cena?.objetos.find((o) => o.id === selId) ?? null;
  const camadaDe = (c: Cena, id: string) => c.camadas.find((x) => x.id === id);

  const duplicar = useCallback(() => {
    if (!cena || !sel) return;
    const passo = larguraCelulaFracao(cena) ?? 0.03;
    const novo: ObjetoCena = { ...sel, id: uid(), x: clamp01(sel.x + passo), y: clamp01(sel.y + passo * (cena.largura / cena.altura)), z: sel.z + 1 };
    rodar({ tipo: "adicionarObjeto", objeto: novo });
    setSelId(novo.id);
  }, [cena, sel, rodar]);

  // Paredes: cada clique é um ponto; duplo clique ou Enter conclui (uma entrada de desfazer por parede).
  const concluirParede = useCallback(() => {
    if (!cena) return;
    const pts = rascunho.filter((p, i) => i === 0 || Math.hypot(p.x - rascunho[i - 1].x, p.y - rascunho[i - 1].y) > 0.002);
    setRascunho([]);
    if (pts.length >= 2) rodar({ tipo: "definirParedes", paredes: [...(cena.paredes ?? []), { id: uid(), pontos: pts }] });
  }, [cena, rascunho, rodar]);

  const remover = useCallback(() => {
    if (!sel) return;
    rodar({ tipo: "removerObjeto", id: sel.id });
    setSelId(null);
  }, [sel, rodar]);

  // Atalhos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [data-modal]")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) refazerFn();
        else desfazerFn();
      } else if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        refazerFn();
      } else if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicar();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        remover();
      } else if (e.key === "Enter" && ferramenta === "paredes") {
        concluirParede();
      } else if (e.key === "Escape") {
        if (rascunho.length) setRascunho([]);
        else if (assetSel) setAssetSel(null);
        else setSelId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desfazerFn, refazerFn, duplicar, remover, assetSel, ferramenta, rascunho, concluirParede]);

  // Aviso do navegador ao sair com alterações pendentes.
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sujo]);

  // ---- Ponteiro ----
  const fracao = (e: React.PointerEvent): Pt => {
    const r = render.current!.canvas.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };
  const emPx = (p: Pt): Pt => ({ x: p.x * cena!.largura, y: p.y * cena!.altura });

  function aoPressionar(e: React.PointerEvent) {
    if (!cena || !render.current || e.button !== 0) return;
    if (emPrevia) return setErro("Prévia do plano da IA: aplique ou descarte os passos no chat para voltar a editar.");
    const p = fracao(e);

    if (ferramenta === "paredes") {
      setRascunho((r) => [...r, snap ? snapVertice(cena, p) : p]);
      return;
    }

    if (assetSel) {
      const a = assets.get(assetSel);
      const camada = camadaDe(cena, camadaId);
      if (!a || !camada) return;
      if (!camada.visivel || camada.travada) return setErro("A camada ativa está oculta ou travada.");
      const pos = snap && cena.grid ? snapGrid(cena, p) : p;
      const larg = (larguraCelulaFracao(cena) ?? 0.1) * (a.escalaBase ?? 1);
      const z = Math.max(-1, ...cena.objetos.filter((o) => o.camadaId === camada.id).map((o) => o.z)) + 1;
      const objeto: ObjetoCena = { id: uid(), assetId: a.id, camadaId: camada.id, x: pos.x, y: pos.y, escala: larg, rotacao: 0, espelhado: false, z };
      rodar({ tipo: "adicionarObjeto", objeto });
      setSelId(objeto.id);
      return;
    }

    const k = pxPorTela();
    if (sel) {
      const a = baseDoObjeto(sel, assets);
      const alca: Alca | null = a ? alcaEm(cena, sel, a, k, emPx(p)) : null;
      if (alca === "escala") {
        const c = { x: sel.x * cena.largura, y: sel.y * cena.altura };
        const pp = emPx(p);
        arraste.current = { tipo: "escala", inicio: cena, id: sel.id, d0: Math.max(1, Math.hypot(pp.x - c.x, pp.y - c.y)), escala0: sel.escala };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      if (alca === "rotacao") {
        arraste.current = { tipo: "rotacao", inicio: cena, id: sel.id };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    const alvo = objetoEm(cena, assets, p);
    setSelId(alvo?.id ?? null);
    if (alvo) {
      arraste.current = { tipo: "mover", inicio: cena, id: alvo.id, desloc: { x: alvo.x - p.x, y: alvo.y - p.y } };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function aoMover(e: React.PointerEvent) {
    const d = arraste.current;
    if (!d || !cena || !render.current) return;
    const p = fracao(e);
    const obj = d.inicio.objetos.find((o) => o.id === d.id);
    if (!obj) return;
    let patch: Partial<ObjetoCena>;
    if (d.tipo === "mover") {
      let pos = { x: clamp01(p.x + d.desloc.x), y: clamp01(p.y + d.desloc.y) };
      if (snap && d.inicio.grid && !e.altKey) pos = snapGrid(d.inicio, pos);
      patch = pos;
    } else if (d.tipo === "escala") {
      const c = { x: obj.x * cena.largura, y: obj.y * cena.altura };
      const pp = emPx(p);
      const dist = Math.hypot(pp.x - c.x, pp.y - c.y);
      patch = { escala: Math.min(2, Math.max(0.005, (d.escala0 * dist) / d.d0)) };
    } else {
      const c = { x: obj.x * cena.largura, y: obj.y * cena.altura };
      const pp = emPx(p);
      let ang = Math.atan2(pp.y - c.y, pp.x - c.x) + Math.PI / 2;
      if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
      patch = { rotacao: ang };
    }
    setCena(aplicar(d.inicio, { tipo: "atualizarObjeto", id: d.id, patch }).cena);
  }

  function aoSoltar() {
    const d = arraste.current;
    arraste.current = null;
    if (!d || !cena) return;
    const atual = cena.objetos.find((o) => o.id === d.id);
    const antes = d.inicio.objetos.find((o) => o.id === d.id);
    if (!atual || !antes) return;
    const patch: Partial<ObjetoCena> = {};
    for (const k of ["x", "y", "escala", "rotacao"] as const) if (atual[k] !== antes[k]) patch[k] = atual[k];
    if (Object.keys(patch).length === 0) return;
    // Um único comando por gesto: volta ao estado inicial e registra o resultado no histórico.
    const r = executar(d.inicio, hist, { tipo: "atualizarObjeto", id: d.id, patch });
    setCena(r.cena);
    setHist(r.historico);
  }

  // ---- Assets, salvar, fechar ----
  async function subirAssets(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEnviando(true);
    setErro("");
    try {
      for (const f of Array.from(arquivos)) await enviarAsset(mesaId, f, cena?.perspectiva);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar o asset.");
    } finally {
      setEnviando(false);
      if (inputAsset.current) inputAsset.current.value = "";
    }
  }

  async function salvar() {
    if (!cena || !render.current) return;
    setSalvando(true);
    setErro("");
    try {
      const blob = await render.current.exportar(cena);
      const url = await enviarArquivo(mesaId, "mapas", blob, "jpg");
      const salva = await salvarCena(mesaId, { ...cena, mapaId: mapa.id });
      await atualizarMapa(mesaId, mapa.id, patchSalvarRender(url), colecao);
      const antiga = mapa.imagem;
      if (antiga !== url) await excluirPorUrl(antiga);
      setCena(salva);
      setCenaSalva(salva);
    } catch (e) {
      setErro(
        e instanceof Error && /taint|insecure|cors/i.test(e.message)
          ? "O navegador bloqueou a imagem (CORS). Configure o CORS do bucket do Storage (veja storage-cors.json)."
          : e instanceof Error
            ? e.message
            : "Falha ao salvar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const fechar = async () => {
    if (sujo && !(await confirmar({ texto: "Há alterações não salvas. Descartá-las?", confirmar: "Descartar", perigo: true }))) return;
    onFechar();
  };

  async function medirDesempenho() {
    if (!cena || !render.current) return;
    const r0 = render.current;
    const camada = camadaDe(cena, camadaId) ?? cena.camadas[0];
    const a = assetsLista[0];
    if (!a) return setMedida("Envie ao menos um asset para medir.");
    setMedida("Medindo…");
    const objetos: Comando[] = Array.from({ length: 500 }, (_, i) => ({
      tipo: "adicionarObjeto",
      objeto: { id: uid(), assetId: a.id, camadaId: camada.id, x: Math.random(), y: Math.random(), escala: 0.04, rotacao: Math.random() * 6, espelhado: i % 2 === 0, z: i },
    }));
    const teste = aplicar(cena, { tipo: "lote", comandos: objetos }).cena;
    r0.atualizar(teste, assets, { mostrarGrid });
    await r0.aguardarTexturas(); // sem isso, os sprites ainda estariam invisíveis
    r0.atualizar(teste, assets, { mostrarGrid });
    const m = r0.medirQuadros(60);
    setMedida(
      m.sprites === 0
        ? "Nenhum sprite visível: a textura não carregou (veja o console)."
        : `${m.sprites} sprites visíveis: ${m.ms.toFixed(2)} ms/quadro com GPU sincronizada (${(1000 / m.ms).toFixed(0)} fps máx.)`,
    );
    if (render.current === r0) r0.atualizar(cena, assets, { selecionadoId: selId, mostrarGrid, pxPorTela: pxPorTela() });
  }

  const camadasInv = cena ? [...cena.camadas].reverse() : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <strong className="mr-2 truncate">{mapa.nome}</strong>
        <button className={btn} onClick={desfazerFn} disabled={!hist.passado.length} title="Ctrl+Z">↶ Desfazer</button>
        <button className={btn} onClick={refazerFn} disabled={!hist.futuro.length} title="Ctrl+Shift+Z">↷ Refazer</button>
        {cena?.grid && (
          <>
            <button className={mostrarGrid ? btnAtivo : btn} onClick={() => setMostrarGrid(!mostrarGrid)}>▦ Grid</button>
            <button className={snap ? btnAtivo : btn} onClick={() => setSnap(!snap)} title="Alt ao arrastar ignora o snap">⌖ Snap</button>
          </>
        )}
        {cena && (
          <label className="flex items-center gap-1 text-sm text-muted">
            Fundo
            <input type="color" value={cena.fundo} onChange={(e) => rodar({ tipo: "definirFundo", fundo: e.target.value })} />
          </label>
        )}
        {cena && mostrarSeletor(cena.modo) && (
          <label className="flex items-center gap-1 text-sm text-muted" title="Só pode ser trocada em mapas sem objetos">
            Perspectiva
            <select
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              value={cena.perspectiva}
              onChange={(ev) => rodar({ tipo: "definirPerspectiva", perspectiva: ev.target.value })}
            >
              {PERSPECTIVAS.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>
        )}
        {cena && !mostrarSeletor(cena.modo) && (
          <span className="text-xs text-muted">Perspectiva: {obterPerspectiva(cena.perspectiva)?.nome ?? "Top-down"} (fixa em grid)</span>
        )}
        {cena && (
          <label className="flex items-center gap-1 text-sm text-muted">
            Tema
            <select
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              value={cena.temaId ?? ""}
              onChange={(ev) => rodar({ tipo: "definirTema", temaId: ev.target.value || undefined })}
            >
              <option value="">Sem tema</option>
              {temas.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>
        )}
        {process.env.NODE_ENV !== "production" && (
          <button className={btn} onClick={medirDesempenho} disabled={!pronto}>⏱ 500 objetos</button>
        )}
        {medida && <span className="text-xs text-muted">{medida}</span>}
        <button
          className={ferramenta === "paredes" ? btnAtivo : btn}
          onClick={() => { setFerramenta(ferramenta === "paredes" ? "selecionar" : "paredes"); setRascunho([]); setAssetSel(null); setSelId(null); }}
          title="Paredes para exportar ao VTT: clique os pontos, duplo clique ou Enter conclui, Esc cancela"
        >
          ✏ Paredes
        </button>
        {ferramenta === "paredes" && !!cena?.paredes?.length && (
          <button className={btn} onClick={() => rodar({ tipo: "definirParedes", paredes: undefined })}>Limpar paredes ({cena.paredes.length})</button>
        )}
        <button className={btn} onClick={() => setExportando(true)} disabled={!pronto || emPrevia}>⇩ Exportar</button>
        <button className={chatAberto ? btnAtivo : btn} onClick={() => setChatAberto(!chatAberto)} title="Criar e editar o mapa conversando com a IA">✦ IA</button>
        <span className="ml-auto text-xs text-muted">{emPrevia ? "Prévia do plano" : sujo ? "Alterações não salvas" : "Salvo"}</span>
        <button className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50" onClick={salvar} disabled={!sujo || salvando || !pronto || emPrevia} title={emPrevia ? "Aplique ou descarte a prévia antes de salvar" : undefined}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button className={btn} onClick={fechar}>Fechar</button>
      </header>
      {erro && <p className="border-b border-border bg-danger/10 px-3 py-1 text-sm text-danger">{erro}</p>}
      {exportando && cena && (
        <ExportarCena cena={cena} nome={mapa.nome} exportar={(o) => render.current!.exportar(cena, o)} onFechar={() => setExportando(false)} />
      )}
      {emPrevia && (
        <p className="border-b border-border bg-cyan-500/10 px-3 py-1 text-sm text-cyan-400">
          Prévia do plano da IA (contornos em ciano). Nada foi aplicado: use o chat para aplicar ou descartar.
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Assets */}
        <aside className="max-h-40 w-full shrink-0 space-y-2 overflow-y-auto border-b border-border p-2 md:max-h-none md:w-52 md:border-b-0 md:border-r">
          <BibliotecaAssets
            mesaId={mesaId}
            cena={cena}
            assets={assetsLista}
            temas={temas}
            assetSel={assetSel}
            onSelecionar={setAssetSel}
            onUpload={() => inputAsset.current?.click()}
            enviando={enviando}
            onErro={setErro}
          />
          <input ref={inputAsset} type="file" accept="image/png,image/webp" multiple hidden onChange={(e) => subirAssets(e.target.files)} />
        </aside>

        {/* Canvas */}
        <div ref={area} className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-black/60 p-2">
          {!cena && !erro && <p className="text-muted">Carregando cena…</p>}
          {cena && (
            <div
              ref={host}
              style={{ width: tam.w, height: tam.h, cursor: assetSel || ferramenta === "paredes" ? "crosshair" : "default" }}
              className="shrink-0 touch-none"
              onPointerDown={aoPressionar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              onDoubleClick={() => ferramenta === "paredes" && concluirParede()}
            />
          )}
        </div>

        {/* Camadas e inspetor */}
        <aside className="max-h-64 w-full shrink-0 space-y-3 overflow-y-auto border-t border-border p-2 md:max-h-none md:w-64 md:border-l md:border-t-0">
          <section className="space-y-1">
            <h3 className="text-xs uppercase tracking-wider text-muted">Camadas</h3>
            {cena &&
              camadasInv.map((c: Camada) => {
                const i = cena.camadas.findIndex((x) => x.id === c.id);
                return (
                  <div key={c.id} className={`space-y-1 rounded-lg border p-1.5 ${camadaId === c.id ? "border-accent" : "border-border"}`}>
                    <div className="flex items-center gap-1">
                      <button className="flex-1 truncate text-left text-sm" onClick={() => setCamadaId(c.id)}>{c.nome}</button>
                      <button title="Visível" className={btn} onClick={() => rodar({ tipo: "atualizarCamada", id: c.id, patch: { visivel: !c.visivel } })}>{c.visivel ? "👁" : "—"}</button>
                      <button title="Travar" className={btn} onClick={() => rodar({ tipo: "atualizarCamada", id: c.id, patch: { travada: !c.travada } })}>{c.travada ? "🔒" : "🔓"}</button>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="range" min={0} max={1} step={0.05} value={c.opacidade} className="flex-1" aria-label="Opacidade"
                        onChange={(e) => rodar({ tipo: "atualizarCamada", id: c.id, patch: { opacidade: Number(e.target.value) } })} />
                      <button className={btn} disabled={i >= cena.camadas.length - 1} title="Subir" onClick={() => rodar({ tipo: "moverCamada", id: c.id, indice: i + 1 })}>↑</button>
                      <button className={btn} disabled={i === 0} title="Descer" onClick={() => rodar({ tipo: "moverCamada", id: c.id, indice: i - 1 })}>↓</button>
                    </div>
                  </div>
                );
              })}
          </section>

          <section className="space-y-2 border-t border-border pt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted">Objeto</h3>
            {!sel && <p className="text-sm text-muted">Clique num objeto para selecionar.</p>}
            {sel && (
              <>
                <label className="block text-xs text-muted">
                  Tamanho
                  <input type="range" min={0.005} max={0.6} step={0.005} value={Math.min(0.6, sel.escala)} className="w-full"
                    onChange={(e) => rodar({ tipo: "atualizarObjeto", id: sel.id, patch: { escala: Number(e.target.value) } })} />
                </label>
                <label className="block text-xs text-muted">
                  Rotação ({Math.round((sel.rotacao * 180) / Math.PI)}°)
                  <input type="range" min={-180} max={180} step={5} value={Math.round(((((sel.rotacao * 180) / Math.PI + 180) % 360) + 360) % 360) - 180} className="w-full"
                    onChange={(e) => rodar({ tipo: "atualizarObjeto", id: sel.id, patch: { rotacao: (Number(e.target.value) * Math.PI) / 180 } })} />
                </label>
                <div className="flex flex-wrap gap-1">
                  <button className={btn} onClick={() => rodar({ tipo: "atualizarObjeto", id: sel.id, patch: { espelhado: !sel.espelhado } })}>⇋ Espelhar</button>
                  <button className={btn} onClick={duplicar} title="Ctrl+D">⧉ Duplicar</button>
                  <button className={btn} onClick={() => rodar({ tipo: "atualizarObjeto", id: sel.id, patch: { z: sel.z + 1 } })}>▲ Frente</button>
                  <button className={btn} onClick={() => rodar({ tipo: "atualizarObjeto", id: sel.id, patch: { z: sel.z - 1 } })}>▼ Trás</button>
                  <button className={`${btn} text-danger`} onClick={remover} title="Delete">🗑 Remover</button>
                </div>
              </>
            )}
          </section>

          <HistoricoEditor
            historico={hist}
            revertidos={revertidos}
            destacarIa={destacarIa}
            onDestacarIa={setDestacarIa}
            onReverterPasso={(id) => reverterPassosIa([id])}
            onReverterIa={reverterTudoIa}
          />
        </aside>

        {chatAberto && cena && (
          <aside className="h-80 w-full shrink-0 border-t border-border md:h-auto md:w-80 md:border-l md:border-t-0">
            <ChatIA
              mesaId={mesaId}
              cena={cena}
              selecao={selId ? [selId] : []}
              aplicados={aplicados}
              revertidos={revertidos}
              pedidoInicial={pedidoInicial}
              onPrevia={onPrevia}
              onAplicar={aplicarPassosIa}
              onReverter={reverterPassosIa}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
