import { test } from "node:test";
import assert from "node:assert/strict";
import { permissaoDaAcao, resumirAcoes, tituloResumo, validarAcao, validarAcoes } from "./acoes.ts";
import { editadosDepois, hashDoc, montarLote, type AtuaisLote } from "./lote.ts";

const JOGADORES = [{ id: "j1", nome: "Ana", personagem: "Lia", uid: "uA" }, { id: "j2", nome: "Bruno", personagem: "Torin" }];
const FICHA = { id: "f1", donoUid: "m", categoria: "item", nome: "Colar", foto: "data:image/png;base64,AAAA", texto: "Vale 250 po.", criadoEm: 1, mestre: true, todos: false, liberadoPara: [] };
const MISSAO = {
  id: "m1", titulo: "A Cripta", descricaoPublica: "Achar o relicário", descricaoMestre: "segredo", status: "em_andamento", dificuldade: "Média", categoria: "Principal", criadoEm: 1,
  etapas: [
    { id: "e1", texto: "Entrar", status: "concluida", notaMestre: "nota", dataConclusao: "2026-11-01" },
    { id: "e2", texto: "Achar", status: "atual", notaMestre: "", dataConclusao: "" },
  ],
};
const atuais = (extra: Partial<AtuaisLote> = {}): AtuaisLote => ({ fichas: { f1: FICHA, fj: { ...FICHA, id: "fj", mestre: false } }, missoesMestre: { m1: MISSAO }, missoesPublicas: {}, ...extra });
let n = 0;
const montar = (acoes: unknown[], a = atuais()) => montarLote({ acoes: validarAcoes(acoes)!, atuais: a, uidMestre: "m", jogadores: JOGADORES, origem: { extensao: "ext", lote: "L" }, agora: Date.UTC(2026, 10, 23), novoId: () => `n${++n}` });

test("alterar/excluir: só campos conhecidos, ids válidos, ao menos uma mudança", () => {
  assert.deepEqual(validarAcao({ tipo: "ficha", op: "alterar", id: "f1", mudancas: { nome: "  Anel  ", liberarPara: ["j1", "j1"] } }), { tipo: "ficha", op: "alterar", id: "f1", mudancas: { nome: "Anel", liberarPara: ["j1"] } });
  assert.deepEqual(validarAcao({ tipo: "missao", op: "excluir", id: "m1" }), { tipo: "missao", op: "excluir", id: "m1" });
  for (const ruim of [
    { tipo: "ficha", op: "alterar", id: "f1", mudancas: {} },
    { tipo: "ficha", op: "alterar", id: "f1", mudancas: { donoUid: "x" } },
    { tipo: "ficha", op: "alterar", id: "f1", mudancas: { categoria: "armadilha" } },
    { tipo: "ficha", op: "alterar", id: "f1", mudancas: { nome: "  " } },
    { tipo: "ficha", op: "alterar", id: "", mudancas: { nome: "x" } },
    { tipo: "ficha", op: "apagar", id: "f1" },
    { tipo: "missao", op: "alterar", id: "m1", mudancas: { status: "andamento" } },
    { tipo: "missao", op: "alterar", id: "m1", mudancas: { etapas: [{ id: "e1", texto: "a" }, { id: "e1", texto: "b" }] } },
    { tipo: "missao", op: "alterar", id: "m1", mudancas: { etapas: [{ texto: "a", status: "feita" }] } },
    { tipo: "missao", op: "excluir" },
  ]) assert.equal(validarAcao(ruim), null, JSON.stringify(ruim));
  assert.equal(permissaoDaAcao(validarAcao({ tipo: "missao", op: "excluir", id: "m1" })!), "alterar:missoes");
  assert.equal(permissaoDaAcao(validarAcao({ tipo: "ficha", op: "alterar", id: "f1", mudancas: { nome: "a" } })!), "alterar:fichas");
});

test("resumo sem dados atuais (lista de pedidos) e título misto", () => {
  const acoes = validarAcoes([{ tipo: "ficha", dados: { categoria: "item", nome: "Anel" } }, { tipo: "ficha", op: "alterar", id: "f1", mudancas: { liberarPara: ["j1"] } }, { tipo: "missao", op: "excluir", id: "m1" }])!;
  assert.equal(tituloResumo(acoes), "Vai criar 1 ficha, alterar 1 ficha, excluir 1 missão");
  const r = resumirAcoes(acoes, { j1: "Lia" });
  assert.match(r, /visível para: Lia/);
  assert.match(r, /EXCLUIR missão/);
});

test("liberar uma ficha para um jogador: antes → depois com nomes, antes sem a foto, hash do depois", () => {
  const r = montar([{ tipo: "ficha", op: "alterar", id: "f1", mudancas: { liberarPara: ["j1", "j2"], nome: "Colar de safiras" } }]);
  assert.equal(r.fichas.length, 1);
  assert.deepEqual(r.fichas[0].liberadoPara, ["uA"]);
  assert.equal(r.fichas[0].foto, FICHA.foto); // a foto continua no documento
  assert.deepEqual(r.fichas[0].origem, { extensao: "ext", lote: "L" });
  assert.match(r.resumo, /visível para: só você → Lia/);
  assert.match(r.resumo, /nome “Colar” → “Colar de safiras”/);
  assert.equal(r.avisos.length, 1); // Torin ainda não tem conta
  const antes = r.antes[0] as { ficha: Record<string, unknown> };
  assert.equal("foto" in antes.ficha, false);
  assert.equal(r.depois["ficha:f1"], hashDoc(r.fichas[0]));
  assert.deepEqual(r.itens, [{ tipo: "ficha", id: "f1", nome: "Colar de safiras", op: "alterar" }]);
});

test("alcance: ficha pessoal de jogador, item inexistente e item repetido recusam a proposta", () => {
  assert.throws(() => montar([{ tipo: "ficha", op: "alterar", id: "fj", mudancas: { nome: "x" } }]), /ficha pessoal/);
  assert.throws(() => montar([{ tipo: "ficha", op: "excluir", id: "nada" }]), /não encontrada/);
  assert.throws(() => montar([{ tipo: "missao", op: "excluir", id: "nada" }]), /não encontrada/);
  assert.throws(() => montar([{ tipo: "ficha", op: "alterar", id: "f1", mudancas: { nome: "a" } }, { tipo: "ficha", op: "excluir", id: "f1" }]), /mais de uma vez/);
  assert.throws(() => montar([{ tipo: "missao", op: "alterar", id: "m1", mudancas: { etapas: [{ id: "e9", texto: "x" }] } }]), /não tem a etapa e9/);
});

test("excluir guarda o documento inteiro (com foto) para recriar no desfazer", () => {
  const r = montar([{ tipo: "ficha", op: "excluir", id: "f1" }, { tipo: "missao", op: "excluir", id: "m1" }]);
  assert.deepEqual(r.excluir, [{ tipo: "ficha", id: "f1" }, { tipo: "missao", id: "m1" }]);
  assert.deepEqual((r.antes[0] as { ficha: unknown }).ficha, FICHA);
  assert.deepEqual(r.antes[1], { tipo: "missao", id: "m1", mestre: MISSAO, publica: null });
  assert.match(r.resumo, /2 item\(ns\) serão APAGADOS/);
  assert.deepEqual(r.depois, {});
});

test("missão: etapas mantidas, novas e removidas; uma só atual; notas do mestre preservadas", () => {
  const r = montar([{ tipo: "missao", op: "alterar", id: "m1", mudancas: { status: "em_andamento", etapas: [{ id: "e1", texto: "Entrar" }, { id: "e2", texto: "Achar", status: "concluida" }, { texto: "Sair", status: "atual" }, { texto: "Extra", status: "atual" }] } }]);
  const etapas = r.missoes[0].etapas as { id: string; status: string; notaMestre: string; dataConclusao: string }[];
  assert.deepEqual(etapas.map((e) => e.status), ["concluida", "concluida", "atual", "pendente"]);
  assert.equal(etapas[0].notaMestre, "nota");
  assert.equal(etapas[1].dataConclusao, "2026-11-23");
  assert.equal(r.missoes[0].descricaoMestre, "segredo");
  assert.match(r.resumo, /etapas: 2 nova\(s\), 1 alterada\(s\)/);
  const r2 = montar([{ tipo: "missao", op: "alterar", id: "m1", mudancas: { etapas: [{ id: "e2", texto: "Achar" }] } }]);
  assert.match(r2.resumo, /1 removida/);
});

test("missão antiga (só pública) pode ser alterada e o desfazer sabe que não havia versão completa", () => {
  const publica = { id: "m2", titulo: "Velha", descricaoPublica: "x", status: "andamento", categoria: "", etapas: [{ id: "a", texto: "A", status: "atual", dataConclusao: "" }], criadoEm: 1 };
  const r = montar([{ tipo: "missao", op: "alterar", id: "m2", mudancas: { titulo: "Nova" } }], atuais({ missoesPublicas: { m2: publica } }));
  assert.equal(r.missoes[0].titulo, "Nova");
  assert.equal(r.missoes[0].status, "em_andamento");
  assert.deepEqual(r.antes[0], { tipo: "missao", id: "m2", mestre: null, publica });
});

test("criar + alterar no mesmo lote; edição posterior é detectada pelo hash", () => {
  const r = montar([{ tipo: "missao", dados: { titulo: "Nova", etapas: ["a"] } }, { tipo: "ficha", op: "alterar", id: "f1", mudancas: { texto: "Vale 300 po." } }]);
  assert.deepEqual(r.itens.map((i) => i.op), ["criar", "alterar"]);
  assert.match(r.resumo, /Vai criar 1 missão, alterar 1 ficha/);
  const gravado = r.fichas.find((f) => f.id === "f1")!;
  assert.deepEqual(editadosDepois(r.depois, { "ficha:f1": { ...gravado } }), []); // mesma ficha (ordem de chaves não importa)
  assert.deepEqual(editadosDepois(r.depois, { "ficha:f1": { ...gravado, texto: "mudei à mão" } }), ["ficha:f1"]);
  assert.deepEqual(editadosDepois(r.depois, { "ficha:f1": undefined }), []); // apagada depois: nada a perder
});
