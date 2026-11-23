import { test } from "node:test";
import assert from "node:assert/strict";
import { expressaoD20, interpretar, rolar } from "./dados.ts";

// rng que devolve a sequência dada (valores de 1..faces já convertidos para [0,1))
const seq = (vals: number[], faces: number) => {
  let i = 0;
  return () => (vals[i++ % vals.length] - 1) / faces + 0.001;
};

test("interpreta expressões válidas", () => {
  assert.deepEqual(interpretar("d20"), { grupos: [{ sinal: 1, qtd: 1, faces: 20, manter: undefined }], bonus: 0 });
  assert.equal(interpretar("2d6+3")!.bonus, 3);
  assert.equal(interpretar("2d8 + 1d4 - 2")!.grupos.length, 2);
  assert.equal(interpretar("4d6kh3")!.grupos[0].manter!.n, 3);
});

test("rejeita expressões inválidas ou fora dos limites", () => {
  for (const e of ["", "abc", "d", "d1", "0d6", "101d6", "d1001", "2d6+", "2d6++3", "4d6kh5", "5", "2d6 x"]) assert.equal(interpretar(e), null, e);
});

test("soma dados e bônus", () => {
  const r = rolar("2d6+3", seq([4, 5], 6))!;
  assert.deepEqual(r.grupos[0].dados, [4, 5]);
  assert.equal(r.total, 12);
});

test("mantém os maiores (kh) e os menores (kl)", () => {
  assert.equal(rolar("4d6kh3", seq([6, 1, 4, 3], 6))!.total, 13);
  assert.equal(rolar("2d20kl1", seq([15, 7], 20))!.total, 7);
  assert.equal(rolar("2d20kh1", seq([15, 7], 20))!.total, 15);
});

test("subtração de dados e de bônus", () => {
  assert.equal(rolar("d20-2d4-1", seq([10, 2, 3], 20))!.grupos.length, 2);
});

test("crítico e falha crítica só em um d20 simples", () => {
  assert.equal(rolar("d20", () => 0.999)!.critico, "acerto");
  assert.equal(rolar("d20", () => 0)!.critico, "falha");
  assert.equal(rolar("2d20kh1", () => 0.999)!.critico, undefined);
  assert.equal(rolar("d20+5", () => 0.999)!.critico, "acerto");
});

test("expressaoD20 monta vantagem, desvantagem e modificador", () => {
  assert.equal(expressaoD20(null), "1d20");
  assert.equal(expressaoD20("v", 3), "2d20kh1+3");
  assert.equal(expressaoD20("d", -1), "2d20kl1-1");
});

test("rng real sempre produz valores dentro da faixa", () => {
  for (let i = 0; i < 500; i++) {
    const r = rolar("d6")!;
    assert.ok(r.total >= 1 && r.total <= 6);
  }
});
