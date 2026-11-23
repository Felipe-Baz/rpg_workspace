import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ACOES, permissaoDaAcao, resumirAcoes, validarAcao, validarAcoes, type AcaoCriar } from "./acoes.ts";
const criada = (x: unknown) => validarAcao(x) as AcaoCriar | null;
import { atender, leitorExemplo } from "./broker-puro.ts";
import { autorizar, normalizarPermissoes, textoConsentimento, validarPedido } from "./capacidades.ts";
import { montarDocumentosLote } from "./lote.ts";

const ficha = (extra: Record<string, unknown> = {}) => ({ tipo: "ficha", dados: { categoria: "item", nome: "Colar de safiras", texto: "Vale 250 po.", ...extra } });
const pedidoPropor = (acoes: unknown) => validarPedido({ rpg: "pedido", id: 7, op: "propor", alvo: "acoes", args: { acoes } });

test("ficha: normaliza texto, limites e liberação", () => {
  const a = criada(ficha({ nome: "  Colar  ", texto: "x".repeat(9000) }))!;
  assert.equal(a.tipo, "ficha");
  assert.equal((a.dados as { nome: string }).nome, "Colar");
  assert.equal((a.dados as { texto: string }).texto.length, 5000);
  assert.equal((a.dados as { liberarPara: unknown }).liberarPara, "ninguem"); // padrão: só o mestre
  assert.equal((criada(ficha({ liberarPara: "todos" }))!.dados as { liberarPara: unknown }).liberarPara, "todos");
  assert.deepEqual((criada(ficha({ liberarPara: ["j1", "j1", "j2"] }))!.dados as { liberarPara: unknown }).liberarPara, ["j1", "j2"]);
});

test("ações inválidas são recusadas", () => {
  for (const ruim of [null, 5, {}, { tipo: "ficha" }, { tipo: "ficha", dados: {} }, ficha({ categoria: "armadilha" }), ficha({ nome: "   " }), ficha({ liberarPara: 5 }),
    ficha({ liberarPara: [1] }), { tipo: "apagar", dados: { nome: "x" } }, { tipo: "missao", dados: { titulo: "" } }, { tipo: "missao", dados: { titulo: "ok", etapas: "x" } },
    { tipo: "missao", dados: { titulo: "ok", etapas: Array(31).fill("a") } }]) {
    assert.equal(criada(ruim), null, JSON.stringify(ruim));
  }
  assert.equal(validarAcoes([]), null);
  assert.equal(validarAcoes(Array(MAX_ACOES + 1).fill(ficha())), null);
  assert.equal(validarAcoes([ficha(), { tipo: "ficha", dados: {} }]), null); // uma inválida recusa a proposta toda
  assert.equal(validarAcoes([ficha()])!.length, 1);
});

test("missão: etapas vazias saem e o texto é aparado", () => {
  const a = criada({ tipo: "missao", dados: { titulo: " A Cripta ", etapas: ["Entrar", "  ", "Achar o relicário"], dificuldade: "Média" } })!;
  assert.deepEqual((a.dados as { etapas: string[] }).etapas, ["Entrar", "Achar o relicário"]);
  assert.equal((a.dados as { titulo: string }).titulo, "A Cripta");
});

test("o pedido 'propor' só passa com ações válidas; sem formato certo, vira null", () => {
  assert.ok(pedidoPropor([ficha()]));
  assert.equal(pedidoPropor([]), null);
  assert.equal(pedidoPropor("x"), null);
  assert.equal(validarPedido({ rpg: "pedido", id: 1, op: "propor", alvo: "fichas", args: { acoes: [ficha()] } }), null);
  assert.equal(validarPedido({ rpg: "pedido", id: 1, op: "propor", alvo: "acoes", args: null }), null);
});

test("criar exige a permissão certa de cada tipo", () => {
  const f = pedidoPropor([ficha()])!;
  const m = pedidoPropor([{ tipo: "missao", dados: { titulo: "Nova" } }])!;
  const ambos = pedidoPropor([ficha(), { tipo: "missao", dados: { titulo: "Nova" } }])!;
  assert.equal(autorizar(["ler:fichas"], f).ok, false); // ler não autoriza criar
  assert.equal(autorizar(["criar:fichas"], f).ok, true);
  assert.equal(autorizar(["criar:fichas"], m).ok, false);
  assert.equal(autorizar(["criar:fichas"], ambos).ok, false);
  assert.equal(autorizar(["criar:fichas", "criar:missoes"], ambos).ok, true);
  assert.equal(permissaoDaAcao(validarAcao(ficha())!), "criar:fichas");
  assert.deepEqual(normalizarPermissoes(["criar:fichas", "criar:tudo", "ler:mesa"]), ["ler:mesa", "criar:fichas"]);
});

test("atender 'propor': jogador não cria, mestre cria só depois do proponente e sem permissão nada acontece", async () => {
  const pedido = pedidoPropor([ficha()])!;
  await assert.rejects(() => atender(pedido, ["criar:fichas"], leitorExemplo), /neste contexto/);
  await assert.rejects(() => atender(pedido, [], leitorExemplo, async () => "criou"), /Permissão não concedida/);
  let chamadas = 0;
  const r = await atender(pedido, ["criar:fichas"], leitorExemplo, async (acoes) => { chamadas++; return { n: acoes.length }; });
  assert.deepEqual(r, { n: 1 });
  assert.equal(chamadas, 1);
});

test("resumo para aprovação cita nomes, destinatários e que dá para desfazer", () => {
  const s = resumirAcoes(validarAcoes([ficha({ liberarPara: ["j1"] }), ficha({ nome: "Anel", liberarPara: "todos" }), { tipo: "missao", dados: { titulo: "A Cripta", etapas: ["a", "b"] } }])!, { j1: "Lia" });
  assert.match(s, /2 fichas e 1 missão/);
  assert.match(s, /Colar de safiras.*Lia/);
  assert.match(s, /todos os jogadores/);
  assert.match(s, /com 2 etapas/);
  assert.match(s, /desfazer/);
});

test("lote: marca a origem, converte jogadores em contas e avisa de quem não pode ver", () => {
  let n = 0;
  const r = montarDocumentosLote({
    acoes: validarAcoes([ficha({ liberarPara: ["j1", "j2", "jx"] }), ficha({ nome: "Anel", liberarPara: "todos" }), { tipo: "missao", dados: { titulo: "A Cripta", etapas: ["Entrar", "Achar", "Sair"] } }])! as AcaoCriar[],
    uidMestre: "mestre1",
    jogadores: [{ id: "j1", nome: "Ana", personagem: "Lia", uid: "uA" }, { id: "j2", nome: "Bruno", personagem: "Torin" }],
    origem: { extensao: "ext1", lote: "L1" },
    agora: 123,
    novoId: () => `id${n++}`,
  });
  assert.equal(r.fichas.length, 2);
  assert.deepEqual(r.fichas[0].liberadoPara, ["uA"]); // j2 não tem conta, jx não existe
  assert.equal(r.fichas[0].todos, false);
  assert.equal(r.fichas[1].todos, true);
  assert.ok(r.fichas.every((f) => f.mestre === true && f.donoUid === "mestre1" && f.origem.lote === "L1" && f.origem.extensao === "ext1"));
  assert.equal(r.avisos.length, 2);
  assert.match(r.avisos.join(" "), /Torin/);
  const m = r.missoes[0];
  assert.deepEqual(m.etapas.map((e) => e.status), ["atual", "pendente", "pendente"]); // só a primeira aparece aos jogadores
  assert.equal(m.status, "em_andamento");
  assert.equal(m.origem.lote, "L1");
  assert.deepEqual(r.itens.map((i) => i.tipo), ["ficha", "ficha", "missao"]);
  assert.equal(new Set([...r.fichas.map((f) => f.id), m.id]).size, 3); // ids únicos
});

test("o consentimento deixa claro que criar exige aprovação a cada pedido", () => {
  const t = textoConsentimento(["ler:jogadores", "criar:fichas"], false);
  assert.match(t, /Criar — Criar fichas/);
  assert.match(t, /aprova cada pedido/);
  assert.doesNotMatch(textoConsentimento(["ler:mesa"], false), /aprova cada pedido/);
});
