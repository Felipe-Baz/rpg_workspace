import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, bonusProficiencia, normalizar, type Atributo, type FichaDnd } from "../../dnd5e.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type Raca, type Talento } from "./catalogo.ts";
import { derivar, validar } from "./derivar.ts";
import type { Build } from "./build.ts";
import {
  CUSTO_COMPRA, DISTRIBUICAO_PADRAO, ORCAMENTO_COMPRA, RIQUEZA_INICIAL, XP_POR_NIVEL, custoCompra, incrementoValido, incrementosDisponiveis,
  niveisDeIncremento, nivelPorXp, podeSubirDeNivel, resumoSubida, rolarAtributo, subirNivel, usaCadaValorUmaVez, xpParaNivel,
} from "./progressao.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const classes = lerJson<ClasseCat[]>("classes");
const cat = criarCatalogo([{ id: "phb", nome: "x", racas: lerJson<Raca[]>("racas"), antecedentes: lerJson<Antecedente[]>("antecedentes"), talentos: lerJson<Talento[]>("talentos"), classes }]);
const attrs = (o: Partial<Record<Atributo, number>> = {}) => ({ for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10, ...o });
const build = (classe: string, nivel: number, extra: Partial<Build> = {}): Build => ({ classes: [{ id: classe, nivel, escolhas: { pericias: [] } }], atributosBase: attrs({ con: 14 }), ...extra });
const ficha = (b: Build): FichaDnd => normalizar({ ...FICHA_VAZIA, build: b });

test("XP: tabela do livro e aviso de nível", () => {
  assert.equal(XP_POR_NIVEL.length, 20);
  assert.equal(nivelPorXp(0), 1);
  assert.equal(nivelPorXp(299), 1);
  assert.equal(nivelPorXp(300), 2);
  assert.equal(nivelPorXp(6500), 5);
  assert.equal(nivelPorXp(999999), 20);
  assert.equal(xpParaNivel(20), 355000);
  assert.equal(podeSubirDeNivel(900, 2), true);
  assert.equal(podeSubirDeNivel(900, 3), false);
  assert.equal(podeSubirDeNivel(999999, 20), false);
});

test("compra de pontos: 27 pontos, 8 a 15", () => {
  assert.equal(CUSTO_COMPRA[14], 7);
  assert.equal(custoCompra(attrs({ for: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 })), 0);
  assert.equal(custoCompra({ for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }), ORCAMENTO_COMPRA); // 9+7+5+4+2+0
  assert.equal(custoCompra(attrs({ for: 16 })), null);
  assert.equal(custoCompra(attrs({ for: 7 })), null);
});

test("distribuição padrão e rolagem 4d6 descartando o menor", () => {
  assert.equal(usaCadaValorUmaVez({ for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }, DISTRIBUICAO_PADRAO), true);
  assert.equal(usaCadaValorUmaVez({ for: 15, des: 15, con: 13, int: 12, sab: 10, car: 8 }, DISTRIBUICAO_PADRAO), false);
  const seq = [6, 1, 3, 5];
  let i = 0;
  const r = rolarAtributo(() => seq[i++]);
  assert.deepEqual([r.dados, r.total], [[6, 1, 3, 5], 14]);
  assert.equal(rolarAtributo(() => 1).total, 3);
  assert.equal(rolarAtributo(() => 6).total, 18);
  assert.deepEqual(Object.keys(RIQUEZA_INICIAL).length, 12);
});

test("incrementos de atributo por classe vêm da tabela do livro", () => {
  const por = (id: string) => niveisDeIncremento(classes.find((c) => c.id === id)!);
  assert.deepEqual(por("mago"), [4, 8, 12, 16, 19]);
  assert.deepEqual(por("guerreiro"), [4, 6, 8, 12, 14, 16, 19]);
  assert.deepEqual(por("ladino"), [4, 8, 10, 12, 16, 19]);
  assert.equal(incrementosDisponiveis(build("mago", 8), cat), 2);
  assert.equal(incrementosDisponiveis(build("guerreiro", 6), cat), 2);
});

test("resumo da subida: características, proficiência, PV médio e escolhas do nível", () => {
  const r = resumoSubida(build("barbaro", 4), cat)!;
  assert.deepEqual([r.de, r.para, r.dadoVida, r.pvMedio], [4, 5, 12, 7]);
  assert.deepEqual(r.proficiencia, { antes: 2, depois: 3 });
  assert.ok(r.caracteristicas.some((c) => /Ataque Extra/.test(c.nome) && c.texto));
  assert.equal(r.incremento, false);
  const r4 = resumoSubida(build("mago", 3), cat)!;
  assert.equal(r4.incremento, true);
  const rs = resumoSubida(build("mago", 1), cat)!;
  assert.equal(rs.escolheSubclasse, true);
  assert.equal(rs.subclasseRotulo, "Tradições Arcanas");
  assert.equal(resumoSubida(build("mago", 2, { classes: [{ id: "mago", nivel: 2, subclasse: "escola-de-evocacao" }] }), cat)!.escolheSubclasse, false);
  assert.equal(resumoSubida(build("mago", 20), cat), null);
});

test("subir de nível: histórico, subclasse, PV e incremento recalculam a ficha", () => {
  let b = build("guerreiro", 1, { atributosBase: attrs({ for: 15, con: 14 }) });
  assert.equal(derivar(ficha(b), cat).pvMax.total, 10 + 2); // d10 + Con +2
  b = subirNivel(b, { pv: "medio" });
  assert.equal(derivar(ficha(b), cat).pvMax.total, 12 + 6 + 2);
  b = subirNivel(b, { pv: 9 });
  assert.equal(derivar(ficha(b), cat).pvMax.total, 12 + 6 + 2 + 9 + 2);
  b = subirNivel(b, { pv: "medio", subclasse: "mestre-de-batalha" });
  assert.equal(b.classes[0].subclasse, "mestre-de-batalha");
  assert.equal(b.classes[0].nivel, 4);
  // 4º nível dá direito a um incremento; um segundo antes do 6º nível passa do que o livro permite
  const quinto = subirNivel(b, { pv: "medio", incremento: { atributos: { for: 2 } } });
  assert.equal(validar(ficha(quinto), cat).some((v) => v.id === "incremento.excesso"), false);
  const sexto = subirNivel(quinto, { pv: "medio", incremento: { atributos: { con: 2 } } });
  assert.equal(validar(ficha(sexto), cat).some((v) => v.id === "incremento.excesso"), false); // guerreiro: 4º e 6º
  const setimo = subirNivel(sexto, { pv: "medio", incremento: { atributos: { des: 2 } } });
  assert.ok(validar(ficha(setimo), cat).some((v) => v.id === "incremento.excesso"));
  const c = derivar(ficha(quinto), cat);
  assert.equal(c.atributos.for.total, 17);
  assert.ok(c.atributos.for.partes.some((p) => /Aumento de atributo \(5º nível\)/.test(p.rotulo)));
  assert.equal(c.proficiencia, bonusProficiencia(5));
});

test("incremento por talento só conta com a opção da mesa; escolhas do talento ficam guardadas", () => {
  const b = subirNivel(build("guerreiro", 3), { pv: "medio", incremento: { talento: "atleta" }, escolhasTalento: { atributo: ["for"] } });
  assert.deepEqual(b.escolhasTalentos?.atleta, { atributo: ["for"] });
  assert.ok(validar(ficha(b), cat).some((v) => v.id === "talentos.desligado"));
  assert.equal(validar(ficha(b), cat, { talentos: true }).some((v) => v.id === "talentos.desligado"), false);
  assert.equal(derivar(ficha(b), cat, { talentos: true }).atributos.for.total, 11);
  assert.equal(derivar(ficha(b), cat).atributos.for.total, 10);
});

test("validação do incremento: +2 em um, +1 em dois, teto de 20 e talento exclusivo", () => {
  const t = attrs({ for: 19, des: 20 });
  assert.equal(incrementoValido({ atributos: { for: 1, con: 1 } }, t), null);
  assert.equal(incrementoValido({ atributos: { con: 2 } }, t), null);
  assert.match(incrementoValido({ atributos: { for: 2 } }, t) ?? "", /20/);
  assert.match(incrementoValido({ atributos: { des: 1, con: 1 } }, t) ?? "", /20/);
  assert.match(incrementoValido({ atributos: { con: 1 } }, t) ?? "", /2 pontos/);
  assert.match(incrementoValido({ atributos: { con: 1, int: 2 } }, t) ?? "", /2 pontos/);
  assert.equal(incrementoValido({ talento: "alerta" }, t), null);
  assert.match(incrementoValido({ talento: "alerta", atributos: { con: 2 } }, t) ?? "", /talento OU/);
});

test("atributo acima de 20 é só um aviso (nunca trava o jogador)", () => {
  const f = ficha(build("mago", 1, { atributosBase: attrs({ int: 22 }) }));
  const v = validar(f, cat).find((x) => x.id === "atributo.acima20.int");
  assert.equal(v?.gravidade, "aviso");
});
