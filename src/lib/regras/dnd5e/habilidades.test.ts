import { test } from "node:test";
import assert from "node:assert/strict";
import { FICHA_VAZIA, type FichaDnd } from "../../dnd5e.ts";
import { gastarRecurso, recursosCalculados, recursosDaFicha, restaurarRecursos } from "./recursos.ts";

const base: FichaDnd = { ...FICHA_VAZIA, habilidades: [
  { id: "a", nome: "Golpe de Sorte", max: 1, recarga: "longo" as const, fonte: "Halfling", descricao: "" },
  { id: "b", nome: "Sopro", max: 2, recarga: "curto" as const, fonte: "", descricao: "" },
  { id: "c", nome: "Bênção", max: 3, recarga: "manual" as const, fonte: "", descricao: "" },
] };

test("habilidades cadastradas viram recursos e respeitam a recarga", () => {
  const defs = recursosDaFicha(base);
  assert.deepEqual(defs.map((d) => d.id), ["hab-a", "hab-b", "hab-c"]);
  let f: FichaDnd = base;
  for (const id of ["hab-a", "hab-b", "hab-c"]) f = gastarRecurso(f, defs, id, 1);
  assert.equal(recursosCalculados(f, defs).every((r) => r.usados === 1), true);
  const curto = restaurarRecursos(f, defs, "curto");
  assert.deepEqual(curto.recursos, { "hab-a": 1, "hab-c": 1 });
  const longo = restaurarRecursos(f, defs, "longo");
  assert.deepEqual(longo.recursos, { "hab-c": 1 });
});

test("usos do catálogo seguem classe, subclasse, nível, raça e talento", () => {
  const f: FichaDnd = { ...FICHA_VAZIA, classe: "ladino", nivel: 20, atributos: { ...FICHA_VAZIA.atributos, sab: 16 } };
  const ids = (x: FichaDnd, e = {}) => recursosDaFicha(x, e).map((d) => d.id);
  assert.ok(ids(f).includes("golpe-de-sorte"));
  assert.ok(!ids({ ...f, nivel: 19 }).includes("golpe-de-sorte"));
  const cle: FichaDnd = { ...FICHA_VAZIA, classe: "clerigo", nivel: 1, atributos: { ...FICHA_VAZIA.atributos, sab: 16 } };
  assert.ok(!ids(cle).includes("sacerdote-da-guerra"));
  const guerra = recursosDaFicha(cle, { subclasses: { clerigo: "dominio-da-guerra" } }).find((d) => d.id === "sacerdote-da-guerra");
  assert.equal(guerra?.max, 3); // mod. de Sabedoria
  assert.ok(ids(cle, { racaId: "elfo", subRacaId: "elfo-negro-drow" }).every((i) => i !== "magia-drow-escuridao")); // 5º nível
  assert.ok(ids(cle, { talentos: ["lider-inspirador"] }).includes("talento-lider-inspirador"));
});

test("características de subclasse só aparecem no nível em que chegam", async () => {
  const { nivelDaCaracteristicaSub } = await import("./niveisSubclasse.ts");
  const k = (id: string, texto: string) => ({ id, nome: id, texto });
  assert.equal(nivelDaCaracteristicaSub(k("a", "A partir do 6º nível, você pode..."), 3), 6);
  assert.equal(nivelDaCaracteristicaSub(k("b", "Lista de magias expandida."), 1), 1);
  assert.equal(nivelDaCaracteristicaSub(k("c", "No 1º nível, algo"), 3), 3);
});
