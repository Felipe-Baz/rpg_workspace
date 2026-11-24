import test from "node:test";
import assert from "node:assert/strict";
import {
  curar, descansoCurto, testeDadoVida, formatarExpressao as fmt,
  pesoTotal,
  FICHA_VAZIA, bonusPericia, bonusProficiencia, cdMagia, descansoLongo, dobrarDados, espacosPorNivel, expressaoParaRolar,
  formatarExpressao, modificador, normalizar, testeAtaque, testePericia, type FichaDnd,
} from "./dnd5e.ts";
import { rolar } from "./dados.ts";

const ficha = (p: Partial<FichaDnd> = {}): FichaDnd => normalizar({ ...p, atributos: { ...FICHA_VAZIA.atributos, ...p.atributos } });

test("modificador e bônus de proficiência", () => {
  assert.equal(modificador(10), 0);
  assert.equal(modificador(8), -1);
  assert.equal(modificador(18), 4);
  assert.deepEqual([1, 4, 5, 9, 13, 17, 20].map(bonusProficiencia), [2, 2, 3, 4, 5, 6, 6]);
});

test("perícia soma atributo, proficiência/especialização e extra", () => {
  const f = ficha({ nivel: 5, atributos: { ...FICHA_VAZIA.atributos, car: 16 }, pericias: { persuasao: 2 }, bonusPericias: { persuasao: 1 } });
  assert.equal(bonusPericia(f, "persuasao"), 3 + 6 + 1);
  const t = testePericia(f, "persuasao");
  assert.equal(formatarExpressao(t.dado, t.partes), "1d20 + 3 (Carisma) + 6 (Especialização) + 1 (Bônus extra)");
});

test("expressão mostra a origem de cada número e omite zeros", () => {
  assert.equal(formatarExpressao("1d20", [{ rotulo: "Carisma", valor: 5 }, { rotulo: "Armadura", valor: -1 }, { rotulo: "X", valor: 0 }]), "1d20 + 5 (Carisma) − 1 (Armadura)");
});

test("expressão para rolar aceita vantagem e crítico e é válida para o rolador", () => {
  const partes = [{ rotulo: "a", valor: 5 }, { rotulo: "b", valor: -1 }];
  assert.equal(expressaoParaRolar("1d20", partes, { vantagem: "v" }), "2d20kh1+4");
  assert.equal(expressaoParaRolar("1d20", partes, { vantagem: "d" }), "2d20kl1+4");
  assert.equal(expressaoParaRolar("1d8", partes, { critico: true }), "2d8+4");
  assert.equal(dobrarDados("d6+2d4"), "2d6+4d4");
  assert.equal(rolar(expressaoParaRolar("1d20", partes, { vantagem: "v" }), () => 0.5)?.total, 2 * 0 + 11 + 4);
});

test("ataque com arma usa atributo, proficiência e bônus", () => {
  const f = ficha({ nivel: 3, atributos: { ...FICHA_VAZIA.atributos, for: 16 } });
  const t = testeAtaque(f, { id: "1", nome: "Espada", atr: "for", proficiente: true, bonusAtaque: 1, dano: "1d8", bonusDano: 0, tipoDano: "cortante", notas: "" });
  assert.equal(formatarExpressao(t.dado, t.partes), "1d20 + 3 (Força) + 2 (Proficiência) + 1 (Bônus)");
});

test("espaços de magia: completo, meio e CD", () => {
  assert.deepEqual(espacosPorNivel("completo", 5), [4, 3, 2, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(espacosPorNivel("completo", 20), [4, 3, 3, 3, 3, 2, 2, 1, 1]);
  assert.deepEqual(espacosPorNivel("meio", 1), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(espacosPorNivel("meio", 5), [4, 2, 0, 0, 0, 0, 0, 0, 0]);
  const f = ficha({ nivel: 5, atrConjuracao: "car", atributos: { ...FICHA_VAZIA.atributos, car: 18 } });
  assert.equal(cdMagia(f), 8 + 3 + 4);
});

test("descanso longo restaura tudo, inclusive todos os dados de vida", () => {
  const f = ficha({ pv: 1, pvMax: 20, pvTemp: 5, dadosVidaTotal: 5, dadosVidaUsados: 5, morteFalhas: 2 });
  f.espacos[0] = { total: 3, usados: 3 };
  const r = descansoLongo(f);
  assert.equal(r.pv, 20);
  assert.equal(r.pvTemp, 0);
  assert.equal(r.morteFalhas, 0);
  assert.equal(r.dadosVidaUsados, 0);
  assert.deepEqual(r.espacos[0], { total: 3, usados: 0 });
});

test("normalizar completa campos que faltam", () => {
  const f = normalizar({ nome: "Aria" } as Partial<FichaDnd>);
  assert.equal(f.espacos.length, 9);
  assert.equal(f.atributos.car, 10);
});

test("peso total soma quantidade × peso", () => {
  const i = (quantidade: number, peso: number) => ({ id: "x", nome: "", quantidade, peso, equipado: false, descricao: "" });
  assert.equal(pesoTotal([i(2, 1.5), i(1, 0.25), i(0, 9)]), 3.25);
});

test("descanso curto: no máximo 2 até o próximo descanso longo", () => {
  let f = ficha();
  f = descansoCurto(descansoCurto(descansoCurto(f)));
  assert.equal(f.descansosCurtos, 2);
  assert.equal(descansoLongo(f).descansosCurtos, 0);
});

test("dado de vida usa o dado da classe e a Constituição", () => {
  const f = ficha({ dadoVida: "d10", atributos: { ...FICHA_VAZIA.atributos, con: 14 } });
  const t = testeDadoVida(f);
  assert.equal(fmt(t.dado, t.partes), "1d10 + 2 (Constituição)");
});

test("descanso curto gasta 1 dado de vida e restaura todos os espaços", () => {
  const f = ficha({ dadosVidaTotal: 3, dadosVidaUsados: 1 });
  f.espacos[1] = { total: 2, usados: 2 };
  const r = descansoCurto(f);
  assert.equal(r.dadosVidaUsados, 2);
  assert.deepEqual(r.espacos[1], { total: 2, usados: 0 });
  assert.equal(descansoCurto(ficha({ dadosVidaTotal: 1, dadosVidaUsados: 1 })).dadosVidaUsados, 1);
  assert.equal(curar(ficha({ pv: 5, pvMax: 8, morteFalhas: 2 }), 10).pv, 8);
});

import { alternarMagia, circulosDisponiveis, classeDeTexto, conjurar, contagemMagias, definirClasse, espacosDaClasse, limitesMagia, type Magia } from "./dnd5e.ts";

const magia = (p: Partial<Magia> = {}): Magia => ({ id: "m", nome: "x", nivel: 1, ativa: true, escola: "", tempo: "", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des", ...p });

test("limites do mago: truques e magias ativas pela Inteligência", () => {
  const f = definirClasse(ficha({ nivel: 5, atributos: { ...FICHA_VAZIA.atributos, int: 16 } }), "mago");
  assert.deepEqual(limitesMagia(f), { truques: 4, magias: 8 });
  assert.equal(f.atrConjuracao, "int");
  assert.deepEqual(f.espacos.slice(0, 3).map((e) => e.total), [4, 3, 2]);
});

test("limites de classes de magias conhecidas e preparadas", () => {
  assert.deepEqual(limitesMagia(definirClasse(ficha({ nivel: 3 }), "feiticeiro")), { truques: 4, magias: 4 });
  assert.deepEqual(limitesMagia(definirClasse(ficha({ nivel: 1 }), "patrulheiro")), { truques: 0, magias: 0 });
  const pal = definirClasse(ficha({ nivel: 5, atributos: { ...FICHA_VAZIA.atributos, car: 14 } }), "paladino");
  assert.equal(limitesMagia(pal)!.magias, 4); // 2 (metade do nível) + 2 (Car)
  assert.equal(limitesMagia(ficha()), null);
  assert.equal(limitesMagia(definirClasse(ficha(), "guerreiro")), null); // classe sem conjuração: sem limites
});

test("ajustes especiais somam aos limites da classe", () => {
  const f = { ...definirClasse(ficha({ nivel: 1 }), "mago"), ajusteLimites: { truques: 1, magias: 2 } };
  assert.deepEqual(limitesMagia(f), { truques: 4, magias: 3 });
});

test("espaços de pacto do bruxo ficam todos no mesmo círculo", () => {
  assert.deepEqual(espacosDaClasse("bruxo", 5), [0, 0, 2, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(espacosDaClasse("bruxo", 17), [0, 0, 0, 0, 4, 0, 0, 0, 0]);
});

test("o limite vale só para as ativas: cadastrar além do limite é livre", () => {
  const f = definirClasse(ficha({ nivel: 1, magias: [magia({ id: "a" }), magia({ id: "b" }), magia({ id: "c", ativa: false }), magia({ id: "t", nivel: 0 })] }), "feiticeiro");
  const c = contagemMagias(f);
  assert.equal(c.magias, 2);
  assert.equal(c.totalMagias, 3);
  assert.equal(c.magiasCheio, true); // feiticeiro nível 1 conhece 2 magias
  assert.equal(c.truquesCheio, false); // 1 de 4 truques
});

test("alternar: não ativa além do limite, mas desativar libera vaga", () => {
  let f = definirClasse(ficha({ nivel: 1, magias: [magia({ id: "a" }), magia({ id: "b" }), magia({ id: "c", ativa: false })] }), "feiticeiro");
  assert.equal(alternarMagia(f, "c"), f); // cheio (2/2)
  f = alternarMagia(f, "a");
  assert.equal(f.magias.find((m) => m.id === "a")!.ativa, false);
  f = alternarMagia(f, "c");
  assert.equal(f.magias.find((m) => m.id === "c")!.ativa, true);
});

test("conjurar gasta espaço, aceita círculo maior e ignora truque e magia inativa", () => {
  let f = definirClasse(ficha({ nivel: 3 }), "mago"); // [4,2]
  assert.deepEqual(circulosDisponiveis(f, 1), [1, 2]);
  f = conjurar(f, magia({ nivel: 1 }), 2);
  assert.equal(f.espacos[1].usados, 1);
  assert.equal(conjurar(f, magia({ nivel: 0 }), 1), f);
  assert.equal(conjurar(f, magia({ nivel: 1, ativa: false }), 1), f);
  assert.equal(conjurar(f, magia({ nivel: 2 }), 1), f); // círculo menor que a magia
  const sem = { ...f, espacos: f.espacos.map((e) => ({ ...e, usados: e.total })) };
  assert.equal(conjurar(sem, magia({ nivel: 1 }), 1), sem);
});

test("classeDeTexto e migração de fichas antigas (classe em texto, classeConj, preparada)", () => {
  assert.equal(classeDeTexto("Mago 5"), "mago");
  assert.equal(classeDeTexto("Clérigo"), "clerigo");
  assert.equal(classeDeTexto("Guerreiro 3 / Ladino 2"), "guerreiro");
  assert.equal(classeDeTexto("Artífice"), "");
  const a = normalizar({ classe: "Mago 5" as never, magias: [{ ...magia({ nivel: 1 }), ativa: undefined as never, preparada: false } as never] });
  assert.equal(a.classe, "mago");
  assert.equal(a.subclasse, "Mago 5");
  assert.equal(a.magias[0].ativa, false);
  const b = normalizar({ classe: "qualquer", classeConj: "bardo" } as never);
  assert.equal(b.classe, "bardo");
});
