import test from "node:test";
import assert from "node:assert/strict";
import { efeitosDe, explicar, fonte, resolver } from "./efeitos.ts";
import { regrasDoSistema } from "./registro.ts";
import { bloqueia, opcaoAtiva } from "./sistema.ts";
import { criarCatalogo, derivar, dnd5e, validar, type Build, type PacoteConteudo } from "./dnd5e/index.ts";
import { FICHA_VAZIA, normalizar, type FichaDnd } from "../dnd5e.ts";

test("resolver: definir, somar, piso e teto com origem", () => {
  const v = resolver("ca", { rotulo: "Base", valor: 10 }, [
    { alvo: "ca", op: "somar", valor: 2, origem: "Escudo" },
    { alvo: "ca", op: "definir", valor: 11, origem: "Couro", prioridade: 1 },
    { alvo: "ca", op: "definir", valor: 12, origem: "Cota", prioridade: 2 },
    { alvo: "outro", op: "somar", valor: 99 },
  ]);
  assert.equal(v.total, 14);
  assert.equal(explicar(v), "12 Cota + 2 Escudo");
  const piso = resolver("atr.for", { rotulo: "Base", valor: 12 }, [{ alvo: "atr.for", op: "piso", valor: 19, origem: "Cinto" }]);
  assert.equal(piso.total, 19);
  const teto = resolver("atr.for", { rotulo: "Base", valor: 28 }, [{ alvo: "atr.for", op: "somar", valor: 4, origem: "Tomo" }, { alvo: "atr.for", op: "teto", valor: 30 }]);
  assert.equal(teto.total, 30);
});

test("fonte preenche a origem e efeitosDe achata", () => {
  const f = fonte("x", "Anel", [{ alvo: "ca", op: "somar", valor: 1 }]);
  assert.equal(efeitosDe([f])[0].origem, "Anel");
});

test("registro reconhece D&D 5e e ignora sistemas sem módulo", () => {
  assert.equal(regrasDoSistema("D&D 5e")?.id, "dnd5e");
  assert.equal(regrasDoSistema("Call of Cthulhu"), undefined);
});

test("opções da mesa: padrão desligado, mestre liga", () => {
  assert.equal(opcaoAtiva(dnd5e, undefined, "multiclasse"), false);
  assert.equal(opcaoAtiva(dnd5e, { multiclasse: true }, "multiclasse"), true);
});

test("catálogo: pacotes extensíveis e id repetido é erro", () => {
  const phb: PacoteConteudo = { id: "phb", nome: "Livro do Jogador", racas: [{ id: "elfo", nome: "Elfo", pacote: "phb", efeitos: [] }] };
  const xge: PacoteConteudo = { id: "xge", nome: "Xanathar", racas: [{ id: "eladrin", nome: "Eladrin", pacote: "xge", efeitos: [] }] };
  const cat = criarCatalogo([phb, xge]);
  assert.equal(cat.raca("eladrin")?.pacote, "xge");
  assert.throws(() => criarCatalogo([phb, phb]), /repetido/);
});

const pacote: PacoteConteudo = {
  id: "phb", nome: "Livro do Jogador",
  racas: [{
    id: "elfo", nome: "Elfo", pacote: "phb", efeitos: [{ alvo: "atr.des", op: "somar", valor: 2 }],
    sub: [{ id: "alto-elfo", nome: "Alto Elfo", pacote: "phb", efeitos: [{ alvo: "atr.int", op: "somar", valor: 1 }] }],
  }],
  antecedentes: [{ id: "soldado", nome: "Soldado", pacote: "phb", efeitos: [] }],
  talentos: [{ id: "alerta", nome: "Alerta", pacote: "phb", efeitos: [{ alvo: "iniciativa", op: "somar", valor: 5 }] }],
  classes: [{ id: "mago", nome: "Mago", pacote: "phb", dadoVida: 6, salvaguardas: ["int", "sab"] }],
};
const cat = criarCatalogo([pacote]);
const com = (b: Partial<Build>): FichaDnd => normalizar({ ...FICHA_VAZIA, build: {
  raca: { id: "elfo", sub: "alto-elfo" }, antecedente: { id: "soldado" }, classes: [{ id: "mago", nivel: 5 }],
  atributosBase: { for: 8, des: 14, con: 13, int: 15, sab: 12, car: 10 }, ...b,
} });

test("derivar: raça + sub-raça somam atributos, proficiência e salvaguardas da classe", () => {
  const c = derivar(com({}), cat);
  assert.equal(c.atributos.des.total, 16);
  assert.equal(c.atributos.int.total, 16);
  assert.equal(c.mods.int, 3);
  assert.equal(c.proficiencia, 3);
  assert.equal(c.salvaguardas.int.total, 6); // +3 mod +3 prof
  assert.equal(c.salvaguardas.for.total, -1);
  assert.equal(c.ca.total, 13); // 10 + Des 3
  assert.equal(c.iniciativa.total, 3);
});

test("derivar: talento só conta se a mesa permitir; ajuste manual é sinalizado", () => {
  const f = com({ talentos: ["alerta"], ajustes: { ca: { somar: 1, rotulo: "Regra da casa" } } });
  assert.equal(derivar(f, cat).iniciativa.total, 3);
  const c = derivar(f, cat, { talentos: true });
  assert.equal(c.iniciativa.total, 8);
  assert.equal(c.ca.total, 14);
  assert.deepEqual(c.ajustados, ["ca"]);
});

test("derivar: ficha sem build não é recalculada", () => {
  const f = normalizar({ ...FICHA_VAZIA, ca: 17, nivel: 9, atributos: { ...FICHA_VAZIA.atributos, des: 14 } });
  const c = derivar(f, cat);
  assert.equal(c.automatica, false);
  assert.equal(c.ca.total, 17);
  assert.equal(c.proficiencia, 4);
  assert.equal(c.iniciativa.total, 2);
});

test("validar: multiclasse e talentos desligados bloqueiam o jogador, não o mestre", () => {
  const f = com({ classes: [{ id: "mago", nivel: 3 }, { id: "mago", nivel: 2 }], talentos: ["alerta"] });
  const v = validar(f, cat);
  assert.deepEqual(v.map((x) => x.id).sort(), ["multiclasse.desligada", "talentos.desligado"]);
  assert.equal(bloqueia("jogador", v), true);
  assert.equal(bloqueia("mestre", v), false);
  assert.equal(validar(f, cat, { multiclasse: true, talentos: true }).length, 0);
});

test("validar: referências desconhecidas e ficha legada", () => {
  assert.equal(validar(normalizar({}), cat).length, 0);
  const v = validar(com({ raca: { id: "xx" }, classes: [{ id: "yy", nivel: 1 }] }), cat);
  assert.deepEqual(v.map((x) => x.id).sort(), ["classe.desconhecida", "raca.desconhecida"]);
});
