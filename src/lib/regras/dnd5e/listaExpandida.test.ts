import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { definirClasse, normalizar } from "../../dnd5e.ts";
import { podeAprender } from "./conjuracao.ts";
import { LISTA_EXPANDIDA, magiasExpandidas } from "./listaExpandida.ts";
import type { MagiaCat } from "./magias.ts";

const magias = JSON.parse(readFileSync(new URL("../../../data/dnd5e/phb/magias.json", import.meta.url), "utf8")) as MagiaCat[];
const por = (id: string) => magias.find((m) => m.id === id)!;

test("todos os ids da lista expandida existem no catálogo e ficam fora da lista de bruxo", () => {
  for (const [patrono, ids] of Object.entries(LISTA_EXPANDIDA)) for (const id of ids) {
    assert.ok(por(id), `${patrono}: ${id}`);
  }
});

test("Corruptor aprende bola de fogo (fora da lista de bruxo), outro patrono não", () => {
  const base = { ...definirClasse(normalizar({}), "bruxo"), nivel: 5 };
  const corruptor = { ...base, subclasse: "O Corruptor" };
  assert.ok(magiasExpandidas(corruptor).includes("bola-de-fogo"));
  assert.equal(podeAprender(corruptor, por("maos-flamejantes")).ok, true);
  assert.equal(podeAprender({ ...base, subclasse: "A Arquifada" }, por("maos-flamejantes")).ok, false);
  assert.equal(podeAprender(base, por("maos-flamejantes")).ok, false);
  assert.equal(podeAprender(corruptor, por("curar-ferimentos")).ok, false); // só as do patrono
});
