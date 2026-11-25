import { test } from "node:test";
import assert from "node:assert/strict";
import { buscar, enquadrar, formatarX, importar, normalizar, passoDaRegua, removerEvento, removerRamo, rotulosVisiveis, timelineVazia, zoomAncorado, type Timeline } from "./timeline.ts";

const ev = (id: string, ramoId: string, x: number) => ({ id, ramoId, x, titulo: id, rotulo: "", texto: "", tipo: "evento" as const, feito: false });
const exemplo = (): Timeline => ({
  ...timelineVazia(),
  ramos: [...timelineVazia().ramos, { id: "r2", nome: "E se", cor: "#ef4444", origemId: "a" }],
  eventos: [ev("a", "principal", 10), ev("b", "r2", 20), ev("c", "principal", 30)],
});

test("normalizar garante a linha principal e descarta lixo", () => {
  const t = normalizar({ ramos: [], eventos: [{ id: "x", ramoId: "nao-existe", x: 1 }, { id: "y", ramoId: "principal", x: NaN }] });
  assert.equal(t.ramos[0].id, "principal");
  assert.equal(t.eventos.length, 0);
  assert.equal(normalizar(null).unidade, "dias");
});

test("ramo cuja origem sumiu fica solto", () => {
  const t = normalizar({ ramos: [{ id: "r", nome: "R", cor: "#ffffff", origemId: "fantasma" }], eventos: [] });
  assert.equal(t.ramos.find((r) => r.id === "r")!.origemId, null);
});

test("remover evento solta o ramo; remover ramo apaga seus eventos", () => {
  const sem = removerEvento(exemplo(), "a");
  assert.equal(sem.ramos.find((r) => r.id === "r2")!.origemId, null);
  const semRamo = removerRamo(exemplo(), "r2");
  assert.deepEqual(semRamo.eventos.map((e) => e.id), ["a", "c"]);
  assert.equal(removerRamo(exemplo(), "principal").ramos.length, 2);
});

test("passo da régua é 1/2/5 × 10^n e respeita o espaçamento mínimo", () => {
  for (const z of [0.03, 0.5, 1, 7, 120]) {
    const p = passoDaRegua(z);
    assert.ok(p * z >= 90, `z=${z}`);
    assert.match(String(p / 10 ** Math.floor(Math.log10(p))), /^(1|2|5)$/);
  }
});

test("zoom ancorado mantém o ponto sob o cursor", () => {
  const { vx, zoom } = zoomAncorado(100, 2, 8, 300);
  assert.equal(vx + 300 / zoom, 100 + 300 / 2);
});

test("enquadrar cobre todos os eventos", () => {
  const { vx, zoom } = enquadrar(exemplo(), 1000);
  assert.ok(vx < 10 && vx + 1000 / zoom > 30);
});

test("rótulos não se sobrepõem", () => {
  const ok = rotulosVisiveis([{ id: "a", x: 0 }, { id: "b", x: 1 }, { id: "c", x: 200 }], 1);
  assert.deepEqual([...ok], ["a", "c"]);
});

test("busca ignora acento e caixa", () => {
  const t = exemplo();
  t.eventos[0].titulo = "Coroação do Rei";
  assert.equal(buscar(t, "coroacao")[0].id, "a");
  assert.equal(buscar(t, "  ").length, 0);
});

test("importar rejeita lixo e formata números", () => {
  assert.equal(importar("não é json"), null);
  assert.equal(importar('{"x":1}'), null);
  assert.equal(importar(JSON.stringify(exemplo()))!.eventos.length, 3);
  assert.equal(formatarX(0.1 + 0.2), "0.3");
});
