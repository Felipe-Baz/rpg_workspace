import test from "node:test";
import assert from "node:assert/strict";
import { montarOpcoes } from "./sistemas-padrao.ts";

test("públicos primeiro, pessoais depois, sem repetir nome", () => {
  const r = montarOpcoes(["Tormenta20", "D&D 5e"], [{ id: "1", nome: "tormenta20" }, { id: "2", nome: "Meu RPG" }]);
  assert.deepEqual(r.map((o) => o.nome), ["D&D 5e", "Tormenta20", "Meu RPG"]);
  assert.equal(r[2].proprio, true);
  assert.equal(r[0].proprio, false);
});

test("ignora nomes vazios", () => {
  assert.deepEqual(montarOpcoes([" "], [{ id: "1", nome: "" }]), []);
});
