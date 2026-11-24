import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buscarMagias, dadoDoTruque, dardosDoTruque, dadoNoCirculo, magiaParaFicha, somarDados, type MagiaCat } from "./magias.ts";

const magias: MagiaCat[] = JSON.parse(readFileSync(new URL("../../../data/dnd5e/phb/magias.json", import.meta.url), "utf8"));
const por = (id: string) => magias.find((m) => m.id === id)!;

test("catálogo: 361 magias, ids únicos, campos obrigatórios e referências de classe", () => {
  assert.equal(magias.length, 361);
  assert.equal(new Set(magias.map((m) => m.id)).size, 361);
  const classes = new Set(["bardo", "bruxo", "clerigo", "druida", "feiticeiro", "mago", "paladino", "patrulheiro"]);
  for (const m of magias) {
    assert.ok(m.nome && m.tempo && m.alcance && m.duracao && m.descricao, m.id);
    assert.ok(m.nivel >= 0 && m.nivel <= 9, m.id);
    assert.ok(m.classes.length > 0 && m.classes.every((c) => classes.has(c)), m.id);
    assert.equal(m.pacote, "phb");
  }
});

test("há truques e magias de todos os círculos", () => {
  for (let n = 0; n <= 9; n++) assert.ok(magias.some((m) => m.nivel === n), `nível ${n}`);
});

test("listas por classe: Bola de Fogo é de mago e feiticeiro; Curar Ferimentos não é de mago", () => {
  assert.deepEqual(por("bola-de-fogo").classes, ["feiticeiro", "mago"]);
  assert.ok(!por("curar-ferimentos").classes.includes("mago"));
  assert.ok(por("formas-animais").classes.includes("druida"));
  assert.ok(por("enfraquecer-intelecto").classes.includes("bruxo"));
});

test("busca ignora acento e combina filtros", () => {
  assert.ok(buscarMagias(magias, { texto: "misseis" }).some((m) => m.id === "misseis-magicos"));
  const r = buscarMagias(magias, { classe: "mago", nivel: 3, escola: "evocação" });
  assert.ok(r.some((m) => m.id === "bola-de-fogo") && r.every((m) => m.classes.includes("mago") && m.nivel === 3));
  assert.ok(buscarMagias(magias, { ritual: true }).every((m) => m.ritual));
});

test("escala: ampliar Bola de Fogo e truques por nível", () => {
  assert.equal(somarDados("8d6", "1d6", 1), "9d6");
  assert.equal(somarDados("1d8", "1d4", 2), "1d8+2d4");
  const bola = por("bola-de-fogo");
  assert.equal(dadoNoCirculo(bola, "8d6", 3), "8d6");
  assert.equal(dadoNoCirculo(bola, "8d6", 5), "10d6");
  const raio = por("raio-de-fogo");
  assert.equal(dadoDoTruque(raio, "1d10", 4), "1d10");
  assert.equal(dadoDoTruque(raio, "1d10", 5), "2d10");
  assert.equal(dadoDoTruque(raio, "1d10", 17), "4d10");
});

test("mecânica extraída: ataque, salvaguarda, cura", () => {
  assert.equal(por("raio-de-fogo").mecanica?.ataque, "distancia");
  assert.equal(por("bola-de-fogo").mecanica?.salvaguarda, "des");
  assert.deepEqual(por("curar-ferimentos").mecanica?.cura, { dado: "1d8", somaMod: true });
});

test("escala 'a cada dois níveis' e valor fixo por círculo", () => {
  const arma = por("arma-espiritual"); // 1d8 no 2º; +1d8 a cada 2 círculos
  assert.equal(dadoNoCirculo(arma, "1d8", 3), "1d8");
  assert.equal(dadoNoCirculo(arma, "1d8", 4), "2d8");
  assert.equal(dadoNoCirculo(arma, "1d8", 6), "3d8");
  const vit = por("vitalidade-falsa"); // 1d4+4 e +5 PV temporários por círculo
  assert.equal(dadoNoCirculo(vit, "1d4+4", 1), "1d4+4");
  assert.equal(dadoNoCirculo(vit, "1d4+4", 3), "1d4+14");
});

test("correções da revisão: erro de digitação do livro, falsos positivos e raios", () => {
  assert.equal(por("onda-destrutiva").mecanica?.danos?.[0].dado, "5d6"); // o livro traz "5d5"
  assert.equal(por("desejo").mecanica, undefined);
  assert.equal(por("teletransporte").mecanica?.danos, undefined);
  assert.equal(dardosDoTruque(por("rajada-mistica"), 4), 1);
  assert.equal(dardosDoTruque(por("rajada-mistica"), 11), 3);
  assert.equal(dardosDoTruque(por("rajada-mistica"), 17), 4);
});

test("magiaParaFicha preenche os campos da ficha", () => {
  const m = magiaParaFicha(por("bola-de-fogo"), "x1", true);
  assert.equal(m.catalogoId, "bola-de-fogo");
  assert.equal(m.escola, "Evocação");
  assert.equal(m.tipo, "salvaguarda");
  assert.equal(m.dano, "8d6");
  assert.equal(m.salvaguarda, "des");
  assert.match(m.componentes, /V, S, M \(/);
  assert.match(m.descricao, /Em Níveis Superiores/);
  assert.equal(magiaParaFicha(por("raio-de-fogo"), "x2", true).tipo, "ataque");
});
