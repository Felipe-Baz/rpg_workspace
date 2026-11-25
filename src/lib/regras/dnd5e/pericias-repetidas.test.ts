import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar } from "../../dnd5e.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type ItemCat, type Raca } from "./catalogo.ts";
import { derivar } from "./derivar.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const cat = criarCatalogo([{ id: "phb", nome: "x", racas: lerJson<Raca[]>("racas"), antecedentes: lerJson<Antecedente[]>("antecedentes"), classes: lerJson<ClasseCat[]>("classes"), equipamento: lerJson<ItemCat[]>("equipamento") }]);
const atr = { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };

test("perícia repetida entre raça e antecedente aparece com duas fontes (o assistente pede a substituta)", () => {
  const elfo = cat.racas().find((r) => r.id === "elfo");
  assert.ok(elfo, "raça elfo");
  const f = normalizar({ ...FICHA_VAZIA, build: { raca: { id: "elfo", sub: elfo.sub?.[0]?.id }, antecedente: { id: "marinheiro" }, classes: [{ id: "mago", nivel: 1, escolhas: { pericias: [] } }], atributosBase: atr } });
  const c = derivar(f, cat);
  assert.equal(c.pericias.percepcao.fontes.length, 2);
});

test("perícia substituta entra como proficiência extra", () => {
  const b = { raca: { id: "elfo", sub: cat.racas().find((r) => r.id === "elfo")?.sub?.[0]?.id }, antecedente: { id: "marinheiro" }, classes: [{ id: "mago", nivel: 1, escolhas: { pericias: [] } }], atributosBase: atr, periciasExtras: ["arcanismo"] };
  const c = derivar(normalizar({ ...FICHA_VAZIA, build: b }), cat);
  assert.equal(c.pericias.arcanismo.nivel, 1);
});
