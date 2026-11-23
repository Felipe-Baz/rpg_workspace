import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAVES_TERMO, TERMOS, TOKENS_TEMA, combinarEfeitos, descricaoEfeitos, efeitosVazios, normalizarEfeitos, razaoContraste, resumoEfeitos, temEfeitos, tituloDoRegistro, validarValores, variaveisDoTema, type DefRecurso } from "./efeitos.ts";
import { textoConsentimento } from "./capacidades.ts";
import { interpretarResposta } from "./documento.ts";
import { normalizarManifesto } from "./manifesto.ts";
import { montarPedidoExtensao } from "./prompt.ts";

const recurso = { id: "faccoes", singular: "Facção", plural: "Facções", campos: [{ id: "nome", rotulo: "Nome", tipo: "texto" }, { id: "poder", rotulo: "Poder", tipo: "numero" }, { id: "atitude", rotulo: "Atitude", tipo: "selecao", opcoes: ["Aliada", "Hostil"] }] };

test("tema: só tokens conhecidos e cores hexadecimais (nada de CSS livre)", () => {
  const e = normalizarEfeitos({ tema: { escuro: { "--accent": " #AA3311 ", "--gold": "red", "--xss": "#fff", "--border": "#fff; background: url(x)", "--card": "#1a1a1a" }, claro: 5 } });
  assert.deepEqual(e.tema.escuro, { "--accent": "#aa3311", "--card": "#1a1a1a" });
  assert.equal(e.tema.claro, undefined);
  assert.deepEqual(variaveisDoTema({ "--accent": "#aa3311", "--gold": "javascript:1" as string }), [["--accent", "#aa3311"]]);
  assert.ok(TOKENS_TEMA.includes("--accent"));
});

test("termos e menu: só chaves do catálogo; igual ao padrão não conta; rótulo sem marcação", () => {
  const e = normalizarEfeitos({ termos: { "fichas.npc": "  Contatos ", mapas: "Mapas", inventado: "x", missoes: "<b>Contratos</b>" }, ocultar: ["quadro", "inicio", "extensoes", "quadro", "segredos"] });
  assert.deepEqual(e.termos, { "fichas.npc": "Contatos", missoes: "bContratos/b" });
  assert.deepEqual(e.ocultar, ["segredos", "quadro"]); // ordem do catálogo; Início/Extensões não existem aqui, então nunca saem do menu
  assert.ok(CHAVES_TERMO.every((c) => TERMOS[c]));
});

test("recursos: valida ids, campos, tipos e opções; descarta o que está incompleto", () => {
  const e = normalizarEfeitos({ recursos: [recurso, { ...recurso, id: "Ruim Id" }, { id: "vazio", singular: "A", plural: "B", campos: [] }, { ...recurso, campos: [{ id: "x", rotulo: "X", tipo: "selecao", opcoes: ["so-uma"] }] }, recurso] });
  assert.equal(e.recursos.length, 1);
  assert.equal(e.recursos[0].campos.length, 3);
  assert.deepEqual(e.recursos[0].campos[2].opcoes, ["Aliada", "Hostil"]);
  const muitos = normalizarEfeitos({ recursos: Array.from({ length: 9 }, (_, i) => ({ ...recurso, id: `r${i}` })) });
  assert.equal(muitos.recursos.length, 5);
});

test("sem nada válido, não há efeitos", () => {
  assert.equal(temEfeitos(normalizarEfeitos(undefined)), false);
  assert.equal(temEfeitos(normalizarEfeitos({ tema: { escuro: { "--accent": "nope" } }, termos: {}, ocultar: [] })), false);
  assert.equal(temEfeitos(normalizarEfeitos({ ocultar: ["quadro"] })), true);
});

test("combinar: a última da ordem vence, ocultar soma, recursos mantêm a extensão de origem", () => {
  const a = { id: "a", titulo: "Horror", efeitos: normalizarEfeitos({ tema: { escuro: { "--accent": "#aa0000", "--gold": "#ccaa66" } }, termos: { "fichas.npc": "Contatos" }, ocultar: ["quadro"], recursos: [recurso] }) };
  const b = { id: "b", titulo: "Corte", efeitos: normalizarEfeitos({ tema: { escuro: { "--accent": "#0044aa" } }, termos: { "fichas.npc": "Cortesãos" }, ocultar: ["imagens"] }) };
  const r = combinarEfeitos([a, b]);
  assert.equal(r.tema.escuro["--accent"], "#0044aa"); // b vence
  assert.equal(r.tema.escuro["--gold"], "#ccaa66"); // sem conflito
  assert.equal(r.termos["fichas.npc"], "Cortesãos");
  assert.deepEqual([...r.ocultar].sort(), ["imagens", "quadro"]);
  assert.equal(r.recursos[0].extId, "a");
  assert.deepEqual(r.conflitos.map((c) => [c.tipo, c.chave, c.vencedora]).sort(), [["termo", "fichas.npc", "Corte"], ["tema", "escuro:--accent", "Corte"]].sort());
  assert.equal(combinarEfeitos([b, a]).tema.escuro["--accent"], "#aa0000"); // a ordem decide
  assert.equal(combinarEfeitos([a, { ...a, id: "c", titulo: "Igual" }]).conflitos.length, 0); // mesmo valor não é conflito
});

test("legibilidade: texto/fundo sem contraste suficiente são descartados e avisados", () => {
  assert.ok(razaoContraste("#000000", "#ffffff") > 20);
  assert.ok(razaoContraste("#15131a", "#f1eef7") > 10);
  const ruim = combinarEfeitos([{ id: "a", titulo: "Ilegível", efeitos: normalizarEfeitos({ tema: { escuro: { "--background": "#222222", "--foreground": "#2a2a2a", "--accent": "#aa0000" } } }) }]);
  assert.equal(ruim.tema.escuro["--background"], undefined);
  assert.equal(ruim.tema.escuro["--foreground"], undefined);
  assert.equal(ruim.tema.escuro["--accent"], "#aa0000"); // o resto da paleta fica
  assert.equal(ruim.conflitos.some((c) => c.tipo === "contraste"), true);
  // só o fundo claro com o texto padrão (claro) do tema escuro também é ilegível
  const so = combinarEfeitos([{ id: "a", titulo: "x", efeitos: normalizarEfeitos({ tema: { escuro: { "--background": "#f5f5f5" } } }) }]);
  assert.equal(so.tema.escuro["--background"], undefined);
  const bom = combinarEfeitos([{ id: "a", titulo: "x", efeitos: normalizarEfeitos({ tema: { escuro: { "--background": "#200a0a", "--foreground": "#ffeedd" } } }) }]);
  assert.equal(bom.tema.escuro["--background"], "#200a0a");
});

test("resumo para consentimento descreve o que muda", () => {
  const linhas = resumoEfeitos(normalizarEfeitos({ tema: { escuro: { "--accent": "#aa0000" } }, termos: { "fichas.npc": "Contatos" }, ocultar: ["quadro"], recursos: [recurso] }));
  assert.equal(linhas.length, 4);
  assert.match(linhas.join(" "), /NPCs → Contatos/);
  assert.match(linhas.join(" "), /ocultar do menu: Quadro/);
  assert.match(linhas.join(" "), /Facções \(3 campos\)/);
  assert.deepEqual(resumoEfeitos(efeitosVazios()), []);
  assert.match(textoConsentimento([], false, [], linhas), /mudar a mesa inteira/);
  assert.doesNotMatch(textoConsentimento([], false, [], []), /mudar a mesa inteira/);
});

test("valores de um registro: tipos, opções e limites", () => {
  const def = normalizarEfeitos({ recursos: [recurso] }).recursos[0] as DefRecurso;
  const ok = validarValores(def, { nome: "  Ordem do Corvo ", poder: "7.5", atitude: "Hostil" });
  assert.deepEqual(ok, { ok: true, valores: { nome: "Ordem do Corvo", poder: 7.5, atitude: "Hostil" } });
  assert.equal(validarValores(def, { nome: "x", poder: "muito" }).ok, false);
  assert.equal(validarValores(def, { nome: "x", atitude: "Amiga" }).ok, false);
  assert.equal(validarValores(def, { nome: "", poder: "", atitude: "" }).ok, false); // tudo vazio
  assert.equal((validarValores(def, { nome: "x".repeat(500) }) as unknown as { valores: { nome: string } }).valores.nome.length, 200);
  assert.equal(tituloDoRegistro(def, { nome: "Corvo", poder: 3 }), "Corvo");
  assert.equal(tituloDoRegistro(def, { poder: 3 }), "3");
});

test("manifesto guarda os efeitos e a IA os propõe no bloco json", () => {
  assert.deepEqual(normalizarManifesto(undefined).mesa, efeitosVazios());
  const m = normalizarManifesto({ encaixes: [{ slot: "sidebar" }], mesa: { ocultar: ["quadro"], termos: { missoes: "Contratos" } } });
  assert.deepEqual(m.mesa.ocultar, ["quadro"]);
  const r = interpretarResposta('ok\n```html\n<div>tema sombrio pronto, ok</div>\n```\n```json\n{"encaixes":[],"mesa":{"termos":{"fichas.item":"Relíquias"}}}\n```');
  assert.equal(r.manifesto!.mesa.termos["fichas.item"], "Relíquias");
});

test("o prompt documenta tema, termos, menu e tipos de dado", () => {
  const p = montarPedidoExtensao([{ papel: "usuario", texto: "oi" }]);
  assert.ok(p.sistema!.includes('"mesa"'));
  for (const c of CHAVES_TERMO) assert.ok(p.sistema!.includes(`"${c}"`), c);
  assert.ok(descricaoEfeitos().includes("--accent"));
  assert.match(p.sistema!, /Não mude a mesa por conta própria/);
});
