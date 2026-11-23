import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMISSAO_IDS, PERMISSOES, autorizar, descricaoApi, normalizarPermissoes, textoConsentimento, validarPedido } from "./capacidades.ts";
import { DADOS_EXEMPLO, MAX_RESPOSTA, atender, leitorExemplo, limitar } from "./broker-puro.ts";
import { normalizarManifesto } from "./manifesto.ts";
import { montarDocumento } from "./documento.ts";
import { montarPedidoExtensao } from "./prompt.ts";

const pedidoLer = (alvo: string, args: unknown = null) => validarPedido({ rpg: "pedido", id: 1, op: "ler", alvo, args })!;

test("validarPedido aceita só o formato esperado", () => {
  assert.ok(pedidoLer("jogadores"));
  assert.ok(pedidoLer("mundo", { secao: "geografia" }));
  assert.ok(validarPedido({ rpg: "pedido", id: 2, op: "rolar", alvo: "dados", args: { expressao: "2d6+3" } }));
  for (const ruim of [null, 5, "x", {}, { rpg: "outro", id: 1, op: "ler", alvo: "jogadores" }, { rpg: "pedido", id: "1", op: "ler", alvo: "jogadores" },
    { rpg: "pedido", id: 1, op: "ler", alvo: "usuarios" }, { rpg: "pedido", id: 1, op: "escrever", alvo: "fichas" }, { rpg: "pedido", id: 1, op: "ler", alvo: "__proto__" },
    { rpg: "pedido", id: 1, op: "rolar", alvo: "dados", args: { expressao: "x".repeat(100) } }, { rpg: "pedido", id: 1, op: "rolar", alvo: "dados", args: null }]) {
    assert.equal(validarPedido(ruim), null, JSON.stringify(ruim));
  }
});

test("só lê o que o mestre aprovou", () => {
  assert.deepEqual(autorizar(["ler:jogadores"], pedidoLer("jogadores")), { ok: true });
  const r = autorizar(["ler:jogadores"], pedidoLer("fichas"));
  assert.equal(r.ok, false);
  assert.match((r as { erro: string }).erro, /ler:fichas/);
  assert.equal(autorizar([], pedidoLer("mesa")).ok, false);
  // dados não dependem de permissão (não tocam em dados da mesa)
  assert.equal(autorizar([], validarPedido({ rpg: "pedido", id: 1, op: "rolar", alvo: "dados", args: { expressao: "d20" } })!).ok, true);
});

test("cada permissão tem um alvo único e todos os alvos têm leitura de exemplo", () => {
  const alvos = PERMISSAO_IDS.map((p) => PERMISSOES[p].alvo);
  assert.equal(new Set(alvos).size, alvos.length);
  for (const a of alvos) assert.ok(a in DADOS_EXEMPLO, a);
});

test("atender: bloqueia sem permissão, devolve dados de exemplo e rola dados", async () => {
  await assert.rejects(() => atender(pedidoLer("jogadores"), [], leitorExemplo), /Permissão não concedida/);
  const j = (await atender(pedidoLer("jogadores"), ["ler:jogadores"], leitorExemplo)) as { total: number };
  assert.equal(j.total, 4);
  const d = (await atender(validarPedido({ rpg: "pedido", id: 3, op: "rolar", alvo: "dados", args: { expressao: "1d6" } })!, [], leitorExemplo)) as { total: number };
  assert.ok(d.total >= 1 && d.total <= 6);
  await assert.rejects(() => atender(validarPedido({ rpg: "pedido", id: 3, op: "rolar", alvo: "dados", args: { expressao: "abc" } })!, [], leitorExemplo), /inválida/);
  const s = (await atender(pedidoLer("mundo", { secao: "religiao" }), ["ler:mundo"], leitorExemplo)) as { titulo: string };
  assert.equal(s.titulo, "Religião");
  await assert.rejects(() => atender(pedidoLer("mundo", { secao: "nada" }), ["ler:mundo"], leitorExemplo), /não encontrada/);
});

test("limitar corta listas enormes e rejeita respostas gigantes", () => {
  const grande = { itens: Array.from({ length: 1000 }, (_, i) => i) };
  assert.equal(limitar(grande).itens.length, 300);
  assert.throws(() => limitar({ texto: "x".repeat(MAX_RESPOSTA + 10) }), /grande demais/);
});

test("manifesto guarda só permissões conhecidas, mesmo sem encaixes", () => {
  assert.deepEqual(normalizarManifesto({ encaixes: [{ slot: "sidebar" }], permissoes: ["ler:jogadores", "ler:jogadores", "apagar:tudo", 3] }).permissoes, ["ler:jogadores"]);
  assert.deepEqual(normalizarPermissoes("x"), []);
  const m = normalizarManifesto({ permissoes: ["ler:missoes"] });
  assert.deepEqual(m.permissoes, ["ler:missoes"]);
  assert.equal(m.encaixes[0].slot, "sidebar"); // padrão preservado
  assert.deepEqual(normalizarManifesto(undefined).permissoes, []);
});

test("o documento expõe RPG.ler/rolar e as permissões, sem quebrar o <script>", () => {
  const d = montarDocumento("<p>x</p>", { permissoes: ["ler:jogadores"] });
  assert.match(d, /ler:function\(alvo,args\)/);
  assert.match(d, /rolar:function\(expr\)/);
  assert.match(d, /permissoes:\["ler:jogadores"\]/);
  assert.match(d, /e\.source!==parent/); // só aceita resposta do app
});

test("consentimento lista as permissões e avisa sobre dados privados", () => {
  const t = textoConsentimento(["ler:jogadores", "ler:fichas"], true);
  assert.match(t, /Jogadores e personagens/);
  assert.match(t, /Atenção/);
  assert.doesNotMatch(textoConsentimento(["ler:mesa"], false), /Atenção/);
});

test("o prompt documenta cada chamada do catálogo e pede as permissões no manifesto", () => {
  const p = montarPedidoExtensao([{ papel: "usuario", texto: "oi" }]);
  for (const id of PERMISSAO_IDS) assert.match(p.sistema!, new RegExp(`RPG\\.ler\\("${PERMISSOES[id].alvo}"\\)`));
  assert.match(p.sistema!, /"permissoes"/);
  assert.match(descricaoApi(), /RPG\.rolar/);
});
