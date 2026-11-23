import { test } from "node:test";
import assert from "node:assert/strict";
import { ALTURA_PADRAO, SLOT_IDS, alternarEncaixe, encaixeDe, manifestoPadrao, normalizarManifesto } from "./manifesto.ts";
import { interpretarResposta } from "./documento.ts";
import { montarPedidoExtensao } from "./prompt.ts";

test("sem manifesto (extensões antigas) = só a sidebar, para mestre e jogador", () => {
  for (const v of [undefined, null, 5, "x", {}, { encaixes: "x" }]) assert.deepEqual(normalizarManifesto(v), manifestoPadrao());
  assert.ok(encaixeDe(undefined, "sidebar", "jogador"));
  assert.equal(encaixeDe(undefined, "visao-geral", "mestre"), undefined);
});

test("normaliza: descarta slots desconhecidos e repetidos, ajusta papéis e limites", () => {
  const m = normalizarManifesto({
    encaixes: [
      { slot: "sidebar", rotulo: "  Tesouros  ", papeis: ["mestre"] },
      { slot: "sidebar", rotulo: "duplicado" },
      { slot: "inexistente" },
      { slot: "visao-geral", papeis: ["jogador"], altura: 5000 }, // slot só aceita mestre → papéis inválidos → descartado
      { slot: "sessao.painel", altura: 10 },
      null,
      { slot: "diario.jogador", papeis: ["mestre", "jogador"], rotulo: "x".repeat(100) },
    ],
  });
  assert.deepEqual(m.encaixes.map((e) => e.slot), ["sidebar", "sessao.painel", "diario.jogador"]);
  assert.equal(m.encaixes[0].rotulo, "Tesouros");
  assert.deepEqual(m.encaixes[0].papeis, ["mestre"]);
  assert.equal(m.encaixes[1].altura, 160);
  assert.deepEqual(m.encaixes[2].papeis, ["jogador"]); // "mestre" não existe nesse slot
  assert.equal(m.encaixes[2].rotulo.length, 40);
});

test("lista vazia é respeitada: a extensão não aparece em lugar nenhum", () => {
  assert.deepEqual(normalizarManifesto({ encaixes: [] }).encaixes, []);
});

test("encaixeDe respeita o papel; alternarEncaixe liga e desliga", () => {
  const m = normalizarManifesto({ encaixes: [{ slot: "ctrlk", papeis: ["mestre"] }] });
  assert.ok(encaixeDe(m, "ctrlk", "mestre"));
  assert.equal(encaixeDe(m, "ctrlk", "jogador"), undefined);
  const ligado = alternarEncaixe(m, "sessao.painel", true);
  assert.equal(ligado.encaixes.find((e) => e.slot === "sessao.painel")!.altura, ALTURA_PADRAO);
  assert.equal(alternarEncaixe(ligado, "ctrlk", false).encaixes.some((e) => e.slot === "ctrlk"), false);
});

test("a IA devolve manifesto num bloco json; ele é normalizado e some da explicação", () => {
  const r = interpretarResposta('Feito.\n```html\n<div>ferramenta pronta</div>\n```\n```json\n{"encaixes":[{"slot":"sessao.painel","rotulo":"Rumores"},{"slot":"xxx"}]}\n```');
  assert.equal(r.html, "<div>ferramenta pronta</div>");
  assert.deepEqual(r.manifesto!.encaixes.map((e) => e.slot), ["sessao.painel"]);
  assert.equal(r.explicacao, "Feito.");
});

test("json inválido não derruba a resposta: só fica sem manifesto", () => {
  const r = interpretarResposta("ok\n```html\n<div>ferramenta pronta</div>\n```\n```json\n{quebrado\n```");
  assert.equal(r.html, "<div>ferramenta pronta</div>");
  assert.equal(r.manifesto, null);
});

test("o prompt lista todos os encaixes disponíveis", () => {
  const p = montarPedidoExtensao([{ papel: "usuario", texto: "oi" }]);
  for (const id of SLOT_IDS) assert.match(p.sistema!, new RegExp(`"${id.replace(".", "\\.")}"`));
});
