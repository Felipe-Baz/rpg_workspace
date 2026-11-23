import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENTO_IDS, EVENTOS, EXEMPLO_EVENTO, criarLimitador, descricaoEventos, diffFichas, diffJogadores, diffMissoes, diffRolagens, diffSessoes, normalizarEventos, permissaoDoEvento } from "./eventos.ts";
import { textoConsentimento } from "./capacidades.ts";
import { montarDocumento } from "./documento.ts";
import { interpretarResposta } from "./documento.ts";
import { normalizarManifesto } from "./manifesto.ts";
import { montarPedidoExtensao } from "./prompt.ts";

test("normalizarEventos mantém só eventos conhecidos, sem repetir", () => {
  assert.deepEqual(normalizarEventos(["ficha.criada", "inventado", "ficha.criada", 3, "missao.concluida"]), ["missao.concluida", "ficha.criada"]);
  assert.deepEqual(normalizarEventos("x"), []);
  assert.deepEqual(normalizarEventos(undefined), []);
});

test("missão concluída: só quando o status MUDA para concluída (não ao carregar nem ao criar)", () => {
  const antes = [{ id: "a", titulo: "A", status: "em_andamento" }, { id: "b", titulo: "B", status: "concluida" }];
  const depois = [{ id: "a", titulo: "A", status: "concluida", categoria: "Principal", dificuldade: "Média" }, { id: "b", titulo: "B", status: "concluida" }, { id: "c", titulo: "C", status: "concluida" }];
  const ev = diffMissoes(antes, depois);
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].dados, { id: "a", titulo: "A", categoria: "Principal", dificuldade: "Média" });
  assert.deepEqual(diffMissoes(depois, depois), []);
});

test("ficha criada: só as novas, guardando de que extensão vieram (para não voltar a ela)", () => {
  const ev = diffFichas([{ id: "1", categoria: "npc", nome: "X" }], [{ id: "1", categoria: "npc", nome: "X" }, { id: "2", categoria: "item", nome: "Anel", origem: { extensao: "ext9" } }]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].origemExtensao, "ext9");
  assert.equal(ev[0].dados.nome, "Anel");
});

test("jogador entrou: personagem que passou a ter conta", () => {
  const antes = [{ id: "1", nome: "Ana", personagem: "Lia", uid: "u1" }, { id: "2", nome: "Bruno", personagem: "Torin" }];
  const depois = [{ id: "1", nome: "Ana", personagem: "Lia", uid: "u1" }, { id: "2", nome: "Bruno", personagem: "Torin", uid: "u2" }, { id: "3", nome: "Carla", personagem: "Mira", uid: "u3" }];
  assert.deepEqual(diffJogadores(antes, depois).map((e) => e.dados.id), ["2", "3"]);
  assert.deepEqual(diffJogadores(depois, depois), []);
});

test("sessão registrada e dados rolados", () => {
  assert.deepEqual(diffSessoes([{ id: "s1", titulo: "a", data: "" }], [{ id: "s1", titulo: "a", data: "" }, { id: "s2", titulo: "b", data: "2026-01-01" }]).map((e) => e.dados.id), ["s2"]);
  // histórico do rolador: mais recente primeiro; devolve na ordem em que aconteceram
  const r = diffRolagens(new Set([1]), [{ id: 3, expressao: "d6", total: 4 }, { id: 2, expressao: "d20", total: 20, critico: "acerto" }, { id: 1, expressao: "d4", total: 1 }]);
  assert.deepEqual(r.map((e) => e.dados.expressao), ["d20", "d6"]);
  assert.equal(r[0].dados.critico, "acerto");
  assert.equal(r[1].dados.critico, null);
});

test("limitador de taxa corta rajadas e libera depois da janela", () => {
  const ok = criarLimitador(3, 1000);
  assert.deepEqual([0, 100, 200, 300].map((t) => ok("e", t)), [true, true, true, false]);
  assert.equal(ok("outra", 300), true); // chaves independentes
  assert.equal(ok("e", 1150), true); // as marcas antigas saíram da janela
});

test("cada evento com leitura exige a permissão equivalente; dados rolados não exige", () => {
  assert.equal(permissaoDoEvento("missao.concluida"), "ler:missoes");
  assert.equal(permissaoDoEvento("dados.rolados"), null);
  for (const e of EVENTO_IDS) assert.ok(EVENTOS[e].rotulo && EXEMPLO_EVENTO[e]);
});

test("manifesto guarda eventos válidos e a IA os propõe no bloco json", () => {
  assert.deepEqual(normalizarManifesto({ encaixes: [{ slot: "sidebar" }], eventos: ["jogador.entrou", "x"] }).eventos, ["jogador.entrou"]);
  assert.deepEqual(normalizarManifesto(undefined).eventos, []);
  const r = interpretarResposta('ok\n```html\n<div>automação pronta, ok</div>\n```\n```json\n{"encaixes":[],"eventos":["missao.concluida"]}\n```');
  assert.deepEqual(r.manifesto!.eventos, ["missao.concluida"]);
});

test("o documento expõe RPG.aoEvento e segundoPlano; o prompt lista os eventos", () => {
  const d = montarDocumento("<p>x</p>", { segundoPlano: true });
  assert.match(d, /aoEvento:function\(n,fn\)/);
  assert.match(d, /segundoPlano:true/);
  assert.match(d, /d\.rpg!=="evento"/);
  assert.match(montarDocumento("<p>x</p>"), /segundoPlano:false/);
  const p = montarPedidoExtensao([{ papel: "usuario", texto: "oi" }]);
  for (const e of EVENTO_IDS) assert.ok(p.sistema!.includes(`"${e}"`), e);
  assert.ok(descricaoEventos().includes("ler:missoes"));
  assert.match(p.sistema!, /pedido ao mestre|envia um pedido/);
});

test("consentimento menciona eventos e o fluxo de pedidos de jogadores", () => {
  const t = textoConsentimento(["ler:missoes", "criar:fichas"], false, ["missao.concluida"]);
  assert.match(t, /reagir sozinha a: missão concluída/);
  assert.match(t, /enquanto você está com a mesa aberta/);
  assert.match(t, /jogador usar a extensão/);
});
