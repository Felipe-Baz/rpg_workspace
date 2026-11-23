// Extensões: mini-aplicativos (HTML único) criados com IA e executados num iframe isolado.
// Este módulo é puro (sem rede nem DOM): monta o documento do iframe e interpreta a resposta da IA.

import { normalizarManifesto, type Manifesto } from "./manifesto.ts";

export const MAX_HTML = 150_000; // bytes de texto (≈ 150 KB)
export const MAX_DADOS = 50_000; // estado que a extensão pode guardar
export const MAX_TITULO = 80;

export type TemaExtensao = Record<string, string>; // ex.: { "--accent": "#7c3aed" }

/**
 * Política de segurança do documento: sem rede (default-src 'none'), só scripts/estilos inline,
 * imagens/fontes via data:. Combinada com sandbox="allow-scripts" (origem opaca), a extensão
 * não alcança cookies, localStorage, Firebase nem o restante do app.
 */
export const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data:; form-action 'none'";

const BARRA = String.fromCharCode(92);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
// Escapa o JSON embutido no <script>: nada de "<" (fecharia a tag) nem separadores de linha unicode.
const escaparScript = (s: string) => s.split("<").join(BARRA + "u003c").split(LS).join(BARRA + "u2028").split(PS).join(BARRA + "u2029");

/** Ponte `window.RPG`: estado salvo pelo mestre, modo leitura para jogadores. */
function ponte(dados: unknown, somenteLeitura: boolean, permissoes: readonly string[]): string {
  return `(function(){
var inicial=${escaparScript(JSON.stringify(dados ?? null))};
var ouvintes=[];var pend={},seq=0;
function pedir(op,alvo,args){return new Promise(function(res,rej){var id=++seq;pend[id]={res:res,rej:rej};parent.postMessage({rpg:"pedido",id:id,op:op,alvo:alvo,args:args||null},"*");setTimeout(function(){if(pend[id]){delete pend[id];rej(new Error("Tempo esgotado"))}},15000)})}
window.addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||d.rpg!=="resposta"||!pend[d.id])return;var p=pend[d.id];delete pend[d.id];if(d.ok)p.res(d.dados);else p.rej(new Error(d.erro||"Falha"))});
window.RPG={dados:inicial,somenteLeitura:${somenteLeitura ? "true" : "false"},permissoes:${escaparScript(JSON.stringify(permissoes))},
ler:function(alvo,args){return pedir("ler",alvo,args)},rolar:function(expr){return pedir("rolar","dados",{expressao:String(expr)})},
salvar:function(obj){if(window.RPG.somenteLeitura)return;window.RPG.dados=obj;parent.postMessage({rpg:"salvar",dados:obj},"*");},
aoCarregar:function(fn){ouvintes.push(fn);if(inicial!==null)try{fn(inicial)}catch(e){}}};
document.addEventListener("DOMContentLoaded",function(){ouvintes.forEach(function(f){if(inicial!==null)try{f(inicial)}catch(e){}})});
})();`;
}

export function montarDocumento(html: string, opcoes: { tema?: TemaExtensao; dados?: unknown; somenteLeitura?: boolean; permissoes?: readonly string[] } = {}): string {
  const vars = Object.entries(opcoes.tema ?? {})
    .filter(([k, v]) => /^--[a-z0-9-]+$/i.test(k) && /^[#a-z0-9(),.%\s-]+$/i.test(v))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  const cabeca =
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<style>:root{${vars}}html,body{margin:0}body{background:var(--background,#15131a);color:var(--foreground,#f1eef7);font-family:system-ui,sans-serif;padding:12px}</style>` +
    `<script>${ponte(opcoes.dados, !!opcoes.somenteLeitura, opcoes.permissoes ?? [])}</script>`;

  const limpo = html.replace(/<!doctype[^>]*>/i, "");
  // A CSP precisa vir antes de qualquer conteúdo da extensão.
  if (/<head[^>]*>/i.test(limpo)) return `<!doctype html>${limpo.replace(/<head[^>]*>/i, (m) => m + cabeca)}`;
  if (/<html[^>]*>/i.test(limpo)) return `<!doctype html>${limpo.replace(/<html[^>]*>/i, (m) => `${m}<head>${cabeca}</head>`)}`;
  return `<!doctype html><html><head>${cabeca}</head><body>${limpo}</body></html>`;
}

export type RespostaExtensao = { explicacao: string; html: string | null; manifesto: Manifesto | null };

/** Separa a explicação, o documento (bloco ```html) e o manifesto opcional (bloco ```json). Lança se a resposta veio cortada ou grande demais. */
export function interpretarResposta(texto: string): RespostaExtensao {
  // 1. Manifesto: bloco ```json; qualquer erro nele só o descarta (o documento continua valendo).
  let manifesto: Manifesto | null = null;
  const m = /```json[^\S\n]*\n([\s\S]*?)```/i.exec(texto);
  if (m) {
    try { manifesto = normalizarManifesto(JSON.parse(m[1])); } catch { manifesto = null; }
    texto = texto.slice(0, m.index) + texto.slice(m.index + m[0].length);
  }

  // 2. Documento.
  const abertura = /```html[^\S\n]*\n/i.exec(texto);
  if (!abertura) return { explicacao: texto.trim(), html: null, manifesto: null };
  const inicio = abertura.index + abertura[0].length;
  const fim = texto.indexOf("```", inicio);
  if (fim < 0) throw new Error("A resposta da IA veio cortada. Peça de novo, de forma mais simples.");
  const html = texto.slice(inicio, fim).trim();
  if (html.length > MAX_HTML) throw new Error("A extensão gerada ficou grande demais. Peça uma versão mais enxuta.");
  if (html.length < 20 || !html.includes("<")) throw new Error("A IA não devolveu um documento HTML válido.");
  const explicacao = (texto.slice(0, abertura.index) + texto.slice(fim + 3)).trim();
  return { explicacao, html, manifesto };
}

export function validarTitulo(t: string): string {
  return t.trim().slice(0, MAX_TITULO);
}
