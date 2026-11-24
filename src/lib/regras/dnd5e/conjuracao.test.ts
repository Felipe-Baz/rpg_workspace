import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, alternarMagia, contagemMagias, definirClasse, normalizar, type FichaDnd } from "../../dnd5e.ts";
import { cdConcentracao, classeFazRitual, conjurarMagia, planoDeConjuracao, podeAprender, testeConcentracao } from "./conjuracao.ts";
import { magiaParaFicha, type MagiaCat } from "./magias.ts";

const cat: MagiaCat[] = JSON.parse(readFileSync(new URL("../../../data/dnd5e/phb/magias.json", import.meta.url), "utf8"));
const por = (id: string) => cat.find((m) => m.id === id)!;
const mago = (nivel: number): FichaDnd => definirClasse(normalizar({ ...FICHA_VAZIA, nivel, atributos: { ...FICHA_VAZIA.atributos, int: 16, con: 14 }, salvaguardas: { ...FICHA_VAZIA.salvaguardas, con: false } }), "mago");
const com = (f: FichaDnd, id: string) => {
  const m = magiaParaFicha(por(id), `f-${id}`, true);
  return { f: { ...f, magias: [...f.magias, m] }, m };
};

test("Bola de Fogo: CD, dado escalado pelo círculo gasto", () => {
  const { f, m } = com(mago(5), "bola-de-fogo"); // int 16 (+3), prof +3 → CD 14
  const p3 = planoDeConjuracao(f, m, por("bola-de-fogo"), 3);
  assert.deepEqual(p3.salvaguarda, { cd: 14, atributo: "des" });
  assert.equal(p3.danos[0].dado, "8d6");
  assert.equal(planoDeConjuracao(f, m, por("bola-de-fogo"), 4).danos[0].dado, "9d6");
});

test("truque escala pelo nível do personagem", () => {
  const a = com(mago(4), "raio-de-fogo"), b = com(mago(5), "raio-de-fogo");
  assert.equal(planoDeConjuracao(a.f, a.m, por("raio-de-fogo"), 0).danos[0].dado, "1d10");
  assert.equal(planoDeConjuracao(b.f, b.m, por("raio-de-fogo"), 0).danos[0].dado, "2d10");
  assert.ok(planoDeConjuracao(b.f, b.m, por("raio-de-fogo"), 0).ataque);
});

test("cura soma o modificador de conjuração e escala", () => {
  const { f, m } = com(definirClasse(normalizar({ ...FICHA_VAZIA, nivel: 5, atributos: { ...FICHA_VAZIA.atributos, sab: 16 } }), "clerigo"), "curar-ferimentos");
  const p = planoDeConjuracao(f, m, por("curar-ferimentos"), 3);
  assert.equal(p.cura?.dado, "3d8");
  assert.deepEqual(p.cura?.partes.map((x) => x.valor), [3]);
  assert.equal(p.cura?.cura, true);
});

test("Mísseis Mágicos: dardos por círculo", () => {
  const { f, m } = com(mago(5), "misseis-magicos");
  const p1 = planoDeConjuracao(f, m, por("misseis-magicos"), 1);
  assert.equal(p1.dardos, 3);
  assert.equal(p1.danos[0].dado, "3d4+3");
  assert.equal(planoDeConjuracao(f, m, por("misseis-magicos"), 3).danos[0].dado, "5d4+5");
});

test("rolagens extras escalam: Sono (PV afetados) e Vitalidade Falsa (PV temporários)", () => {
  const s = com(mago(5), "sono");
  assert.equal(planoDeConjuracao(s.f, s.m, por("sono"), 1).extras[0].dado, "5d8");
  assert.equal(planoDeConjuracao(s.f, s.m, por("sono"), 3).extras[0].dado, "9d8");
  const v = com(mago(5), "vitalidade-falsa");
  assert.equal(planoDeConjuracao(v.f, v.m, por("vitalidade-falsa"), 2).extras[0].dado, "1d4+9");
});

test("raios: Rajada Mística pelo nível do personagem, Raio Ardente pelo círculo; dano por raio não multiplica", () => {
  const r5 = com(mago(5), "rajada-mistica");
  const p = planoDeConjuracao(r5.f, r5.m, por("rajada-mistica"), 0);
  assert.equal(p.dardos, 2);
  assert.equal(p.danos[0].dado, "1d10");
  const ra = com(mago(5), "raio-ardente");
  const q = planoDeConjuracao(ra.f, ra.m, por("raio-ardente"), 4);
  assert.equal(q.dardos, 5); // 3 + 1 por círculo acima do 2º
  assert.equal(q.danos[0].dado, "2d6");
});

test("dano que a heurística não pegava: Conjurar Rajada e Bola de Fogo Controlável", () => {
  const c = com(mago(9), "conjurar-rajada");
  assert.equal(planoDeConjuracao(c.f, c.m, por("conjurar-rajada"), 3).danos[0].dado, "3d8");
  const b = com(mago(15), "bola-de-fogo-controlavel");
  assert.equal(planoDeConjuracao(b.f, b.m, por("bola-de-fogo-controlavel"), 9).danos[0].dado, "14d6");
});

test("conjurar gasta espaço, registra concentração e avisa quem foi encerrada", () => {
  const { f: f0, m } = com(mago(5), "bola-de-fogo");
  let f = f0;
  const luz = magiaParaFicha(por("invisibilidade"), "inv", true);
  f = { ...f, magias: [...f.magias, luz] };
  const r1 = conjurarMagia(f, luz, 2);
  assert.ok(r1.ok && r1.ficha.concentracao?.nome === "Invisibilidade" && r1.ficha.espacos[1].usados === 1 && !r1.encerrou);
  const concentrada = (r1 as { ficha: FichaDnd }).ficha;
  const nova = magiaParaFicha(por("voo"), "voo", true);
  const r2 = conjurarMagia({ ...concentrada, magias: [...concentrada.magias, nova] }, nova, 3);
  assert.ok(r2.ok && r2.encerrou === "Invisibilidade" && r2.ficha.concentracao?.nome === "Voo");
  const semEspaco = conjurarMagia({ ...f, espacos: f.espacos.map((e) => ({ ...e, usados: e.total })) }, m, 3);
  assert.equal(semEspaco.ok, false);
});

test("ritual não gasta espaço; só para classes que o permitem", () => {
  const f = mago(5);
  const m = magiaParaFicha(por("detectar-magia"), "dm", true);
  assert.equal(classeFazRitual(f), true);
  const r = conjurarMagia({ ...f, magias: [m] }, m, 1, { ritual: true });
  assert.ok(r.ok && r.ficha.espacos[0].usados === 0);
  assert.equal(conjurarMagia(definirClasse(f, "feiticeiro"), m, 1, { ritual: true }).ok, false);
  assert.equal(conjurarMagia(f, magiaParaFicha(por("bola-de-fogo"), "x", true), 3, { ritual: true }).ok, false);
});

test("teste de concentração: CD máx(10, dano/2) com salvaguarda de Constituição", () => {
  assert.equal(cdConcentracao(8), 10);
  assert.equal(cdConcentracao(30), 15);
  const t = testeConcentracao({ ...mago(5), concentracao: { magiaId: "x", nome: "Voo" } }, 30);
  assert.match(t.titulo, /CD 15/);
  assert.equal(t.partes[0].valor, 2); // Con 14
});

test("podeAprender: lista da classe e círculo disponível", () => {
  const f = mago(3); // espaços até o 2º círculo
  assert.equal(podeAprender(f, por("bola-de-fogo")).ok, false); // 3º círculo
  assert.equal(podeAprender(f, por("misseis-magicos")).ok, true);
  assert.equal(podeAprender(f, por("curar-ferimentos")).ok, false); // não é de mago
  assert.equal(podeAprender(normalizar({}), por("curar-ferimentos")).ok, true); // sem classe: livre
  assert.equal(podeAprender(definirClasse(normalizar({}), "guerreiro"), por("curar-ferimentos")).ok, true);
});

test("magia sempre preparada: fora dos limites e sempre pronta", () => {
  let f = mago(1);
  const m = { ...magiaParaFicha(por("bencao"), "b", false), sempre: true };
  f = { ...f, magias: [...f.magias, m] };
  assert.equal(contagemMagias(f).magias, 0);
  assert.equal(conjurarMagia(f, m, 1).ok, true);
  assert.equal(alternarMagia(f, "b"), f);
});
