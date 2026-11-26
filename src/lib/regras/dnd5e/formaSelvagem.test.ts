import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar, testeAtaque, testeDano, type FichaDnd, type Magia } from "../../dnd5e.ts";
import { aplicarDano } from "./combate.ts";
import { conjurarMagia } from "./conjuracao.ts";
import { gravavel } from "./efetiva.ts";
import { alterarSeAVontade, assumirForma, comForma, curaDeCombate, custoDaForma, danoNaForma, feraPermitida, limiteDaForma, reverterForma, temMilFormas, type Fera } from "./formaSelvagem.ts";
import { curaDoMestre, danoDoMestre } from "./grupo.ts";
import { restaurarRecursos } from "./recursos.ts";

const feras: Fera[] = JSON.parse(readFileSync(new URL("../../../data/dnd5e/phb/feras.json", import.meta.url), "utf8"));
const fera = (id: string) => feras.find((x) => x.id === id)!;

const druida = (nivel: number, extra: Partial<FichaDnd> = {}): FichaDnd => normalizar({
  ...FICHA_VAZIA, classe: "druida", nivel, subclasse: "", pv: 20, pvMax: 20, ca: 13, deslocamento: "9 m",
  atributos: { for: 8, des: 14, con: 14, int: 10, sab: 16, car: 10 }, atrConjuracao: "sab",
  espacos: FICHA_VAZIA.espacos.map((e, i) => (i < 2 ? { total: 3, usados: 0 } : e)),
  ataques: [{ id: "cajado", nome: "Cajado", atr: "for", proficiente: true, bonusAtaque: 0, dano: "1d6", bonusDano: 0, tipoDano: "contundente", notas: "" }],
  ...extra,
});

test("catálogo de feras: lido do bestiário", () => {
  assert.ok(feras.length > 60);
  const lobo = fera("lobo");
  assert.equal(lobo.ndNum, 0.25);
  assert.equal(lobo.pv, 11);
  assert.deepEqual(lobo.ataques.map((a) => [a.nome, a.bonus, a.dano, a.bonusDano, a.tipoDano]), [["Mordida", 4, "2d4", 2, "perfurante"]]);
  assert.equal(fera("crocodilo").nada, true);
  assert.equal(fera("aguia-gigante").voa, true);
  assert.equal(fera("urso-marrom").ataques.length, 2); // mordida + garras (Ataques Múltiplos fica como ação)
  assert.equal(fera("urso-marrom").acoes[0].nome, "Ataques Múltiplos");
});

test("formas de besta por nível (tabela do livro) e Círculo da Lua", () => {
  const l2 = limiteDaForma(druida(2))!;
  assert.equal(l2.ndMax, 0.25);
  assert.ok(feraPermitida(fera("lobo"), l2));
  assert.ok(!feraPermitida(fera("crocodilo"), l2)); // ND 1/2 e natação
  assert.ok(!feraPermitida(fera("urso-marrom"), l2));
  const l4 = limiteDaForma(druida(4))!;
  assert.ok(feraPermitida(fera("crocodilo"), l4)); // ND 1/2, natação liberada
  assert.ok(!feraPermitida(fera("aguia-gigante"), l4)); // voo só no 8º
  const l8 = limiteDaForma(druida(8))!;
  assert.ok(feraPermitida(fera("aguia-gigante"), l8) && feraPermitida(fera("urso-marrom"), l8));
  assert.equal(l8.horas, 4);
  assert.equal(limiteDaForma(druida(1)), null);
  // Lua: ND 1 já no 2º (ignora a coluna ND), nível ÷ 3 depois do 6º
  const lua2 = limiteDaForma(druida(2, { subclasse: "Círculo da Lua" }))!;
  assert.equal(lua2.ndMax, 1);
  assert.ok(feraPermitida(fera("urso-marrom"), lua2));
  assert.ok(!feraPermitida(fera("aguia-gigante"), lua2)); // mas mantém a limitação de voo
  assert.equal(limiteDaForma(druida(12, { subclasse: "Círculo da Lua" }))!.ndMax, 4);
});

test("a ficha efetiva troca FOR/DES/CON, CA, deslocamento, PV e ataques pelos da fera", () => {
  const f = assumirForma(druida(4, { pv: 18 }), fera("lobo"));
  assert.ok(f.ativos!.includes("forma-selvagem"));
  const e = comForma(f, fera("lobo"));
  assert.deepEqual([e.atributos.for, e.atributos.des, e.atributos.con], [12, 15, 12]);
  assert.deepEqual([e.atributos.int, e.atributos.sab, e.atributos.car], [10, 16, 10]); // mentais continuam
  assert.deepEqual([e.ca, e.deslocamento, e.pv, e.pvMax], [13, "12 m", 11, 11]);
  assert.equal(e.ataques.length, 1);
  assert.equal(e.ataques[0].nome, "Mordida");
  assert.ok(e.ataques[0].derivado);
  // acerto e dano são exatamente os do livro: +4 e 2d4+2
  const ac = testeAtaque(e, e.ataques[0]);
  assert.equal(ac.partes.reduce((s, p) => s + p.valor, 0), 4);
  const dn = testeDano(e, e.ataques[0]);
  assert.equal(dn.dado, "2d4");
  assert.equal(dn.partes.reduce((s, p) => s + p.valor, 0), 2);
  // dano fixo sem dado (serpente): 1 de dano, não 1 + mod
  const s = comForma(assumirForma(druida(4), fera("serpente-venenosa")), fera("serpente-venenosa"));
  assert.equal(testeDano(s, s.ataques[0]).partes.reduce((a, p) => a + p.valor, 0), 0);
  assert.equal(testeDano(s, s.ataques[0]).dado, "1");
});

test("gravar com a fera não toca nos números do druida; PV da fera vão para forma.pv", () => {
  const bruta = assumirForma(druida(4, { pv: 18 }), fera("lobo"));
  const editada = { ...comForma(bruta, fera("lobo")), pv: 7 };
  const g = gravavel(bruta, editada);
  assert.equal(g.pv, 18);
  assert.equal(g.pvMax, 20);
  assert.equal(g.ca, 13);
  assert.deepEqual(g.atributos, bruta.atributos);
  assert.equal(g.forma!.pv, 7);
  assert.equal(g.ataques.length, 1); // só o cajado do druida
  assert.equal(g.ataques[0].id, "cajado");
});

test("dano na fera: sai dos PV dela; ao zerar volta à forma normal e o excedente passa ao druida", () => {
  const aplic = (f: FichaDnd, dano: number) => { const r = aplicarDano(f, { valor: dano, defesas: { resistencias: [], vulnerabilidades: [], imunidades: [] } }); return { ficha: r.ficha, texto: r.texto }; };
  const bruta = assumirForma(druida(4, { pv: 18 }), fera("lobo")); // lobo: 11 PV
  const a = danoNaForma(bruta, 4, aplic);
  assert.equal(a.voltou, false);
  assert.equal(a.ficha.forma!.pv, 7);
  assert.equal(a.ficha.pv, 18);
  const b = danoNaForma(a.ficha, 10, aplic); // 7 da fera + 3 excedente
  assert.equal(b.voltou, true);
  assert.equal(b.ficha.forma, undefined);
  assert.equal(b.ficha.pv, 15);
  assert.ok(!b.ficha.ativos!.includes("forma-selvagem"));
  // exato: volta sem dano ao druida
  const c = danoNaForma(a.ficha, 7, aplic);
  assert.equal(c.ficha.pv, 18);
  assert.equal(c.ficha.forma, undefined);
});

test("em forma de fera não conjura (exceto no 18º nível); descanso encerra a forma", () => {
  const m: Magia = { id: "m1", nome: "Curar Ferimentos", nivel: 1, ativa: true } as Magia;
  const f = assumirForma(druida(4), fera("lobo"));
  const r = conjurarMagia({ ...f, magias: [m] }, m, 1);
  assert.equal(r.ok, false);
  assert.equal(f.espacos[0].usados, 0);
  const alto = assumirForma(druida(18), fera("urso-marrom"));
  assert.equal(conjurarMagia({ ...alto, magias: [m] }, m, 1).ok, true);
  const dep = restaurarRecursos(f, [], "curto");
  assert.equal(dep.forma, undefined);
  assert.deepEqual(dep.ativos, []);
  assert.equal(reverterForma(f).forma, undefined);
});

test("Círculo da Lua: gasta espaço de magia e cura 1d8 por círculo, só transformado", () => {
  const lua = druida(2, { subclasse: "Círculo da Lua" });
  assert.equal(curaDeCombate(lua, 1).ok, false); // fora da forma
  const f = assumirForma(lua, fera("lobo"));
  const r = curaDeCombate(f, 2);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.dado, "2d8"); assert.equal(r.ficha.espacos[1].usados, 1); }
  assert.equal(curaDeCombate(assumirForma(druida(2), fera("lobo")), 1).ok, false); // outro círculo
  const sem = { ...f, espacos: f.espacos.map((e) => ({ ...e, usados: e.total })) };
  assert.equal(curaDeCombate(sem, 1).ok, false);
});

test("Forma Selvagem de Elemental: só Círculo da Lua 10+, custa 2 usos, traz as defesas do elemental", () => {
  const ar = fera("elemental-do-ar");
  assert.ok(ar.elemental);
  assert.equal(custoDaForma(ar), 2);
  assert.equal(custoDaForma(fera("lobo")), 1);
  assert.ok(!feraPermitida(ar, limiteDaForma(druida(10))!)); // fora do Círculo da Lua
  assert.ok(!feraPermitida(ar, limiteDaForma(druida(9, { subclasse: "Círculo da Lua" }))!));
  const lim = limiteDaForma(druida(10, { subclasse: "Círculo da Lua" }))!;
  assert.ok(feraPermitida(ar, lim) && feraPermitida(fera("elemental-do-fogo"), lim));
  assert.ok(!feraPermitida(fera("elemental-do-fogo"), limiteDaForma(druida(8, { subclasse: "Círculo da Lua" }))!));
  // defesas: imunidade a veneno e fogo, resistências a elétrico/trovejante entram na ficha efetiva
  const f = assumirForma(druida(10, { subclasse: "Círculo da Lua" }), fera("elemental-do-fogo"));
  assert.deepEqual(comForma(f, fera("elemental-do-fogo")).defesas!.imunidades, ["fogo", "veneno"]);
  assert.deepEqual(comForma(assumirForma(f, ar), ar).defesas!.resistencias, ["elétrico", "trovejante"]);
  // ataque do elemental do fogo: +6 (proficiência 3 da fera + 3), 2d6+3 de fogo
  const e = comForma(f, fera("elemental-do-fogo"));
  assert.equal(testeAtaque(e, e.ataques[0]).partes.reduce((s, p) => s + p.valor, 0), 6);
  assert.equal(testeDano(e, e.ataques[0]).partes.reduce((s, p) => s + p.valor, 0), 3);
  // gravar não leva as defesas da fera
  const g = gravavel(f, { ...e, pv: 50 });
  assert.equal(g.defesas, undefined);
  assert.equal(g.forma!.pv, 50);
});

test("perícias: se a fera tem a mesma perícia e o bônus dela é maior, vale o da fera", () => {
  const lobo = fera("lobo"); // Furtividade +4, Percepção +3
  // druida de SAB 16 proficiente em Percepção (+3+2 = +5): maior que o +3 do lobo, fica o do druida
  const a = druida(4, { pericias: { percepcao: 1, furtividade: 1 } });
  const ea = comForma(assumirForma(a, lobo), lobo);
  // Furtividade: DES do lobo 15 (+2) + 2 de proficiência = +4, igual ao lobo: nada muda; Percepção continua +5
  assert.equal(ea.bonusPericias.furtividade ?? 0, 0);
  assert.equal(ea.bonusPericias.percepcao ?? 0, 0);
  // druida com DES 8 (−1) proficiente em Furtividade: com a DES do lobo já é +4; sem proficiência a fera não vale
  const b = druida(4, { pericias: { percepcao: 1 }, atributos: { for: 8, des: 8, con: 14, int: 10, sab: 8, car: 10 } });
  const eb = comForma(assumirForma(b, lobo), lobo);
  assert.equal(eb.bonusPericias.furtividade ?? 0, 0); // sem proficiência em Furtividade: não usa o +4 da fera
  assert.equal(eb.bonusPericias.percepcao, 3 - (-1 + 2)); // SAB 8 (−1) + 2 = +1; o lobo tem +3: vale o da fera (+2 de diferença)
  // gravar devolve os bônus do druida
  assert.deepEqual(gravavel(assumirForma(b, lobo), { ...eb }).bonusPericias, b.bonusPericias);
});

test("Mil Formas: alterar-se à vontade, só Lua 14+, sem gastar espaço e não transformado", () => {
  assert.equal(temMilFormas(druida(14)), false);
  const lua = druida(14, { subclasse: "Círculo da Lua" });
  assert.ok(temMilFormas(lua));
  const r = alterarSeAVontade(lua);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.ficha.concentracao!.magiaId, "alterar-se"); assert.deepEqual(r.ficha.espacos, lua.espacos); }
  assert.equal(alterarSeAVontade(assumirForma(lua, fera("lobo"))).ok, false); // em fera não conjura
  assert.equal(alterarSeAVontade(druida(14)).ok, false);
});

test("painel do mestre: dano e cura na fera viram patch de forma; ao zerar volta e o excedente passa", () => {
  const base = assumirForma(druida(4, { pv: 18, nome: "Aria" }), fera("lobo"));
  const ef = comForma(base, fera("lobo"));
  const dano = danoDoMestre(ef, null, { valor: 4 }, base);
  assert.deepEqual(dano.patch, { forma: { feraId: "lobo", pv: 7 } });
  const zera = danoDoMestre(ef, null, { valor: 14 }, base); // 11 da fera + 3
  assert.equal(zera.patch.forma, undefined);
  assert.ok("forma" in zera.patch);
  assert.equal(zera.patch.pv, 15);
  assert.deepEqual(zera.patch.ativos, []);
  const ferida = { ...base, forma: { feraId: "lobo", pv: 5 } };
  const cura = curaDoMestre(comForma(ferida, fera("lobo")), 3, ferida);
  assert.deepEqual(cura.patch, { forma: { feraId: "lobo", pv: 8 } });
});
