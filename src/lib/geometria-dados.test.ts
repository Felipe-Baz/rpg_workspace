import { test } from "node:test";
import assert from "node:assert/strict";
import { LADOS_PADRAO, cross, direcaoCima, dot, ladoFisico, norm, poliedro, sub } from "./geometria-dados.ts";

test("cada dado tem o número certo de faces e valores únicos", () => {
  for (const l of LADOS_PADRAO) {
    const p = poliedro(l);
    assert.equal(p.faces.length, l === 100 ? 10 : l, `d${l}`);
    if (l !== 4) {
      const esperado = l === 100 ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90] : Array.from({ length: l }, (_, i) => i + 1);
      assert.deepEqual(p.faces.map((f) => f.valor).sort((a, b) => a - b), esperado, `d${l}`);
    }
  }
});

test("as faces são planas, convexas e apontam para fora", () => {
  for (const l of LADOS_PADRAO) {
    const p = poliedro(l);
    for (const f of p.faces) {
      assert.ok(dot(f.normal, f.centro) > 0.2, `d${l} normal para fora`);
      for (const i of f.idx) assert.ok(Math.abs(dot(sub(p.vertices[i], f.centro), f.normal)) < 1e-6, `d${l} face plana`);
      const [a, b, c] = f.idx.map((i) => p.vertices[i]);
      assert.ok(dot(cross(sub(b, a), sub(c, a)), f.normal) > 0, `d${l} sentido anti-horário`);
    }
  }
});

test("faces opostas somam lados+1 (dezenas do percentil: 90)", () => {
  for (const l of [6, 8, 10, 12, 20, 100]) {
    const p = poliedro(l);
    for (const f of p.faces) {
      const op = p.faces.find((g) => dot(g.normal, f.normal) < -0.999);
      assert.ok(op, `d${l} tem face oposta`);
      assert.equal(f.valor + op.valor, l === 100 ? 90 : l + 1);
    }
  }
});

test("direção de cima: face (d20) e vértice (d4)", () => {
  assert.ok(Math.abs(norm(direcaoCima(20, 20)) - 1) < 1e-9);
  for (let v = 1; v <= 4; v++) assert.ok(Math.abs(norm(direcaoCima(4, v)) - 1) < 1e-9);
  assert.throws(() => direcaoCima(6, 7));
});

test("ladoFisico escolhe o menor dado que comporta", () => {
  assert.deepEqual([2, 3, 5, 7, 9, 11, 14, 30, 100].map(ladoFisico), [4, 4, 6, 8, 10, 12, 20, 100, 100]);
});
