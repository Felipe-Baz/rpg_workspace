import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_ESTADO, assinarEstado, atenderEstado, autorizarEstado, criarArmazemMemoria, criarBackup, escoposGravaveis, idDocEstado,
  lerBackup, lerIdDocEstado, normalizarEscopos, validarPedidoEstado, type ContextoEstado, type Escopo,
} from "./estado.ts";
import { manifestoPadrao, normalizarManifesto } from "./manifesto.ts";
import { autorizar, descricaoApi, textoConsentimento, validarPedido } from "./capacidades.ts";
import { criarPacote, lerPacote } from "./pacote.ts";
import { diffEstadoJogadores, escopoDoEvento, permissaoDoEvento } from "./eventos.ts";
import { montarDocumento } from "./documento.ts";
import { atender, leitorExemplo } from "./broker-puro.ts";
import { montarPedidoExtensao } from "./prompt.ts";

const JOGADORES = [
  { id: "j1", conta: "uA", nome: "Lia" },
  { id: "j2", conta: "uB", nome: "Torin" },
  { id: "j3", nome: "Sem conta" },
];

function ctx(papel: "mestre" | "jogador", minhaConta: string, aprovados: Escopo[], armazem = criarArmazemMemoria(), podeGravar?: () => boolean): ContextoEstado {
  return { papel, aprovados, jogadores: JOGADORES, minhaConta, armazem, podeGravar };
}
const todos: Escopo[] = ["mestre", "porJogador", "doJogador"];

test("manifesto: 'estado' normalizado; sem ele (extensões antigas) = nenhum escopo extra", () => {
  assert.deepEqual(manifestoPadrao().estado, []);
  assert.deepEqual(normalizarManifesto(undefined).estado, []);
  assert.deepEqual(normalizarManifesto({ estado: ["doJogador", "x", "mestre", "mestre"] }).estado, ["mestre", "doJogador"]);
  assert.deepEqual(normalizarEscopos("mestre"), []);
});

test("ids dos documentos de estado (e o inverso)", () => {
  assert.equal(idDocEstado("compartilhado", "u"), null);
  assert.equal(idDocEstado("mestre", null), "mestre");
  assert.equal(idDocEstado("porJogador", "uA"), "para_uA");
  assert.equal(idDocEstado("doJogador", "uA"), "de_uA");
  assert.equal(idDocEstado("doJogador", null), null);
  assert.deepEqual(lerIdDocEstado("para_uA"), { escopo: "porJogador", uid: "uA" });
  assert.deepEqual(lerIdDocEstado("de_uB"), { escopo: "doJogador", uid: "uB" });
  assert.equal(lerIdDocEstado("para_"), null);
  assert.equal(lerIdDocEstado("outro"), null);
});

test("autorização por papel: jogador nunca toca o escopo do mestre nem dados de outro; mestre nunca grava doJogador", () => {
  const p = (op: "ler" | "salvar" | "listar" | "assinar", escopo: Escopo, jogador: string | null = null) => ({ op, escopo, jogador });
  assert.equal(autorizarEstado([], "mestre", p("ler", "mestre")).ok, false); // não aprovado
  assert.match((autorizarEstado([], "mestre", p("ler", "mestre")) as { erro: string }).erro, /Escopo não aprovado: mestre/);
  assert.equal(autorizarEstado([], "jogador", p("ler", "compartilhado")).ok, true); // compartilhado sempre vale
  assert.equal(autorizarEstado(todos, "jogador", p("ler", "mestre")).ok, false);
  assert.equal(autorizarEstado(todos, "jogador", p("assinar", "mestre")).ok, false);
  assert.equal(autorizarEstado(todos, "jogador", p("listar", "porJogador")).ok, false);
  assert.equal(autorizarEstado(todos, "jogador", p("ler", "porJogador", "j2")).ok, false);
  assert.equal(autorizarEstado(todos, "jogador", p("salvar", "porJogador")).ok, false);
  assert.equal(autorizarEstado(todos, "jogador", p("salvar", "compartilhado")).ok, false);
  assert.equal(autorizarEstado(todos, "jogador", p("salvar", "doJogador")).ok, true);
  assert.equal(autorizarEstado(todos, "mestre", p("salvar", "doJogador", "j1")).ok, false);
  assert.equal(autorizarEstado(todos, "mestre", p("salvar", "porJogador")).ok, false); // falta o jogador
  assert.equal(autorizarEstado(todos, "mestre", p("listar", "mestre")).ok, false);
  assert.equal(autorizarEstado(todos, "mestre", p("assinar", "doJogador")).ok, true); // todos os jogadores
  assert.deepEqual(escoposGravaveis(todos, "jogador"), ["doJogador"]);
  assert.deepEqual(escoposGravaveis(todos, "mestre"), ["compartilhado", "mestre", "porJogador"]);
  assert.deepEqual(escoposGravaveis([], "mestre"), ["compartilhado"]);
});

test("mestre entrega a um jogador; só ele lê o dele; jogador sem conta é erro claro", async () => {
  const armazem = criarArmazemMemoria();
  const mestre = ctx("mestre", "uM", todos, armazem);
  await atenderEstado({ op: "salvar", escopo: "porJogador", jogador: "j1", dados: { etapa: 2 } }, mestre);
  await atenderEstado({ op: "salvar", escopo: "mestre", jogador: null, dados: { gabarito: "x" } }, mestre);
  assert.deepEqual(await atenderEstado({ op: "ler", escopo: "porJogador", jogador: null }, ctx("jogador", "uA", todos, armazem)), { etapa: 2 });
  assert.equal(await atenderEstado({ op: "ler", escopo: "porJogador", jogador: null }, ctx("jogador", "uB", todos, armazem)), null);
  await assert.rejects(() => atenderEstado({ op: "ler", escopo: "mestre", jogador: null }, ctx("jogador", "uA", todos, armazem)), /só do mestre/);
  await assert.rejects(() => atenderEstado({ op: "salvar", escopo: "porJogador", jogador: "j3", dados: 1 }, mestre), /ainda não entrou na mesa/);
  await assert.rejects(() => atenderEstado({ op: "salvar", escopo: "porJogador", jogador: "jx", dados: 1 }, mestre), /não encontrado/);
});

test("jogador grava o próprio doJogador; mestre lista por id de jogador (nunca por uid)", async () => {
  const armazem = criarArmazemMemoria();
  await atenderEstado({ op: "salvar", escopo: "doJogador", jogador: null, dados: { resposta: "fogo" } }, ctx("jogador", "uA", todos, armazem));
  await atenderEstado({ op: "salvar", escopo: "doJogador", jogador: null, dados: { resposta: "água" } }, ctx("jogador", "uB", todos, armazem));
  await armazem.salvar("doJogador", "uSaiu", "{}"); // conta que saiu da mesa: não aparece para a extensão
  const lista = await atenderEstado({ op: "listar", escopo: "doJogador", jogador: null }, ctx("mestre", "uM", todos, armazem));
  assert.deepEqual(lista, { j1: { resposta: "fogo" }, j2: { resposta: "água" } });
});

test("limites: 50 KB por documento e taxa de gravação do jogador", async () => {
  const c = ctx("mestre", "uM", todos);
  await assert.rejects(() => atenderEstado({ op: "salvar", escopo: "mestre", jogador: null, dados: "x".repeat(MAX_ESTADO) }, c), /50 KB/);
  let n = 0;
  const j = ctx("jogador", "uA", todos, criarArmazemMemoria(), () => ++n <= 2);
  await atenderEstado({ op: "salvar", escopo: "doJogador", jogador: null, dados: 1 }, j);
  await atenderEstado({ op: "salvar", escopo: "doJogador", jogador: null, dados: 2 }, j);
  await assert.rejects(() => atenderEstado({ op: "salvar", escopo: "doJogador", jogador: null, dados: 3 }, j), /Muitas gravações/);
});

test("aoMudar: jogador recebe na hora o que o mestre libera; mestre recebe { jogador, dados } de cada um", async () => {
  const armazem = criarArmazemMemoria();
  const recebidos: unknown[] = [];
  const pararJ = assinarEstado(ctx("jogador", "uA", todos, armazem), "porJogador", null, (d) => recebidos.push(d));
  const doMestre: unknown[] = [];
  assinarEstado(ctx("mestre", "uM", todos, armazem), "doJogador", null, (d) => doMestre.push(d));
  await atenderEstado({ op: "salvar", escopo: "porJogador", jogador: "j1", dados: { etapa: 1 } }, ctx("mestre", "uM", todos, armazem));
  await atenderEstado({ op: "salvar", escopo: "porJogador", jogador: "j2", dados: { etapa: 9 } }, ctx("mestre", "uM", todos, armazem)); // não é do j1
  await atenderEstado({ op: "salvar", escopo: "doJogador", jogador: null, dados: { r: "x" } }, ctx("jogador", "uB", todos, armazem));
  pararJ();
  await atenderEstado({ op: "salvar", escopo: "porJogador", jogador: "j1", dados: { etapa: 3 } }, ctx("mestre", "uM", todos, armazem));
  assert.deepEqual(recebidos, [null, { etapa: 1 }]); // valor inicial + a mudança; nada depois de cancelar
  assert.deepEqual(doMestre, [{ jogador: "j2", dados: { r: "x" } }]);
  assert.throws(() => assinarEstado(ctx("jogador", "uA", todos, armazem), "mestre", null, () => {}), /só do mestre/);
});

test("pedido 'estado' vindo do iframe: valida formato; o broker exige quem atenda", async () => {
  assert.equal(validarPedido({ rpg: "pedido", id: 1, op: "estado", alvo: "ler", args: { escopo: "nada" } }), null);
  assert.equal(validarPedido({ rpg: "pedido", id: 1, op: "estado", alvo: "apagar", args: { escopo: "mestre" } }), null);
  assert.equal(validarPedidoEstado("ler", { escopo: "porJogador", jogador: 5 }), null);
  const p = validarPedido({ rpg: "pedido", id: 2, op: "estado", alvo: "salvar", args: { escopo: "doJogador", dados: { a: 1 } } })!;
  assert.deepEqual(p.args, { op: "salvar", escopo: "doJogador", jogador: null, dados: { a: 1 } });
  await assert.rejects(() => atender(p, [], leitorExemplo), /não pode guardar dados/);
  assert.deepEqual(await atender(p, [], leitorExemplo, undefined, undefined, async (x) => x.op), "salvar");
});

test("consentimento lista os escopos, destaca a escrita do jogador e lembra que o código é visível", () => {
  const t = textoConsentimento([], true, [], [], ["mestre", "doJogador"]);
  assert.match(t, /Só do mestre/);
  assert.match(t, /CADA JOGADOR gravar até 50 KB/);
  assert.match(t, /CÓDIGO da extensão é visível/);
  assert.doesNotMatch(textoConsentimento(["ler:mesa"], true), /CÓDIGO/);
});

test("prompt e API ensinam os escopos e proíbem segredos no HTML", () => {
  const api = descricaoApi();
  assert.match(api, /RPG\.estado\.salvar/);
  assert.match(api, /NUNCA coloque no HTML gabaritos/);
  assert.match(api, /RPG\.alterar\("ficha"/);
  assert.match(montarPedidoExtensao([{ papel: "usuario", texto: "x" }]).sistema ?? "", /"estado":\[\]/);
});

test("ponte: RPG.estado, RPG.eu e RPG.podeSalvar entram no documento", () => {
  const d = montarDocumento("<p>oi</p>", { eu: "j1", gravaveis: ["doJogador"], somenteLeitura: true });
  assert.match(d, /eu:"j1"/);
  assert.match(d, /var grava=\["doJogador"\]/);
  assert.match(d, /estado:\{ler:function/);
  assert.match(d, /rpg:"assinar"/);
  assert.match(montarDocumento("<p>oi</p>"), /var grava=\["compartilhado"\]/); // mestre (padrão): só o legado
});

test("pacote exportado leva os escopos pedidos, mas nunca dados nem dados iniciais", () => {
  const pac = criarPacote({ titulo: "Enigmas", html: "<div>enigmas por jogador</div>", manifesto: { estado: ["mestre", "doJogador"] }, estadoInicial: { mestre: '{"gabarito":1}' } } as never);
  assert.deepEqual(pac.manifesto.estado, ["mestre", "doJogador"]);
  const texto = JSON.stringify(pac);
  assert.doesNotMatch(texto, /gabarito|estadoInicial/);
  assert.equal(lerPacote(texto).ok, true);
});

test("evento estado.jogadorSalvou: exige o escopo doJogador; primeira leitura é base; só contas da mesa", () => {
  assert.equal(escopoDoEvento("estado.jogadorSalvou"), "doJogador");
  assert.equal(permissaoDoEvento("estado.jogadorSalvou"), null);
  assert.equal(escopoDoEvento("ficha.criada"), null);
  const jog = [{ id: "j1", uid: "uA" }];
  assert.deepEqual(diffEstadoJogadores(null, new Map([["uA", 1]]), jog), []);
  assert.deepEqual(diffEstadoJogadores(new Map([["uA", 1]]), new Map([["uA", 1]]), jog), []);
  assert.deepEqual(diffEstadoJogadores(new Map([["uA", 1]]), new Map([["uA", 2], ["uX", 5]]), jog), [{ evento: "estado.jogadorSalvou", dados: { jogador: "j1", atualizadoEm: 2 } }]);
});

test("backup: ida e volta; recusa arquivo estranho ou documento grande demais", () => {
  const b = criarBackup({ extId: "e1", compartilhado: '{"a":1}', mestre: null, porJogador: { j1: '{"etapa":2}' }, doJogador: {} });
  const r = lerBackup(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.deepEqual((r as { backup: unknown }).backup, b);
  assert.equal(lerBackup("{").ok, false);
  assert.equal(lerBackup(JSON.stringify({ formato: "outro", versao: 1 })).ok, false);
  assert.equal(lerBackup(JSON.stringify({ ...b, mestre: "x".repeat(MAX_ESTADO + 1) })).ok, false);
  assert.equal(lerBackup(JSON.stringify({ ...b, porJogador: { j1: "{inválido" } })).ok, false);
});

test("regras do Firestore: estado/ fechado para jogador fora do próprio documento e sem aprovação", () => {
  const regras = readFileSync("firestore.rules", "utf8").replace(/\r\n/g, "\n");
  const i = regras.indexOf("match /estado/{docId}");
  assert.ok(i > 0, "bloco estado/ existe");
  const bloco = regras.slice(i, regras.indexOf("\n        }\n", i));
  assert.match(bloco, /allow read, delete: if mestreMesa\(\);/);
  // o mestre grava só 'mestre' e 'para_*' (nunca forja 'de_*')
  assert.match(bloco, /mestreMesa\(\) && \(docId == 'mestre' \|\| docId\.matches\('para_\.\+'\)\)/);
  // jogador: só o próprio documento, com a extensão aberta e o escopo aprovado
  assert.match(bloco, /docId == 'para_' \+ request\.auth\.uid && escopoAprovado\('porJogador'\)/);
  assert.match(bloco, /docId == 'de_' \+ request\.auth\.uid && instAberta\(\) && escopoAprovado\('doJogador'\)/);
  assert.match(bloco, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.doesNotMatch(bloco, /allow list: if membroMesa/);
  const funcoes = regras.slice(regras.indexOf("function instAberta()"), i);
  assert.match(funcoes, /visivelJogadores', false\) == true && i\.get\('ativa', true\) != false/);
  assert.match(funcoes, /json\.size\(\) <= 50000/);
  assert.match(funcoes, /keys\(\)\.hasOnly\(\['json', 'uid', 'atualizadoEm'\]\)/);
});

test("permissões de alteração: criar não dá direito a alterar (e vice-versa)", () => {
  const pedido = validarPedido({ rpg: "pedido", id: 3, op: "propor", alvo: "acoes", args: { acoes: [{ tipo: "ficha", op: "alterar", id: "f1", mudancas: { nome: "Novo" } }] } })!;
  assert.match((autorizar(["criar:fichas"], pedido) as { erro: string }).erro, /alterar:fichas/);
  assert.equal(autorizar(["alterar:fichas"], pedido).ok, true);
  const criar = validarPedido({ rpg: "pedido", id: 4, op: "propor", alvo: "acoes", args: { acoes: [{ tipo: "ficha", dados: { categoria: "item", nome: "x" } }] } })!;
  assert.equal(autorizar(["alterar:fichas"], criar).ok, false);
});
