// Exportar/importar extensões como arquivo .json (compartilhar entre mestres e mesas). Puro e sem dependências de rede.
// O pacote leva SÓ o código e o manifesto: nunca estado salvo, permissões aprovadas, visibilidade nem conversa.
// Importar não concede nada: as permissões do manifesto continuam sendo PEDIDOS que o mestre aprova ao instalar.
import { MAX_HTML, validarTitulo } from "./documento.ts";
import { normalizarManifesto, type Manifesto } from "./manifesto.ts";

export const FORMATO_PACOTE = "rpg-workspace/extensao";
export const MAX_PACOTE = MAX_HTML + 60_000; // html + manifesto + metadados

export type PacoteExtensao = { formato: typeof FORMATO_PACOTE; versao: 1; titulo: string; descricao: string; html: string; manifesto: Manifesto };

export function criarPacote(e: { titulo: string; descricao?: string; html: string; manifesto?: unknown }): PacoteExtensao {
  return { formato: FORMATO_PACOTE, versao: 1, titulo: validarTitulo(e.titulo) || "Extensão sem nome", descricao: (e.descricao ?? "").slice(0, 500), html: e.html, manifesto: normalizarManifesto(e.manifesto) };
}

export const nomeDoArquivo = (titulo: string): string =>
  `${(titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "extensao").slice(0, 40)}.rpgext.json`;

export type ResultadoPacote = { ok: true; pacote: PacoteExtensao } | { ok: false; erro: string };

/** Lê e valida o conteúdo de um arquivo importado. Recusa o que não for exatamente um pacote conhecido. */
export function lerPacote(texto: string): ResultadoPacote {
  if (texto.length > MAX_PACOTE) return { ok: false, erro: "Arquivo grande demais para ser uma extensão." };
  let j: unknown;
  try { j = JSON.parse(texto); } catch { return { ok: false, erro: "O arquivo não é um JSON válido." }; }
  if (!j || typeof j !== "object") return { ok: false, erro: "Arquivo inválido." };
  const { formato, versao, titulo, descricao, html, manifesto } = j as Record<string, unknown>;
  if (formato !== FORMATO_PACOTE) return { ok: false, erro: "Este arquivo não é uma extensão do RPG Workspace." };
  if (versao !== 1) return { ok: false, erro: "Versão de pacote não suportada. Atualize o app ou peça um arquivo novo." };
  if (typeof titulo !== "string" || !titulo.trim()) return { ok: false, erro: "A extensão não tem título." };
  if (typeof html !== "string" || html.length < 20 || !html.includes("<")) return { ok: false, erro: "A extensão não tem um documento HTML válido." };
  if (html.length > MAX_HTML) return { ok: false, erro: "O documento da extensão é grande demais." };
  return { ok: true, pacote: criarPacote({ titulo, descricao: typeof descricao === "string" ? descricao : "", html, manifesto }) };
}
