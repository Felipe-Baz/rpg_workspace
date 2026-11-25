// Timeline do mestre: modelo e funções puras (sem React nem Firebase, testáveis com `npm test`).
// Documento: mesas/{id}/segredos/timeline (só o mestre lê/escreve, coberto pela regra de `segredos/*`).

export type TipoEvento = "marco" | "evento" | "gancho" | "segredo";
export const TIPOS_EVENTO: { id: TipoEvento; rotulo: string }[] = [
  { id: "evento", rotulo: "Evento" },
  { id: "marco", rotulo: "Marco" },
  { id: "gancho", rotulo: "Gancho" },
  { id: "segredo", rotulo: "Segredo" },
];

export type Ramo = {
  id: string;
  nome: string;
  cor: string; // hex
  origemId: string | null; // evento de onde o ramo se ramifica (null = linha principal)
  oculto?: boolean;
};

export type Evento = {
  id: string;
  ramoId: string;
  x: number; // posição na linha (unidade livre: dias, anos, sessões…)
  titulo: string;
  rotulo: string; // texto livre de data ("Ano 312", "Inverno")
  texto: string;
  tipo: TipoEvento;
  feito: boolean; // já aconteceu na campanha
};

export type Timeline = {
  ramos: Ramo[];
  eventos: Evento[];
  agora: number | null; // marcador "estamos aqui"
  unidade: string; // nome da unidade do eixo
};

export const CORES_RAMO = ["#8b5cf6", "#2dd4bf", "#f59e0b", "#ef4444", "#22c55e", "#ec4899", "#38bdf8", "#c9a45c"];
export const LIMITE_BYTES = 900_000; // o documento do Firestore tem teto de 1 MiB
export const ZOOM_MIN = 0.02;
export const ZOOM_MAX = 400;
export const RAMO_PRINCIPAL = "principal";

export const timelineVazia = (): Timeline => ({
  ramos: [{ id: RAMO_PRINCIPAL, nome: "Linha principal", cor: CORES_RAMO[0], origemId: null }],
  eventos: [],
  agora: null,
  unidade: "dias",
});

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const limitarZoom = (z: number) => clamp(z, ZOOM_MIN, ZOOM_MAX);

/** Normaliza o que veio do banco/arquivo: garante a linha principal e descarta lixo (eventos órfãos, números inválidos). */
export function normalizar(bruto: unknown): Timeline {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<Timeline>;
  const vazio = timelineVazia();
  const str = (v: unknown, p = "") => (typeof v === "string" ? v : p);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const ids = new Set<string>();

  let ramos: Ramo[] = [];
  for (const r of Array.isArray(b.ramos) ? b.ramos : []) {
    if (!r || typeof r.id !== "string" || ids.has(r.id)) continue;
    ids.add(r.id);
    ramos.push({ id: r.id, nome: str(r.nome, "Ramo").slice(0, 80), cor: /^#[0-9a-f]{6}$/i.test(str(r.cor)) ? r.cor : CORES_RAMO[0], origemId: typeof r.origemId === "string" ? r.origemId : null, oculto: !!r.oculto });
  }
  if (!ramos.some((r) => r.id === RAMO_PRINCIPAL)) ramos = [vazio.ramos[0], ...ramos];

  const eventos: Evento[] = [];
  const evIds = new Set<string>();
  for (const e of Array.isArray(b.eventos) ? b.eventos : []) {
    const x = num(e?.x);
    if (!e || typeof e.id !== "string" || evIds.has(e.id) || x === null || !ids.has(e.ramoId)) continue;
    evIds.add(e.id);
    eventos.push({
      id: e.id,
      ramoId: e.ramoId,
      x,
      titulo: str(e.titulo).slice(0, 200),
      rotulo: str(e.rotulo).slice(0, 80),
      texto: str(e.texto).slice(0, 20_000),
      tipo: TIPOS_EVENTO.some((t) => t.id === e.tipo) ? e.tipo : "evento",
      feito: !!e.feito,
    });
  }
  // ramo cuja origem sumiu vira ramo solto (origemId = null) em vez de quebrar o desenho
  ramos = ramos.map((r) => (r.origemId && !evIds.has(r.origemId) ? { ...r, origemId: null } : r));
  return { ramos, eventos, agora: num(b.agora), unidade: str(b.unidade, vazio.unidade).slice(0, 20) || vazio.unidade };
}

export const tamanhoBytes = (t: Timeline) => JSON.stringify(t).length;

/** Primeiro x em que o ramo existe (o do evento de origem; ramo solto começa no seu primeiro evento). */
export function inicioDoRamo(t: Timeline, ramo: Ramo): number {
  const origem = ramo.origemId ? t.eventos.find((e) => e.id === ramo.origemId) : null;
  if (origem) return origem.x;
  let min = Infinity;
  for (const e of t.eventos) if (e.ramoId === ramo.id && e.x < min) min = e.x;
  return Number.isFinite(min) ? min : 0;
}

/** Remove um evento; ramos que nasciam dele ficam soltos. */
export function removerEvento(t: Timeline, id: string): Timeline {
  return { ...t, eventos: t.eventos.filter((e) => e.id !== id), ramos: t.ramos.map((r) => (r.origemId === id ? { ...r, origemId: null } : r)) };
}

/** Remove um ramo (exceto o principal), seus eventos, e solta ramos que nasciam de eventos dele. */
export function removerRamo(t: Timeline, ramoId: string): Timeline {
  if (ramoId === RAMO_PRINCIPAL) return t;
  const mortos = new Set(t.eventos.filter((e) => e.ramoId === ramoId).map((e) => e.id));
  return {
    ...t,
    eventos: t.eventos.filter((e) => e.ramoId !== ramoId),
    ramos: t.ramos.filter((r) => r.id !== ramoId).map((r) => (r.origemId && mortos.has(r.origemId) ? { ...r, origemId: null } : r)),
  };
}

/** Passo "bonito" (1, 2, 5 × 10^n) com pelo menos `minPx` pixels entre marcas. */
export function passoDaRegua(zoom: number, minPx = 90): number {
  const bruto = minPx / zoom;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  for (const m of [1, 2, 5, 10]) if (m * pot >= bruto) return m * pot;
  return 10 * pot;
}

/** Formata um valor do eixo sem ruído de ponto flutuante. */
export function formatarX(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

/** Quanto arrastar um evento "gruda": passo da régua dividido por 10, no mínimo 1. */
export const encaixe = (zoom: number) => Math.max(1, passoDaRegua(zoom, 60) / 10);

/** Janela que enquadra todos os eventos (e o marcador "agora") numa largura em pixels. */
export function enquadrar(t: Timeline, largura: number, margemPx = 60): { vx: number; zoom: number } {
  const xs = t.eventos.map((e) => e.x);
  if (t.agora !== null) xs.push(t.agora);
  if (!xs.length) return { vx: -margemPx / 4, zoom: 4 };
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const span = Math.max(max - min, 1);
  const zoom = limitarZoom(Math.max(largura - margemPx * 2, 100) / span);
  return { vx: min - margemPx / zoom, zoom };
}

/** Zoom ancorado no ponto `ancoraPx` da tela: o x do mundo sob o cursor não se move. */
export function zoomAncorado(vx: number, zoom: number, novoZoom: number, ancoraPx: number): { vx: number; zoom: number } {
  const z = limitarZoom(novoZoom);
  const mundo = vx + ancoraPx / zoom;
  return { vx: mundo - ancoraPx / z, zoom: z };
}

/** Rótulos visíveis sem sobreposição: numa lista ordenada por x, mostra o evento se houver `folgaPx` até o próximo. */
export function rotulosVisiveis(xsOrdenados: { id: string; x: number }[], zoom: number, folgaPx = 110): Set<string> {
  const ok = new Set<string>();
  let ultimo = -Infinity;
  for (const e of xsOrdenados) {
    if ((e.x - ultimo) * zoom >= folgaPx) {
      ok.add(e.id);
      ultimo = e.x;
    }
  }
  return ok;
}

/** Busca por título, rótulo e texto, sem acento nem caixa. */
export function buscar(t: Timeline, termo: string, limite = 8): Evento[] {
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const q = n(termo.trim());
  if (!q) return [];
  return t.eventos.filter((e) => n(`${e.titulo} ${e.rotulo} ${e.texto}`).includes(q)).sort((a, b) => a.x - b.x).slice(0, limite);
}

/** Importa um backup `.json`; devolve null se não for uma timeline reconhecível. */
export function importar(texto: string): Timeline | null {
  try {
    const j = JSON.parse(texto);
    if (!j || typeof j !== "object" || !Array.isArray(j.ramos) || !Array.isArray(j.eventos)) return null;
    return normalizar(j);
  } catch {
    return null;
  }
}
