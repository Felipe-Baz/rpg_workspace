// Biblioteca de assets: busca por tag, reuso antes de gerar e exclusão segura. Módulo puro.
import type { Asset, Cena, TipoAsset } from "../../cena/tipos.ts";
import { assetServe } from "../perspectivas/registro.ts";

export const TIPOS_ASSET: { tipo: TipoAsset; nome: string }[] = [
  { tipo: "sprite", nome: "Sprite" },
  { tipo: "textura", nome: "Textura" },
  { tipo: "pincel", nome: "Pincel de caminho" },
  { tipo: "decal", nome: "Decal" },
];

export const tipoDe = (a: Pick<Asset, "tipo">): TipoAsset => a.tipo ?? "sprite";

/** Minúsculas, sem acento, sem pontuação. */
export const normalizarTexto = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

const STOP = new Set(["de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "um", "uma", "com", "sem", "para", "the", "of", "and", "a", "an"]);

/** Palavras relevantes de um texto livre, para virar tags. */
export function tagsDe(texto: string, max = 12): string[] {
  const out: string[] = [];
  for (const p of normalizarTexto(texto).split(" ")) if (p.length > 1 && !STOP.has(p) && !out.includes(p)) out.push(p);
  return out.slice(0, max);
}

/** Tags digitadas pelo mestre ("a, b c") -> lista normalizada e sem repetição. */
export const normalizarTags = (entrada: string | string[], max = 20): string[] =>
  [...new Set((Array.isArray(entrada) ? entrada : entrada.split(",")).flatMap((t) => tagsDe(t)))].slice(0, max);

export interface FiltroAssets {
  busca?: string;
  tipo?: TipoAsset | "";
  temaId?: string;
  /** Se informado, só assets desta perspectiva (assets antigos contam como top-down). */
  perspectivaId?: string;
}

const textoBuscavel = (a: Asset) => normalizarTexto([a.nome, ...(a.tags ?? [])].join(" "));

export function filtrarAssets(assets: Asset[], f: FiltroAssets): Asset[] {
  const termos = tagsDe(f.busca ?? "", 8);
  return assets.filter((a) => {
    if (f.tipo && tipoDe(a) !== f.tipo) return false;
    if (f.temaId && a.temaId !== f.temaId) return false;
    if (f.perspectivaId !== undefined && !assetServe(a, f.perspectivaId)) return false;
    if (!termos.length) return true;
    const t = textoBuscavel(a);
    return termos.every((x) => t.includes(x));
  });
}

export interface SugestaoReuso {
  asset: Asset;
  /** Fração dos termos do pedido que o asset cobre (0–1). */
  pontos: number;
}

/**
 * Assets já existentes que correspondem à descrição, no mesmo tema e perspectiva.
 * Só entram os que cobrem ao menos metade dos termos (e ao menos um).
 */
export function sugerirReuso(
  assets: Asset[],
  descricao: string,
  ctx: { temaId?: string; perspectivaId?: string; tipo?: TipoAsset },
  max = 4,
): SugestaoReuso[] {
  const termos = tagsDe(descricao, 8);
  if (!termos.length) return [];
  const r: SugestaoReuso[] = [];
  for (const a of assets) {
    if ((a.temaId ?? "") !== (ctx.temaId ?? "")) continue;
    if (!assetServe(a, ctx.perspectivaId)) continue;
    if (ctx.tipo && tipoDe(a) !== ctx.tipo) continue;
    const t = textoBuscavel(a);
    const achados = termos.filter((x) => t.includes(x)).length;
    const pontos = achados / termos.length;
    if (achados > 0 && pontos >= 0.5) r.push({ asset: a, pontos });
  }
  return r.sort((x, y) => y.pontos - x.pontos).slice(0, max);
}

export interface UsoEmCena {
  cenaId: string;
  nome: string;
  objetos: number;
}

/** Cenas (com seus objetos já carregados) que usam o asset. */
export function cenasQueUsam(assetId: string, cenas: Pick<Cena, "id" | "nome" | "objetos">[]): UsoEmCena[] {
  const r: UsoEmCena[] = [];
  for (const c of cenas) {
    const n = c.objetos.filter((o) => o.assetId === assetId).length;
    if (n > 0) r.push({ cenaId: c.id, nome: c.nome, objetos: n });
  }
  return r;
}

export type DecisaoExclusao =
  | { ok: true }
  | { ok: false; usos: UsoEmCena[]; motivo: string };

/** Asset em uso só pode ser excluído com um substituto (outro asset, diferente dele). */
export function decidirExclusao(assetId: string, usos: UsoEmCena[], substitutoId?: string): DecisaoExclusao {
  if (usos.length === 0) return { ok: true };
  if (substitutoId && substitutoId !== assetId) return { ok: true };
  const lista = usos.map((u) => `${u.nome} (${u.objetos})`).join(", ");
  return { ok: false, usos, motivo: `O asset está em uso em ${usos.length} cena(s): ${lista}. Escolha um substituto ou cancele.` };
}

/** Troca o asset por outro nos objetos de uma cena (devolve nova cena; a original não muda). */
export function substituirAsset<T extends Pick<Cena, "objetos">>(cena: T, deId: string, paraId: string): T {
  return { ...cena, objetos: cena.objetos.map((o) => (o.assetId === deId ? { ...o, assetId: paraId } : o)) };
}

/**
 * Versão pública de um asset gerado por IA. Só vai o que serve a qualquer mesa: nada de tema, prompt,
 * mesa ou usuário (o tema e o pedido do mestre são privados). Assets enviados nunca são públicos.
 */
export function paraPublico(a: Asset): Asset {
  if (a.origem !== "ia") throw new Error("Só assets gerados por IA podem ser públicos.");
  return {
    id: a.id,
    nome: a.nome,
    url: a.url,
    largura: a.largura,
    altura: a.altura,
    origem: "ia",
    tipo: a.tipo,
    tags: a.tags,
    perspectivaId: a.perspectivaId,
    escalaBase: a.escalaBase,
    naoRepetivel: a.naoRepetivel,
    publico: true,
    geradoPor: a.geradoPor ? { provedor: a.geradoPor.provedor, modelo: a.geradoPor.modelo, prompt: "" } : undefined,
    criadoEm: a.criadoEm,
  };
}
