// Conversão de mapa de imagem em mapa de cena (módulo puro; Firebase, Storage e sharp entram por dependências).
// Fluxo: segmentar -> mestre revisa as máscaras -> reconstruir o fundo (inpainting) -> recortar sprites ->
// criar assets, cena e um NOVO mapa. O mapa original nunca é escrito; em falha, tudo o que foi criado é desfeito.
import type { Asset, Cena, ObjetoCena } from "../../cena/tipos.ts";
import { camadasPadrao } from "../../cena/criar.ts";
import { tamanhoExport } from "../../cena/geometria.ts";
import type { Mapa } from "../../mapas.ts";
import type { StatusJob } from "../assets/jobs.ts";
import { normalizarTags } from "../assets/biblioteca.ts";
import type { PixelsRgba, Rgb } from "../fundo.ts";
import { ErroProvedor, type Caixa } from "../tipos.ts";
import { alfaEm, area, decodificarRle, dilatar, dividir, sobrepoe, tocaBorda, unir, codificarRle, type Mascara } from "./mascaras.ts";

/** Lado maior da imagem enviada ao segmentador (e resolução das máscaras). */
export const LADO_TRABALHO = 1024;
/** Objetos por conversão (custo e tempo). */
export const MAX_OBJETOS_CONVERSAO = 12;
/** Objetos reconstruídos por chamada de inpainting. */
export const LOTE_INPAINT = 4;
/** Folga (px de trabalho) ao redor de cada objeto no buraco a reconstruir: cobre sombra e contorno. */
export const RAIO_BURACO = 3;
export const COR_BURACO: Rgb = [255, 0, 255];
/** Fração do buraco que ainda pode ter a cor do buraco depois da edição. Acima disto, a reconstrução falhou. */
export const LIMITE_RESTO_BURACO = 0.2;

export const PROMPT_INPAINT =
  "This is a top-down tabletop RPG map. The areas painted solid magenta (#FF00FF) are holes left where objects were removed. " +
  "Fill ONLY the magenta areas, seamlessly continuing the surrounding floor, ground or terrain (same texture, pattern, lighting and art style), " +
  "as if those objects had never been there. Do not add any new object and do not change anything outside the magenta areas. " +
  "Keep exactly the same framing, proportions and size.";

export const AVISO_SEM_INPAINTING =
  "O provedor de imagem ativo não reconstrói o fundo: a conversão foi parcial e os objetos continuam desenhados na imagem de fundo (ao mover um deles, a cópia original fica no lugar).";

// ---------- Revisão das máscaras ----------

export interface SegmentoRevisao {
  id: string;
  nome: string;
  /** Máscara em RLE no tamanho da revisão. */
  rle: number[];
  aceito: boolean;
  /** Provavelmente cortado ou encoberto: o sprite sai incompleto. */
  incompleto: boolean;
}

export interface Revisao {
  largura: number;
  altura: number;
  segmentos: SegmentoRevisao[];
}

/** Menor e maior área aceitas para um objeto, em fração da imagem (fora disso é ruído ou o próprio fundo). */
export const AREA_MIN = 0.0005;
export const AREA_MAX = 0.6;

/** Toca a borda da imagem ou encosta em outro objeto: parte dele pode estar fora do quadro ou escondida. */
export const provavelIncompleto = (m: Mascara, outras: Mascara[]) => {
  if (tocaBorda(m)) return true;
  const d = dilatar(m, 2);
  return outras.some((o) => o !== m && sobrepoe(d, o));
};

/** Monta a revisão inicial: filtra ruído e fundo, ordena por área e aceita até o limite. */
export function prepararRevisao(
  largura: number,
  altura: number,
  brutos: { rotulo: string; mascara: Mascara }[],
  novoId: () => string,
  limite = MAX_OBJETOS_CONVERSAO,
): Revisao {
  const total = largura * altura;
  const validos = brutos
    .map((b) => ({ ...b, n: area(b.mascara) }))
    .filter((b) => b.n >= Math.max(1, total * AREA_MIN) && b.n <= total * AREA_MAX)
    .sort((a, b) => b.n - a.n);
  const mascaras = validos.map((v) => v.mascara);
  return {
    largura,
    altura,
    segmentos: validos.map((v, i) => ({
      id: novoId(),
      nome: v.rotulo,
      rle: codificarRle(v.mascara),
      aceito: i < limite,
      incompleto: provavelIncompleto(v.mascara, mascaras),
    })),
  };
}

export const mascaraDe = (r: Pick<Revisao, "largura" | "altura">, s: Pick<SegmentoRevisao, "rle">) => decodificarRle(s.rle, r.largura, r.altura);

export function atualizarSegmento(r: Revisao, id: string, patch: Partial<Pick<SegmentoRevisao, "nome" | "aceito" | "incompleto">>): Revisao {
  return { ...r, segmentos: r.segmentos.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** Junta os segmentos indicados num só (no lugar do primeiro), aceito e com o nome do primeiro. */
export function juntarSegmentos(r: Revisao, ids: string[], novoId: () => string): Revisao {
  const alvo = r.segmentos.filter((s) => ids.includes(s.id));
  if (alvo.length < 2) return r;
  const m = unir(...alvo.map((s) => mascaraDe(r, s)));
  const novo: SegmentoRevisao = { id: novoId(), nome: alvo[0].nome, rle: codificarRle(m), aceito: true, incompleto: alvo.some((s) => s.incompleto) };
  const i = r.segmentos.indexOf(alvo[0]);
  const resto = r.segmentos.filter((s) => !ids.includes(s.id));
  return { ...r, segmentos: [...resto.slice(0, i), novo, ...resto.slice(i)] };
}

/** Divide o segmento em partes (componentes separados ou metades), numeradas pelo nome. */
export function dividirSegmento(r: Revisao, id: string, novoId: () => string): Revisao {
  const i = r.segmentos.findIndex((s) => s.id === id);
  if (i < 0) return r;
  const s = r.segmentos[i];
  const partes = dividir(mascaraDe(r, s));
  if (partes.length < 2) return r;
  const novos = partes.map((m, k) => ({ ...s, id: novoId(), nome: `${s.nome} ${k + 1}`, rle: codificarRle(m) }));
  return { ...r, segmentos: [...r.segmentos.slice(0, i), ...novos, ...r.segmentos.slice(i + 1)] };
}

export const aceitos = (r: Revisao) => r.segmentos.filter((s) => s.aceito);

export interface EstimativaConversao {
  objetos: number;
  /** Chamadas de imagem (uma por lote de objetos) para reconstruir o fundo. */
  geracoes: number;
  excedeLimite: boolean;
  parcial: boolean;
}

export function estimarConversao(objetos: number, inpainting: boolean, limite = MAX_OBJETOS_CONVERSAO): EstimativaConversao {
  return { objetos, geracoes: inpainting ? Math.ceil(objetos / LOTE_INPAINT) : 0, excedeLimite: objetos > limite, parcial: !inpainting };
}

// ---------- Pedido (validado no servidor) ----------

export interface ObjetoPedido {
  nome: string;
  rle: number[];
  incompleto: boolean;
}

export interface PedidoConversao {
  mapaId: string;
  colecao: "mapas" | "imagens";
  /** Tamanho das máscaras (imagem de trabalho). */
  largura: number;
  altura: number;
  objetos: ObjetoPedido[];
}

/** Valida o corpo vindo do cliente. Lança Error com mensagem para o mestre. */
export function validarPedidoConversao(bruto: unknown): PedidoConversao {
  const b = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const mapaId = typeof b.mapaId === "string" ? b.mapaId.trim().slice(0, 100) : "";
  if (!mapaId) throw new Error("Mapa ausente.");
  const colecao = b.colecao === "imagens" ? "imagens" : "mapas";
  const largura = Number(b.largura), altura = Number(b.altura);
  const okLado = (n: number) => Number.isInteger(n) && n >= 16 && n <= LADO_TRABALHO;
  if (!okLado(largura) || !okLado(altura)) throw new Error("Tamanho das máscaras inválido.");
  const lista = Array.isArray(b.objetos) ? b.objetos : [];
  if (lista.length === 0) throw new Error("Aceite ao menos um objeto.");
  if (lista.length > MAX_OBJETOS_CONVERSAO) throw new Error(`No máximo ${MAX_OBJETOS_CONVERSAO} objetos por conversão.`);
  const objetos = lista.map((o, i): ObjetoPedido => {
    const x = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    const rle = Array.isArray(x.rle) ? x.rle.map(Number) : [];
    if (area(decodificarRle(rle, largura, altura)) === 0) throw new Error(`O objeto ${i + 1} está vazio.`);
    const nome = (typeof x.nome === "string" ? x.nome.trim() : "").slice(0, 80) || `Objeto ${i + 1}`;
    return { nome, rle, incompleto: x.incompleto === true };
  });
  return { mapaId, colecao, largura, altura, objetos };
}

// ---------- Pixels ----------

/** Cópia com os pixels do buraco (alfa >= 128) pintados de `cor`. */
export function pintarBuraco(img: PixelsRgba, alfa: Uint8Array, cor: Rgb = COR_BURACO): PixelsRgba {
  const data = new Uint8ClampedArray(img.data);
  for (let p = 0; p < alfa.length; p++)
    if (alfa[p] >= 128) {
      data[p * 4] = cor[0];
      data[p * 4 + 1] = cor[1];
      data[p * 4 + 2] = cor[2];
      data[p * 4 + 3] = 255;
    }
  return { data, width: img.width, height: img.height };
}

/** Fundo final: o editado só entra no buraco (com borda suave); fora dele, o original pixel a pixel. */
export function comporFundo(base: PixelsRgba, editado: PixelsRgba, alfa: Uint8Array): PixelsRgba {
  const data = new Uint8ClampedArray(base.data);
  for (let p = 0; p < alfa.length; p++) {
    const a = alfa[p];
    if (!a) continue;
    const t = a / 255;
    for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.round(base.data[p * 4 + c] * (1 - t) + editado.data[p * 4 + c] * t);
    data[p * 4 + 3] = 255;
  }
  return { data, width: base.width, height: base.height };
}

/** Fração do buraco que continua com a cor do buraco (o provedor não preencheu). */
export function restoDoBuraco(editado: PixelsRgba, alfa: Uint8Array, cor: Rgb = COR_BURACO, tolerancia = 70): number {
  let dentro = 0, resto = 0;
  for (let p = 0; p < alfa.length; p++) {
    if (alfa[p] < 128) continue;
    dentro++;
    const i = p * 4;
    if (Math.hypot(editado.data[i] - cor[0], editado.data[i + 1] - cor[1], editado.data[i + 2] - cor[2]) <= tolerancia) resto++;
  }
  return dentro ? resto / dentro : 0;
}

/** Sprite do objeto: pixels originais com o alfa da máscara, recortado ao conteúdo. `caixa` é a posição na imagem. */
export function recortarSprite(img: PixelsRgba, alfa: Uint8Array, limiar = 8): { px: PixelsRgba; caixa: Caixa } | null {
  const { width: w, height: h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alfa[y * w + x] > limiar) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const data = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const p = (y0 + y) * w + x0 + x, o = (y * cw + x) * 4;
      data[o] = img.data[p * 4];
      data[o + 1] = img.data[p * 4 + 1];
      data[o + 2] = img.data[p * 4 + 2];
      data[o + 3] = Math.min(img.data[p * 4 + 3], alfa[p]);
    }
  return { px: { data, width: cw, height: ch }, caixa: { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h } };
}

// ---------- Cena e cópia do mapa ----------

/** Cena "cenário" top-down: fundo reconstruído na camada de terreno (travada) e um objeto por asset, na mesma posição. */
export function montarCena(
  p: { nome: string; mapaId: string; largura: number; altura: number; fundo: Asset; objetos: { asset: Asset; caixa: Caixa }[] },
  novoId: () => string,
  agora = Date.now(),
): Cena {
  const camadas = camadasPadrao(novoId).map((c) => (c.tipo === "terreno" ? { ...c, travada: true } : c));
  const terreno = camadas.find((c) => c.tipo === "terreno")!;
  const objetosCam = camadas.find((c) => c.tipo === "objetos")!;
  const t = tamanhoExport(p);
  const base = { rotacao: 0, espelhado: false };
  const fundo: ObjetoCena = { id: novoId(), assetId: p.fundo.id, camadaId: terreno.id, x: 0.5, y: 0.5, escala: 1, z: 0, ...base };
  // Maiores embaixo: um objeto pequeno sobre um grande (vaso na mesa) continua visível.
  const ordenados = [...p.objetos].sort((a, b) => (b.caixa.x1 - b.caixa.x0) * (b.caixa.y1 - b.caixa.y0) - (a.caixa.x1 - a.caixa.x0) * (a.caixa.y1 - a.caixa.y0));
  const objetos = ordenados.map(({ asset, caixa }, z): ObjetoCena => ({
    id: novoId(),
    assetId: asset.id,
    camadaId: objetosCam.id,
    x: (caixa.x0 + caixa.x1) / 2,
    y: (caixa.y0 + caixa.y1) / 2,
    escala: caixa.x1 - caixa.x0,
    z,
    ...base,
  }));
  return {
    id: novoId(),
    nome: p.nome,
    mapaId: p.mapaId,
    modo: "cenario",
    perspectiva: "topdown",
    largura: t.largura,
    altura: t.altura,
    fundo: "#000000",
    camadas,
    objetos: [fundo, ...objetos],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export type MapaOrigem = Pick<Mapa, "id" | "nome"> & Partial<Pick<Mapa, "zonas" | "cobertas" | "origem" | "cenaId">>;

/** Zonas e coberturas copiadas (cópia profunda: nada é compartilhado com o original). Mesmas frações, mesma imagem. */
export function copiarCoberturas(m: MapaOrigem): Partial<Pick<Mapa, "zonas" | "cobertas">> {
  const out: Partial<Pick<Mapa, "zonas" | "cobertas">> = {};
  if (m.zonas) out.zonas = JSON.parse(JSON.stringify(m.zonas));
  if (m.cobertas) out.cobertas = JSON.parse(JSON.stringify(m.cobertas));
  return out;
}

export interface PinosDoc {
  porMapa?: Record<string, unknown[]>;
  notas?: Record<string, string>;
}

/** Campos a gravar no documento de pinos do jogador para o novo mapa (null se ele não tem nada no original). */
export function copiarPinos(d: PinosDoc, deId: string): { pinos?: unknown[]; nota?: string } | null {
  const pinos = d.porMapa?.[deId];
  const nota = d.notas?.[deId];
  if (!pinos?.length && !nota) return null;
  return { ...(pinos?.length ? { pinos: JSON.parse(JSON.stringify(pinos)) } : {}), ...(nota ? { nota } : {}) };
}

// ---------- Orquestração ----------

/** Erro com mensagem própria para o mestre (sem dados internos). */
export class ErroConversao extends Error {}

export interface ResultadoConversao {
  mapaId: string;
  cenaId: string;
  assetIds: string[];
  avisos: string[];
  parcial: boolean;
}

/** Documento mesas/{id}/jobs/{jobId} de uma conversão (mesma coleção dos jobs de asset). */
export interface JobConversao {
  id: string;
  tipo: "conversao";
  status: StatusJob;
  progresso: number;
  etapa?: string;
  mapaOrigemId: string;
  resultado?: ResultadoConversao;
  erro?: string;
  criadoEm: number;
  atualizadoEm: number;
}

export type NovoMapa = Omit<Mapa, "origem" | "cenaId"> & { origem: "cena"; cenaId: string };

export interface DepsConversao {
  /** Inpainting por instrução: devolve a imagem editada no MESMO tamanho. Ausente = provedor sem inpainting. */
  editar?(img: PixelsRgba, prompt: string): Promise<PixelsRgba>;
  /** Contabiliza uma chamada de imagem bem-sucedida. */
  registrarUso(): Promise<void>;
  salvarImagem(px: PixelsRgba, uso: "fundo" | "sprite"): Promise<{ url: string; caminho: string }>;
  /** Cópia independente da imagem do mapa original (o novo mapa nunca compartilha o arquivo). */
  copiarImagemDoMapa(): Promise<{ url: string; caminho?: string }>;
  apagarArquivo(caminho: string): Promise<void>;
  gravarAsset(a: Asset): Promise<void>;
  apagarAsset(id: string): Promise<void>;
  gravarCena(c: Cena): Promise<void>;
  apagarCena(id: string): Promise<void>;
  copiarPinos(deMapaId: string, paraMapaId: string): Promise<void>;
  apagarPinos(mapaId: string): Promise<void>;
  /** Publica o novo mapa. É SEMPRE a última escrita. */
  gravarMapa(m: NovoMapa): Promise<void>;
  aoProgredir?(etapa: string, pct: number): void;
  novoId(): string;
  agora?(): number;
}

export interface EntradaConversao {
  mapa: MapaOrigem;
  /** Imagem do mapa original, decodificada (já limitada a 4096 px no lado maior). */
  original: PixelsRgba;
  pedido: PedidoConversao;
}

const lotes = <T,>(lista: T[], n: number): T[][] => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, (i + 1) * n));

export async function converterMapa(e: EntradaConversao, deps: DepsConversao): Promise<ResultadoConversao> {
  const { mapa, original, pedido } = e;
  const agora = deps.agora?.() ?? Date.now();
  const prog = (etapa: string, pct: number) => deps.aoProgredir?.(etapa, pct);
  const W = original.width, H = original.height;
  if (Math.abs(W / H - pedido.largura / pedido.altura) > 0.02) throw new ErroConversao("As máscaras não correspondem à imagem do mapa (ela mudou?). Refaça a conversão.");
  const mascaras = pedido.objetos.map((o) => decodificarRle(o.rle, pedido.largura, pedido.altura));
  const avisos: string[] = [];

  // 1) Reconstrução do fundo, antes de qualquer escrita: se falhar, nada foi criado.
  let fundo = original;
  if (deps.editar) {
    const grupos = lotes(mascaras, LOTE_INPAINT);
    for (let g = 0; g < grupos.length; g++) {
      prog("reconstruindo o fundo", 5 + Math.round((g / grupos.length) * 55));
      const alfa = alfaEm(dilatar(unir(...grupos[g]), RAIO_BURACO), W, H);
      const editada = await deps.editar(pintarBuraco(fundo, alfa), PROMPT_INPAINT);
      if (editada.width !== W || editada.height !== H) throw new ErroProvedor("A imagem reconstruída voltou com outro tamanho.");
      if (restoDoBuraco(editada, alfa) > LIMITE_RESTO_BURACO) throw new ErroProvedor("O provedor não reconstruiu o fundo sob os objetos. Tente de novo ou converta menos objetos.");
      fundo = comporFundo(fundo, editada, alfa);
      await deps.registrarUso();
    }
  } else {
    avisos.push(AVISO_SEM_INPAINTING);
  }

  // 2) Sprites recortados do original (o que estava à vista).
  prog("recortando os objetos", 62);
  const sprites = pedido.objetos.map((o, i) => {
    const r = recortarSprite(original, alfaEm(mascaras[i], W, H));
    if (!r) throw new ErroConversao(`O objeto "${o.nome}" ficou vazio no recorte.`);
    return { ...r, o };
  });

  // 3) Escritas, cada uma com o seu desfazer; o mapa novo é o último.
  const desfazer: (() => Promise<void>)[] = [];
  try {
    prog("salvando", 70);
    const novoMapaId = deps.novoId();
    const comum = { origem: "enviado" as const, tipo: "sprite" as const, perspectivaId: "topdown", convertidoDe: mapa.id, criadoEm: agora };

    const arqFundo = await deps.salvarImagem(fundo, "fundo");
    desfazer.push(() => deps.apagarArquivo(arqFundo.caminho));
    const assetFundo: Asset = { id: deps.novoId(), nome: `${mapa.nome} (fundo)`, url: arqFundo.url, largura: W, altura: H, tags: normalizarTags(["fundo", "convertido", mapa.nome]), ...comum };

    const objetos: { asset: Asset; caixa: Caixa }[] = [];
    for (const s of sprites) {
      const arq = await deps.salvarImagem(s.px, "sprite");
      desfazer.push(() => deps.apagarArquivo(arq.caminho));
      const asset: Asset = {
        id: deps.novoId(),
        nome: s.o.nome,
        url: arq.url,
        largura: s.px.width,
        altura: s.px.height,
        tags: normalizarTags([s.o.nome, "convertido"]),
        ...comum,
        ...(s.o.incompleto ? { incompleto: true } : {}),
      };
      objetos.push({ asset, caixa: s.caixa });
    }
    prog("salvando", 80);

    const imagem = await deps.copiarImagemDoMapa();
    if (imagem.caminho) desfazer.push(() => deps.apagarArquivo(imagem.caminho!));

    for (const a of [assetFundo, ...objetos.map((o) => o.asset)]) {
      await deps.gravarAsset(a);
      desfazer.push(() => deps.apagarAsset(a.id));
    }

    const nome = `${mapa.nome} (cena)`;
    const cena = montarCena({ nome, mapaId: novoMapaId, largura: W, altura: H, fundo: assetFundo, objetos }, deps.novoId, agora);
    await deps.gravarCena(cena);
    desfazer.push(() => deps.apagarCena(cena.id));
    prog("salvando", 90);

    await deps.copiarPinos(mapa.id, novoMapaId);
    desfazer.push(() => deps.apagarPinos(novoMapaId));

    // Não liberado a ninguém: o mestre decide quando mostrar.
    await deps.gravarMapa({ id: novoMapaId, nome, imagem: imagem.url, criadoEm: agora, todos: false, liberadoPara: [], ...copiarCoberturas(mapa), origem: "cena", cenaId: cena.id });

    if (objetos.some((o) => o.asset.incompleto)) avisos.push("Alguns objetos estavam cortados ou encobertos e foram marcados como incompletos; complete-os por IA na biblioteca.");
    return { mapaId: novoMapaId, cenaId: cena.id, assetIds: [assetFundo.id, ...objetos.map((o) => o.asset.id)], avisos, parcial: !deps.editar };
  } catch (err) {
    for (const d of desfazer.reverse()) await d().catch(() => {});
    throw err;
  }
}
