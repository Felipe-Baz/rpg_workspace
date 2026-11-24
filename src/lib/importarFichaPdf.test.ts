import test from "node:test";
import assert from "node:assert/strict";
import { bonusPericia, bonusSalvaguarda, modDe } from "./dnd5e.ts";
import { fichaDeCampos, inteiro, lerAtributo, lerAtributoConjuracao, lerClasseNivel, type CamposPdf } from "./importarFichaPdf.ts";

let n = 0;
const id = () => `id${++n}`;

test("inteiro entende sinais e símbolo de menos", () => {
  assert.equal(inteiro("+3"), 3);
  assert.equal(inteiro("−2"), -2);
  assert.equal(inteiro("12 (couro)"), 12);
  assert.equal(inteiro("nada"), undefined);
});

test("lerAtributo aceita modificador ou valor, em qualquer caixa", () => {
  assert.equal(lerAtributo("+3", "16"), 16);
  assert.equal(lerAtributo("16", "+3"), 16);
  assert.equal(lerAtributo("3", "16"), 16);
  assert.equal(lerAtributo("", "14"), 14);
  assert.equal(lerAtributo("+2", ""), 14);
  assert.equal(lerAtributo("", ""), undefined);
});

test("classe e nível", () => {
  assert.deepEqual(lerClasseNivel("Mago 5"), { classe: "Mago", nivel: 5 });
  assert.deepEqual(lerClasseNivel("Bárbaro, nível 3"), { classe: "Bárbaro", nivel: 3 });
  assert.deepEqual(lerClasseNivel("Guerreiro 3 / Ladino 2"), { classe: "Guerreiro 3 / Ladino 2", nivel: 5 });
  assert.deepEqual(lerClasseNivel("Clérigo"), { classe: "Clérigo", nivel: 1 });
});

test("atributo de conjuração por nome ou sigla", () => {
  assert.equal(lerAtributoConjuracao("Inteligência"), "int");
  assert.equal(lerAtributoConjuracao("CAR"), "car");
  assert.equal(lerAtributoConjuracao("Sabedoria"), "sab");
  assert.equal(lerAtributoConjuracao(""), "");
});

const campos: CamposPdf = {
  t0: "Elora", t8: "Mago 5", t9: "Sábio", t13: "Elfa", t12: "Neutro", t11: "6500", t26: "1",
  t27: "-1", t29: "8", t30: "+2", t33: "14", t32: "+1", t31: "12", t35: "+4", t34: "18", t36: "+1", t39: "12", t38: "0", t37: "10",
  c3: true, c4: true,
  c7: true, t67: "+7", // arcanismo: INT +4, prof +3 = +7
  t25: "13", t23: "+2", t24: "9 m", t42: "27", t40: "20", t41: "3", t43: "5d6", t44: "5", c24: true, c25: true, c27: true,
  t45: "Cajado", t48: "+3", t51: "1d6+1 contundente",
  t46: "Adaga", t49: "+5", t52: "1d4 + 2 perfurante",
  t20: "Inteligência", t104: "4", t103: "1", t105: "3", t102: "0", t106: "2",
  t134: "Prestidigitação", t109: "Mísseis Mágicos", c53: true, t110: "Escudo Arcano", t121: "Invisibilidade", c49: true, t208: "Bola de Fogo", c110: true,
  t55: "5", t57: "0", t58: "0", t59: "120", t56: "2",
  t6: "Cajado, grimório", t16: "Gema de 50 po", t14: "Recuperação Arcana", t15: "Tradição Arcana",
  t1: "Curiosa", t2: "Conhecimento", t3: "Sua guilda", t4: "Teimosa",
  t85: "120", t88: "Prata", t90: "Verdes", t17: "Nasceu numa torre.", t18: "Colégio", t209: "Mestre Aldo",
};

test("fichaDeCampos preenche identificação, atributos e combate", () => {
  const { ficha: f } = fichaDeCampos(campos, id);
  assert.equal(f.nome, "Elora");
  assert.equal(f.classe, "Mago");
  assert.equal(f.nivel, 5);
  assert.equal(f.xp, 6500);
  assert.equal(f.inspiracao, true);
  assert.deepEqual(f.atributos, { for: 8, des: 14, con: 12, int: 18, sab: 12, car: 10 });
  assert.equal(f.salvaguardas.int, true);
  assert.equal(f.salvaguardas.for, false);
  assert.equal(bonusSalvaguarda(f, "int"), 4 + 3);
  assert.equal(f.ca, 13);
  assert.equal(f.bonusIniciativa, 0); // +2 = modificador de Destreza
  assert.equal(f.pvMax, 27); assert.equal(f.pv, 20); assert.equal(f.pvTemp, 3);
  assert.equal(f.dadoVida, "d6"); assert.equal(f.dadosVidaTotal, 5);
  assert.equal(f.morteSucessos, 2); assert.equal(f.morteFalhas, 1);
});

test("perícia mantém o bônus mostrado no PDF", () => {
  const { ficha: f } = fichaDeCampos(campos, id);
  assert.equal(f.pericias.arcanismo, 1);
  assert.equal(bonusPericia(f, "arcanismo"), 7);
  assert.equal(modDe(f, "int"), 4);
});

test("especialização e bônus extra são deduzidos do valor", () => {
  // arcanismo (INT +4, prof +3): +10 = dobro da proficiência → especialista
  // atuação (CAR +0): +10 com proficiência → 7 acima do normal vira bônus extra
  // enganação (CAR +0): +4 com proficiência → 1 acima do normal
  const { ficha: f } = fichaDeCampos({ ...campos, t67: "+10", c9: true, t69: "+10", c10: true, t70: "+4" }, id);
  assert.equal(f.pericias.arcanismo, 2);
  assert.equal(bonusPericia(f, "arcanismo"), 10);
  assert.equal(bonusPericia(f, "atuacao"), 10);
  assert.equal(bonusPericia(f, "enganacao"), 4);
});

test("ataques mantêm o bônus e o dano do PDF", () => {
  const { ficha: f } = fichaDeCampos(campos, id);
  assert.equal(f.ataques.length, 2);
  const [cajado, adaga] = f.ataques;
  assert.equal(cajado.nome, "Cajado");
  assert.equal(cajado.dano, "1d6");
  assert.equal(cajado.tipoDano, "contundente");
  assert.equal(adaga.dano, "1d4");
  assert.equal(adaga.tipoDano, "perfurante");
  // bônus total = mod + proficiência (se houver) + extra
  const total = (a: typeof cajado) => modDe(f, a.atr) + (a.proficiente ? 3 : 0) + a.bonusAtaque;
  assert.equal(total(cajado), 3);
  assert.equal(total(adaga), 5);
  assert.equal(modDe(f, adaga.atr) + adaga.bonusDano, 2);
});

test("magias, espaços e moedas", () => {
  const { ficha: f } = fichaDeCampos(campos, id);
  assert.equal(f.atrConjuracao, "int");
  assert.deepEqual(f.espacos[0], { total: 4, usados: 1 });
  assert.deepEqual(f.espacos[1], { total: 3, usados: 0 });
  assert.deepEqual(f.espacos[4], { total: 2, usados: 0 });
  assert.deepEqual(f.espacos[8], { total: 0, usados: 0 });
  const por = (nome: string) => f.magias.find((m) => m.nome === nome)!;
  assert.equal(por("Prestidigitação").nivel, 0);
  assert.equal(por("Mísseis Mágicos").nivel, 1);
  assert.equal(por("Mísseis Mágicos").preparada, true);
  assert.equal(por("Escudo Arcano").preparada, false);
  assert.equal(por("Invisibilidade").nivel, 2);
  assert.equal(por("Bola de Fogo").nivel, 3);
  assert.equal(por("Bola de Fogo").preparada, true);
  assert.equal(f.magias.length, 5);
  assert.deepEqual(f.moedas, { pc: 5, pp: 0, pe: 0, po: 120, pl: 2 });
});

test("textos livres, aparência e história", () => {
  const { ficha: f } = fichaDeCampos(campos, id);
  assert.equal(f.equipamento, "Cajado, grimório\n\nTesouros:\nGema de 50 po");
  assert.equal(f.tracos, "Recuperação Arcana\n\nTradição Arcana");
  assert.equal(f.personalidade, "Curiosa");
  assert.equal(f.aparencia, "Idade: 120 · Cabelo: Prata · Olhos: Verdes");
  assert.deepEqual(f.livro, ["Nasceu numa torre."]);
  assert.match(f.notas, /Aliados e organizações \(Colégio\):\nMestre Aldo/);
});

test("PDF em branco gera a ficha padrão sem quebrar", () => {
  const { ficha: f } = fichaDeCampos({}, id);
  assert.equal(f.nivel, 1);
  assert.equal(f.pv, f.pvMax);
  assert.equal(f.magias.length, 0);
});
