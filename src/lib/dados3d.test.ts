import { test } from "node:test";
import assert from "node:assert/strict";
import { capacidades, dividir, fisicosDe, MAX_FISICOS, sortearRolagem } from "./dados3d.ts";
import { inteiroSeguro } from "./aleatorio.ts";

test("capacidades: até 100 faces é um dado; acima soma dados (d120 = d100 + d20)", () => {
  assert.deepEqual(capacidades(20), [20]);
  assert.deepEqual(capacidades(100), [100]);
  assert.deepEqual(capacidades(120), [100, 20]);
  assert.deepEqual(capacidades(250), [100, 100, 50]);
  assert.deepEqual(capacidades(300), [100, 100, 100]);
});

test("dividir: a soma é sempre o total e cada dado respeita a capacidade", () => {
  for (const caps of [[100, 20], [100, 100, 50], [100, 100, 100]]) {
    const max = caps.reduce((a, b) => a + b, 0);
    for (let total = 1; total <= max; total++) {
      const v = dividir(total, caps);
      assert.equal(v.reduce((a, b) => a + b, 0), total, `${caps} → ${total}`);
      v.forEach((x, i) => assert.ok(x >= 1 && x <= caps[i], `${caps} → ${total}: dado ${i} = ${x}`));
    }
  }
});

// valor mostrado por um conjunto de dados físicos: percentil (dezenas + unidades) conta como um dado só
const somaFisicos = (f: { lados: number; valor: number }[]) => f.reduce((a, d) => a + d.valor, 0);

test("d120: 1 usa só o par percentil; de 2 a 120 usa percentil + d20", () => {
  assert.deepEqual(fisicosDe(120, 1), [{ lados: 100, valor: 0 }, { lados: 10, valor: 1 }]);
  for (let v = 2; v <= 120; v++) {
    const f = fisicosDe(120, v);
    assert.deepEqual(f.map((d) => d.lados), [100, 10, 20]);
    assert.equal(somaFisicos(f), v);
    assert.ok(f[0].valor % 10 === 0 && f[0].valor <= 90 && f[1].valor >= 1 && f[1].valor <= 10 && f[2].valor >= 1 && f[2].valor <= 20);
  }
});

test("d100 e dados de 21 a 99 faces mostram o par percentil com a soma certa", () => {
  for (let v = 1; v <= 100; v++) assert.equal(somaFisicos(fisicosDe(100, v)), v);
  for (let v = 1; v <= 30; v++) assert.equal(somaFisicos(fisicosDe(30, v)), v);
});

test("dado fora do padrão até 20 faces usa o menor dado físico que comporta", () => {
  assert.deepEqual(fisicosDe(3, 3), [{ lados: 4, valor: 3 }]);
  assert.deepEqual(fisicosDe(14, 9), [{ lados: 20, valor: 9 }]);
});

test("sortearRolagem: total confere com os dados físicos", () => {
  for (let i = 0; i < 200; i++) {
    const r = sortearRolagem("1d120+2d6+3")!;
    assert.ok(r.jogada);
    const fis = r.jogada.dados;
    const [g120, g6] = r.rolagem.grupos;
    // os 3 primeiros dados físicos (ou 2, se saiu 1) são do d120; os 2 últimos, dos d6
    const dosD6 = fis.slice(-2);
    assert.deepEqual(dosD6.map((d) => d.valor), g6.dados);
    assert.equal(somaFisicos(fis.slice(0, -2)), g120.dados[0]);
    assert.equal(g6.dados.length, 2);
    assert.equal(r.rolagem.total, g120.dados[0] + g6.dados[0] + g6.dados[1] + 3);
  }
});

test("sortearRolagem: expressão inválida e excesso de dados", () => {
  assert.equal(sortearRolagem("banana"), null);
  const muitos = sortearRolagem(`${MAX_FISICOS + 1}d6`)!;
  assert.equal(muitos.jogada, null);
  assert.equal(muitos.rolagem.grupos[0].dados.length, MAX_FISICOS + 1);
});

test("inteiroSeguro: uniforme em [1, n] (qui-quadrado frouxo) e sem sair do intervalo", () => {
  const n = 20, N = 40000, cont = new Array(n).fill(0);
  for (let i = 0; i < N; i++) {
    const v = inteiroSeguro(n);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= n);
    cont[v - 1]++;
  }
  const esperado = N / n;
  const qui = cont.reduce((a, c) => a + (c - esperado) ** 2 / esperado, 0);
  assert.ok(qui < 55, `qui-quadrado alto demais: ${qui}`); // 19 g.l.; p≈0,0001 em ~45
  assert.throws(() => inteiroSeguro(0));
});
