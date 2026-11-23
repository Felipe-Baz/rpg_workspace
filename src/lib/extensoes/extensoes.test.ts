import { test } from "node:test";
import assert from "node:assert/strict";
import { CSP, MAX_HTML, interpretarResposta, montarDocumento } from "./documento.ts";
import { montarPedidoExtensao } from "./prompt.ts";

test("interpreta explicação + bloco html", () => {
  const r = interpretarResposta("Criei um gerador.\n```html\n<div>oi mundo, tudo certo</div>\n```");
  assert.equal(r.explicacao, "Criei um gerador.");
  assert.equal(r.html, "<div>oi mundo, tudo certo</div>");
});

test("pergunta de escopo (sem bloco) devolve só a explicação", () => {
  const r = interpretarResposta("Isso deve salvar dados por mesa ou só gerar na hora?");
  assert.equal(r.html, null);
  assert.match(r.explicacao, /salvar dados/);
});

test("resposta cortada, vazia ou grande demais é rejeitada", () => {
  assert.throws(() => interpretarResposta("```html\n<div>sem fim"), /cortada/);
  assert.throws(() => interpretarResposta("```html\nx\n```"), /válido/);
  assert.throws(() => interpretarResposta("```html\n<p>" + "a".repeat(MAX_HTML) + "</p>\n```"), /grande demais/);
});

test("CSP vem antes do conteúdo e bloqueia rede", () => {
  const d = montarDocumento("<h1>Olá</h1><script>fetch('x')</script>");
  assert.ok(d.indexOf("Content-Security-Policy") < d.indexOf("<h1>"));
  assert.match(CSP, /default-src 'none'/);
  assert.doesNotMatch(CSP, /connect-src/);
});

test("injeta a CSP dentro do <head> de um documento completo", () => {
  const d = montarDocumento("<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>");
  assert.ok(d.indexOf("Content-Security-Policy") < d.indexOf("<title>"));
  assert.equal((d.match(/<!doctype/gi) ?? []).length, 1);
});

test("documento com <html> sem <head> também recebe a CSP primeiro", () => {
  const d = montarDocumento("<html><body><p>oi</p></body></html>");
  assert.ok(d.indexOf("Content-Security-Policy") < d.indexOf("<p>"));
});

test("dados iniciais não conseguem fechar o <script>", () => {
  const d = montarDocumento("<p>x</p>", { dados: { a: "</script><img src=x onerror=alert(1)>" } });
  assert.doesNotMatch(d, /<\/script><img/);
  assert.match(d, /\\u003c\/script>/);
});

test("somenteLeitura e tema entram no documento; variáveis inválidas são descartadas", () => {
  const d = montarDocumento("<p>x</p>", { somenteLeitura: true, tema: { "--accent": "#7c3aed", "--x": "red;}body{display:none", "nao-var": "1" } });
  assert.match(d, /somenteLeitura:true/);
  assert.match(d, /--accent:#7c3aed/);
  assert.doesNotMatch(d, /display:none/);
  assert.doesNotMatch(d, /nao-var/);
});

test("pedido ao LLM: limita o histórico e anexa o documento atual na última mensagem do usuário", () => {
  const msgs = Array.from({ length: 30 }, (_, i) => ({ papel: (i % 2 ? "assistente" : "usuario") as "usuario" | "assistente", texto: `m${i}` }));
  const p = montarPedidoExtensao(msgs, "<p>atual</p>");
  assert.equal(p.mensagens.length, 14);
  const ult = [...p.mensagens].reverse().find((m) => m.papel === "usuario")!;
  assert.match(ult.texto!, /<p>atual<\/p>/);
  assert.equal(p.mensagens.filter((m) => m.texto!.includes("<p>atual</p>")).length, 1);
  assert.match(p.sistema!, /window\.RPG\.salvar/);
});

import { NATIVAS, nativaAtiva, nativasDaMesa } from "./nativas.ts";

const MESA_JURAMENTO = "5010347d-14e3-49e2-adb9-eb3bc0952013";

test("Marcas de Pacto existe só na mesa O Juramento de Cinzas", () => {
  assert.equal(nativaAtiva(MESA_JURAMENTO, "marcas-de-pacto"), true);
  assert.equal(nativaAtiva("outra-mesa", "marcas-de-pacto"), false);
  assert.deepEqual(nativasDaMesa("outra-mesa"), []);
  assert.equal(nativasDaMesa(MESA_JURAMENTO)[0].rota, "marcas");
  assert.ok(NATIVAS.every((n) => n.mesas.length > 0));
});

import { nativaVisivel, nativasVisiveis } from "./nativas.ts";

test("Marcas de Pacto: o mestre sempre vê; o jogador vê, salvo se o mestre ocultar", () => {
  assert.equal(nativaVisivel(MESA_JURAMENTO, "marcas-de-pacto", "mestre", {}), true);
  assert.equal(nativaVisivel(MESA_JURAMENTO, "marcas-de-pacto", "mestre", { "marcas-de-pacto": { visivelJogadores: false } }), true);
  assert.equal(nativaVisivel(MESA_JURAMENTO, "marcas-de-pacto", "jogador", {}), true); // padrão: como hoje
  assert.equal(nativaVisivel(MESA_JURAMENTO, "marcas-de-pacto", "jogador", { "marcas-de-pacto": { visivelJogadores: false } }), false);
  assert.equal(nativaVisivel(MESA_JURAMENTO, "marcas-de-pacto", "jogador", { "marcas-de-pacto": { visivelJogadores: true } }), true);
  assert.equal(nativaVisivel("outra-mesa", "marcas-de-pacto", "jogador", {}), false);
  assert.equal(nativasVisiveis(MESA_JURAMENTO, "jogador", { "marcas-de-pacto": { visivelJogadores: false } }).length, 0);
});
