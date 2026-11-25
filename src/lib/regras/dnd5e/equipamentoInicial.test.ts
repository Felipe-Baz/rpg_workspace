import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar } from "../../dnd5e.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type ItemCat, type Raca } from "./catalogo.ts";
import { derivar } from "./derivar.ts";
import type { Build } from "./build.ts";
import { EQUIPAMENTO_INICIAL, equipamentoPendente, itensDaOpcao, itensDoSeletor, ouroDoAntecedente, type Seletor } from "./equipamentoInicial.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const cat = criarCatalogo([{ id: "phb", nome: "x", racas: lerJson<Raca[]>("racas"), antecedentes: lerJson<Antecedente[]>("antecedentes"), classes: lerJson<ClasseCat[]>("classes"), equipamento: lerJson<ItemCat[]>("equipamento") }]);

test("toda classe tem equipamento inicial e todo item fixo existe no catálogo", () => {
  for (const c of cat.classes()) assert.ok(EQUIPAMENTO_INICIAL[c.id]?.length, `${c.id} sem equipamento`);
  for (const [classe, grupos] of Object.entries(EQUIPAMENTO_INICIAL)) {
    grupos.forEach((g) => g.forEach((op) => op.itens.forEach((it) => {
      if (it.ref) assert.ok(cat.item(it.ref), `${classe}: item "${it.ref}" não existe`);
      else assert.ok(it.escolher, `${classe}: item sem ref nem seletor`);
    })));
  }
});

test("seletores listam itens do catálogo", () => {
  const seletores: Seletor[] = ["simples", "marcial", "simples-cac", "marcial-cac", "instrumento", "foco-arcano", "foco-druidico", "simbolo-sagrado"];
  for (const s of seletores) assert.ok(itensDoSeletor(s, cat).length > 0, s);
  assert.ok(itensDoSeletor("simples-cac", cat).every((x) => x.tipo === "arma" && !x.distancia && x.categoria === "simples"));
  assert.ok(itensDoSeletor("foco-arcano", cat).length === 5);
});

test("pendências e itens de uma opção", () => {
  // mago: 3 grupos com escolha (bordão/adaga, bolsa/foco, pacote) e um fixo
  assert.equal(equipamentoPendente("mago", {}, {}), 3);
  assert.equal(equipamentoPendente("mago", { 0: 0, 1: 0, 2: 0 }, {}), 0);
  assert.equal(equipamentoPendente("mago", { 0: 0, 1: 1, 2: 0 }, {}), 1, "foco arcano pede qual");
  assert.equal(equipamentoPendente("mago", { 0: 0, 1: 1, 2: 0 }, { "1.1.0": "cristal" }), 0);
  const foco = EQUIPAMENTO_INICIAL.mago[1][1];
  assert.deepEqual(itensDaOpcao(foco, 1, 1, { "1.1.0": "cristal" }, cat).map((x) => x.item.id), ["cristal"]);
  assert.deepEqual(itensDaOpcao(foco, 1, 1, {}, cat), []);
});

test("ouro do antecedente é lido do texto", () => {
  assert.equal(ouroDoAntecedente("uma algibeira contendo 15 po"), 15);
  assert.equal(ouroDoAntecedente("Um kit de herbalismo e 5 po."), 5);
  assert.equal(ouroDoAntecedente(undefined), 0);
});

test("PV do 1º nível: máximo por padrão, ou o valor rolado/média", () => {
  const b: Build = { classes: [{ id: "mago", nivel: 1 }], atributosBase: { for: 10, des: 10, con: 14, int: 15, sab: 10, car: 10 } };
  const f = (x: Build) => derivar(normalizar({ ...FICHA_VAZIA, build: x }), cat).pvMax.total;
  assert.equal(f(b), 6 + 2);
  assert.equal(f({ ...b, pvNivel1: 4 }), 4 + 2);
  assert.equal(f({ ...b, pvNivel1: 99 }), 6 + 2, "não passa do dado");
});
