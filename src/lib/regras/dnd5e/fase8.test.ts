import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar, type FichaDnd } from "../../dnd5e.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type Raca } from "./catalogo.ts";
import { derivar } from "./derivar.ts";
import { fichaEfetiva } from "./efetiva.ts";
import { alternarCondicaoDoMestre, curaDoMestre, danoDoMestre, diferencaDeEstado, linhaDoGrupo, resumoDoGrupo, type LinhaGrupo } from "./grupo.ts";
import { planoDeConjuracao } from "./conjuracao.ts";
import { magiaParaFicha, type MagiaCat } from "./magias.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const cat = criarCatalogo([{ id: "phb", nome: "x", racas: lerJson<Raca[]>("racas"), antecedentes: lerJson<Antecedente[]>("antecedentes"), classes: lerJson<ClasseCat[]>("classes") }]);
const magias = lerJson<MagiaCat[]>("magias");

const comBuild = (nome: string, classe: string, nivel: number, extra: Partial<FichaDnd> = {}, atr = {}) => normalizar({
  ...FICHA_VAZIA, nome, pv: 5, pvMax: 99, ca: 5, ...extra,
  build: { classes: [{ id: classe, nivel, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 14, con: 14, int: 10, sab: 10, car: 10, ...atr }, ...(extra.build ?? {}) },
});
const linha = (f: FichaDnd, uid = "u1"): LinhaGrupo => {
  const calc = derivar(f, cat);
  return linhaDoGrupo(uid, "", f, fichaEfetiva(f, calc, cat), calc, cat);
};

test("a linha do grupo usa os valores calculados, não os números defasados da ficha gravada", () => {
  const f = comBuild("Aria", "guerreiro", 1, {}, { for: 15 });
  const l = linha(f);
  assert.equal(l.pvMax, 10 + 2); // d10 + Con +2, e não os 99 gravados
  assert.equal(l.ca, 12); // 10 + Des +2, e não os 5 gravados
  assert.equal(l.nome, "Aria");
  assert.equal(l.automatica, true);
  assert.equal(l.percepcao, 10);
});

test("a linha sinaliza o que o mestre precisa conferir", () => {
  const manual = linhaDoGrupo("u2", "Bruno", normalizar({ ...FICHA_VAZIA, nome: "Bruno" }), normalizar({ ...FICHA_VAZIA, nome: "Bruno" }), null, null);
  assert.equal(manual.automatica, false);
  assert.match(manual.conferir[0], /Ficha manual/);
  const ajustada = linha(comBuild("Caio", "guerreiro", 1, { build: { classes: [{ id: "guerreiro", nivel: 1, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }, ajustes: { ca: { somar: 2, rotulo: "Regra da casa" } } } }));
  assert.ok(ajustada.conferir.some((c) => /Ajuste fora do livro em ca: \+2 \(Regra da casa\)/.test(c)));
  const pendente = linha(comBuild("Dana", "guerreiro", 1, { build: { classes: [{ id: "guerreiro", nivel: 1, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } } }));
  assert.ok(pendente.conferir.some((c) => /perícia/.test(c)));
  const limpa = linha(comBuild("Eva", "guerreiro", 1, { build: { classes: [{ id: "guerreiro", nivel: 1, escolhas: { pericias: ["atletismo", "percepcao"] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } } }));
  assert.deepEqual(limpa.conferir, []);
});

test("resumo do grupo: PV, CA, perícias cobertas e sem cobertura, idiomas e condições", () => {
  const a = linha(comBuild("Aria", "guerreiro", 1, { condicoes: ["envenenado"], build: { raca: { id: "elfo", sub: "alto-elfo" }, classes: [{ id: "guerreiro", nivel: 1, escolhas: { pericias: ["atletismo", "percepcao"] } }], atributosBase: { for: 10, des: 14, con: 10, int: 10, sab: 10, car: 10 } } }), "a");
  const b = linha(comBuild("Bruno", "mago", 1, { build: { classes: [{ id: "mago", nivel: 1, escolhas: { pericias: ["arcanismo", "historia"] } }], atributosBase: { for: 10, des: 10, con: 10, int: 16, sab: 10, car: 10 } } }), "b");
  const r = resumoDoGrupo([a, b]);
  assert.equal(r.jogadores, 2);
  assert.equal(r.ca.min, 10);
  assert.equal(r.ca.max, 13); // Aria: elfa, Des 14 + 2 = 16 (+3)
  assert.deepEqual(r.periciasCobertas.find((p) => p.id === "atletismo")?.quem, ["Aria"]);
  assert.deepEqual(r.periciasCobertas.find((p) => p.id === "arcanismo")?.quem, ["Bruno"]);
  assert.ok(r.periciasSemCobertura.includes("Furtividade"));
  assert.ok(!r.periciasSemCobertura.includes("Atletismo"));
  assert.deepEqual(r.condicoes, [{ nome: "Envenenado", quem: ["Aria"] }]);
  assert.ok(r.idiomas.some((i) => i.nome === "Élfico" && i.quem[0] === "Aria"));
  assert.deepEqual(r.cds, [{ nome: "Bruno", cd: 13 }]); // só o mago conjura: Int 16 (+3), proficiência +2
  assert.equal(r.aConferir, 1); // Aria ainda não escolheu o truque do alto elfo
  assert.ok(a.conferir.some((c) => /truque de mago/i.test(c)));
  assert.equal(resumoDoGrupo([]).ca.max, 0);
});

test("dano do mestre vira só os campos que mudaram (atualização por campo)", () => {
  const f = comBuild("Aria", "guerreiro", 1, { pv: 12, pvTemp: 3, pvMax: 12, concentracao: { magiaId: "x", nome: "Voo" } });
  const ef = fichaEfetiva(f, derivar(f, cat), cat);
  const parcial = danoDoMestre({ ...ef, pv: 12, pvMax: 12 }, derivar(f, cat), { valor: 5 });
  assert.deepEqual(parcial.patch, { pvTemp: 0, pv: 10 });
  assert.match(parcial.texto[0], /Aria sofreu 5 de dano/);
  const cai = danoDoMestre({ ...ef, pv: 4, pvTemp: 0, pvMax: 12 }, null, { valor: 6 });
  assert.equal(cai.patch.pv, 0);
  assert.ok("concentracao" in cai.patch && cai.patch.concentracao === undefined); // cair encerra a concentração
  const cura = curaDoMestre({ ...ef, pv: 1, pvMax: 12, morteFalhas: 2 }, 5);
  assert.deepEqual(cura.patch, { pv: 6, morteFalhas: 0 });
  assert.deepEqual(diferencaDeEstado(ef, ef), {});
  assert.deepEqual(alternarCondicaoDoMestre(normalizar({ condicoes: ["cego"] }), "surdo"), { condicoes: ["cego", "surdo"] });
  assert.deepEqual(alternarCondicaoDoMestre(normalizar({ condicoes: ["cego"] }), "cego"), { condicoes: [] });
});

test("dano do mestre respeita resistência da raça e imunidade manual", () => {
  const f = comBuild("Tia", "guerreiro", 3, { pv: 20, pvMax: 30, defesas: { resistencias: [], vulnerabilidades: [], imunidades: ["veneno"] }, build: { raca: { id: "tiefling" }, classes: [{ id: "guerreiro", nivel: 3, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } } });
  const calc = derivar(f, cat);
  const ef = { ...fichaEfetiva(f, calc, cat), pv: 20 };
  assert.equal(danoDoMestre(ef, calc, { valor: 10, tipo: "fogo" }).patch.pv, 15); // tiefling resiste a fogo
  assert.deepEqual(danoDoMestre(ef, calc, { valor: 10, tipo: "veneno" }).patch, {}); // imunidade manual
});

test("Tiefling Ctônico troca a resistência a fogo por necrótico", () => {
  const f = comBuild("Tia", "guerreiro", 5, { build: { raca: { id: "tiefling", sub: "tiefling-chthonic" }, classes: [{ id: "guerreiro", nivel: 5, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } } });
  const calc = derivar(f, cat);
  assert.deepEqual(calc.resistencias.map((x) => x.nome), ["necrótico"]);
  assert.equal(calc.atributos.car.total, 12); // os bônus da raça base continuam
  assert.ok(calc.fontes.some((x) => x.tracos.some((t) => t.id === "legado-ctonico")));
});

test("rótulo da rolagem de magia leva a CD da salvaguarda (origem no histórico)", () => {
  const mago = normalizar({ ...FICHA_VAZIA, nome: "Aria", classe: "mago", nivel: 5, atrConjuracao: "int", atributos: { ...FICHA_VAZIA.atributos, int: 16 } });
  const m = magiaParaFicha(magias.find((x) => x.id === "bola-de-fogo")!, "m1", true);
  const plano = planoDeConjuracao(mago, m, magias.find((x) => x.id === "bola-de-fogo"), 3);
  assert.match(plano.danos[0].titulo, /Bola de Fogo/);
  assert.match(plano.danos[0].titulo, /CD 14 Des/);
});
