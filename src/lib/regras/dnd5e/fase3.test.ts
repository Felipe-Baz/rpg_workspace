import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, bonusPericia, normalizar, type FichaDnd } from "../../dnd5e.ts";
import { bloqueia } from "../sistema.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type Raca, type Talento } from "./catalogo.ts";
import { derivar, validar } from "./derivar.ts";
import { construirBuildDeFicha, fichaEfetiva, gravavel, reconhecerAntecedente, reconhecerRaca } from "./efetiva.ts";
import type { Build } from "./build.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const racas = lerJson<Raca[]>("racas");
const antecedentes = lerJson<Antecedente[]>("antecedentes");
const classes = lerJson<ClasseCat[]>("classes");
const talentos = lerJson<Talento[]>("talentos");
const cat = criarCatalogo([{ id: "phb", nome: "Livro do Jogador", racas, antecedentes, classes, talentos }]);

const base = { for: 8, des: 14, con: 13, int: 15, sab: 12, car: 10 };
const com = (b: Partial<Build>): FichaDnd => normalizar({ ...FICHA_VAZIA, pv: 999, build: { classes: [{ id: "mago", nivel: 1, escolhas: { pericias: ["arcanismo", "historia"] } }], atributosBase: base, ...b } });

test("catálogo do livro: contagens e classes completas", () => {
  assert.equal(racas.length, 9);
  assert.equal(antecedentes.length, 13);
  assert.equal(classes.length, 12);
  assert.equal(talentos.length, 42);
  for (const c of classes) {
    assert.equal(c.tabela?.length, 20, c.id);
    assert.ok([6, 8, 10, 12].includes(c.dadoVida), c.id);
    assert.equal(c.salvaguardas.length, 2, c.id);
    assert.ok(c.subclasses && c.subclasses.length >= 2, c.id);
    assert.ok(c.caracteristicas && c.caracteristicas.length >= 5, c.id);
  }
  const prof = classes[0].tabela!.map((t) => t.proficiencia);
  assert.deepEqual(prof, [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
});

test("antecedentes: perícias, escolhas e personalidade", () => {
  for (const a of antecedentes) {
    assert.equal(a.concede?.pericias?.length, 2, a.id);
    assert.ok(a.caracteristica?.nome, a.id);
    assert.equal(a.personalidade?.tracos.length, 8, a.id);
  }
  const acolito = antecedentes.find((a) => a.id === "acolito")!;
  assert.deepEqual(acolito.concede?.pericias, ["intuicao", "religiao"]);
  assert.equal(acolito.escolhas?.[0].qtd, 2); // dois idiomas
});

test("elfo alto: atributos, deslocamento, proficiência em Percepção e idiomas, com a fonte", () => {
  const f = com({ raca: { id: "elfo", sub: "alto-elfo", escolhas: { truque: ["luz"], idioma: ["Anão"] } } });
  const c = derivar(f, cat);
  assert.equal(c.atributos.des.total, 16);
  assert.equal(c.atributos.int.total, 16);
  assert.equal(c.deslocamento.total, 9);
  assert.deepEqual(c.pericias.percepcao, { nivel: 1, fontes: ["Elfo"] });
  assert.ok(c.idiomas.some((i) => i.nome === "Élfico" && i.fonte === "Elfo"));
  assert.ok(c.idiomas.some((i) => i.nome === "Anão" && i.fonte === "Alto Elfo"));
  assert.ok(c.armas.some((a) => a.nome === "arco longo" && a.fonte === "Alto Elfo"));
});

test("sub-raças mexem em deslocamento e PV por nível", () => {
  assert.equal(derivar(com({ raca: { id: "elfo", sub: "elfo-da-floresta" } }), cat).deslocamento.total, 10.5);
  const anao = derivar(com({ raca: { id: "anao", sub: "anao-da-colina" }, classes: [{ id: "guerreiro", nivel: 3, escolhas: { pericias: [] } }] }), cat);
  assert.equal(anao.deslocamento.total, 7.5);
  // d10 máx (10) + 2 níveis médios (6 cada) + Con 15 (+2) × 3 + 1 por nível (colina) × 3
  assert.equal(anao.pvMax.total, 10 + 12 + 6 + 3);
});

test("PV: 1º nível dado máximo, rolados e média, ajuste manual", () => {
  const mago1 = derivar(com({}), cat);
  assert.equal(mago1.pvMax.total, 6 + 1); // d6 + Con 13 (+1)
  const rolado = derivar(com({ classes: [{ id: "mago", nivel: 3, escolhas: { pericias: [] } }], historicoNiveis: [{ classe: "mago", pv: 6 }, { classe: "mago", pv: "medio" }] }), cat);
  assert.equal(rolado.pvMax.total, 6 + 6 + 4 + 3);
  const aj = derivar(com({ ajustes: { "pv.max": { somar: 5, rotulo: "Regra da casa" } } }), cat);
  assert.equal(aj.pvMax.total, 12);
  assert.deepEqual(aj.ajustados, ["pv.max"]);
});

test("humano variante: atributos escolhidos, perícia e talento (só com a opção da mesa)", () => {
  const f = com({
    raca: { id: "humano", sub: "humano-variante", escolhas: { atributos: ["des", "con"], pericia: ["furtividade"], talento: ["alerta"] } },
  });
  const sem = derivar(f, cat);
  assert.equal(sem.atributos.des.total, 15);
  assert.equal(sem.pericias.furtividade.nivel, 1);
  assert.equal(sem.iniciativa.total, 2); // talento fora: sem +5
  const com5 = derivar(f, cat, { talentos: true });
  assert.equal(com5.iniciativa.total, 2 + 5);
  const v = validar(f, cat);
  assert.ok(v.some((x) => x.id === "subraca.requer") && v.some((x) => x.id === "talentos.desligado") === false);
  assert.ok(validar(f, cat, { talentos: true }).every((x) => x.id !== "subraca.requer"));
});

test("meio-elfo: +2 Car e dois +1; draconato: resistência pelo ancestral", () => {
  const me = derivar(com({ raca: { id: "meio-elfo", escolhas: { atributos: ["des", "int"], pericias: ["persuasao", "intuicao"] } } }), cat);
  assert.equal(me.atributos.car.total, 12);
  assert.equal(me.atributos.int.total, 16);
  assert.equal(me.pericias.persuasao.nivel, 1);
  const dr = derivar(com({ raca: { id: "draconato", escolhas: { ancestral: ["vermelho"] } } }), cat);
  assert.deepEqual(dr.resistencias.map((r) => r.nome), ["fogo"]);
  assert.equal(dr.atributos.for.total, 10);
});

test("classe: salvaguardas, perícias escolhidas e antecedente somam as fontes", () => {
  const f = com({ antecedente: { id: "acolito", escolhas: { idioma: ["Élfico", "Anão"] } } });
  const c = derivar(f, cat);
  assert.deepEqual([c.salvaguardasProf.int, c.salvaguardasProf.sab, c.salvaguardasProf.for], [true, true, false]);
  assert.equal(c.salvaguardas.int.total, 2 + 2); // +2 mod, +2 prof
  assert.deepEqual(Object.keys(c.pericias).sort(), ["arcanismo", "historia", "intuicao", "religiao"]);
  assert.equal(c.dadoVida, "d6");
  assert.equal(c.fontes.find((x) => x.tipo === "classe")?.tracos.length, 2); // Conjuração + Recuperação Arcana (nível 1)
});

test("validar: perícia fora da lista, subclasse pendente e escolhas pendentes são avisos", () => {
  const f = com({ classes: [{ id: "mago", nivel: 2, escolhas: { pericias: ["atletismo", "historia"] } }], raca: { id: "elfo", sub: "alto-elfo" } });
  const v = validar(f, cat);
  assert.ok(v.some((x) => x.id === "classe.pericias.invalida"));
  assert.ok(v.some((x) => x.id === "subclasse.pendente" && x.gravidade === "aviso"));
  assert.ok(v.some((x) => x.id.startsWith("escolha.pendente.alto-elfo")));
  const soAvisos = validar(com({ raca: { id: "elfo", sub: "alto-elfo" } }), cat).filter((x) => x.gravidade !== "aviso");
  assert.equal(bloqueia("jogador", soAvisos), false);
  assert.equal(bloqueia("jogador", v), true);
  assert.equal(bloqueia("mestre", v), false);
});

test("ficha efetiva e gravável: derivados não são gravados", () => {
  const bruta = com({ raca: { id: "elfo" }, classes: [{ id: "guerreiro", nivel: 4, escolhas: { pericias: ["atletismo", "percepcao"] } }] });
  const c = derivar(bruta, cat);
  const ef = fichaEfetiva(bruta, c, cat);
  assert.equal(ef.atributos.des, 16);
  assert.equal(ef.nivel, 4);
  assert.equal(ef.classe, "guerreiro");
  assert.equal(ef.dadoVida, "d10");
  assert.equal(ef.deslocamento, "9 m");
  assert.equal(ef.raca, "Elfo");
  assert.equal(bonusPericia(ef, "atletismo"), -1 + 2); // For 8 (−1) + proficiência do 4º nível (+2)
  // editar o dano na ficha efetiva não "fixa" os valores derivados
  const editada = { ...ef, pv: 5, atributos: { ...ef.atributos, des: 20 }, nivel: 9 };
  const g = gravavel(bruta, editada);
  assert.equal(g.pv, 5);
  assert.deepEqual(g.atributos, bruta.atributos);
  assert.equal(g.nivel, bruta.nivel);
  assert.equal(g.build, bruta.build);
  // sem build nada muda
  const antiga = normalizar({ nivel: 3 });
  assert.equal(fichaEfetiva(antiga, derivar(antiga, cat), cat), antiga);
});

test("reconhecer texto livre de fichas antigas", () => {
  assert.deepEqual(reconhecerRaca("Alto Elfo", cat), { id: "elfo", sub: "alto-elfo" });
  assert.deepEqual(reconhecerRaca("humano", cat), { id: "humano", sub: "humano-padrao" });
  assert.deepEqual(reconhecerRaca("Elfo", cat), { id: "elfo" });
  assert.equal(reconhecerRaca("Tabaxi", cat), undefined);
  assert.equal(reconhecerAntecedente("Acólito do Templo", cat), "acolito");
});

test("migração: ficha antiga vira build sem mudar os números", () => {
  const antiga = normalizar({
    ...FICHA_VAZIA, nome: "Aria", classe: "mago", nivel: 5, raca: "Alto Elfo", antecedente: "Sábio",
    atributos: { for: 8, des: 16, con: 14, int: 17, sab: 12, car: 10 },
    salvaguardas: { ...FICHA_VAZIA.salvaguardas, int: true, sab: true },
    pericias: { arcanismo: 1, historia: 1, percepcao: 1, investigacao: 1 }, pvMax: 31, pv: 20,
  });
  const build = construirBuildDeFicha(antiga, cat);
  const nova = { ...antiga, build };
  const c = derivar(nova, cat);
  for (const a of ["for", "des", "con", "int", "sab", "car"] as const) assert.equal(c.atributos[a].total, antiga.atributos[a], a);
  assert.equal(c.pvMax.total, 31);
  assert.equal(c.proficiencia, 3);
  for (const id of ["arcanismo", "historia", "percepcao", "investigacao"]) assert.ok(c.pericias[id]?.nivel >= 1, id);
  assert.equal(c.pericias.furtividade, undefined);
  assert.deepEqual(build.classes[0].subclasse, undefined);
  assert.equal(build.raca?.sub, "alto-elfo");
});
