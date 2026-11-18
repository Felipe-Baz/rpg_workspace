import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSPECTIVAS, assetServe, chaveOrdem, mostrarSeletor, obterPerspectiva, perspectivaEfetiva, perspectivasDisponiveis } from "./perspectivas/registro.ts";
import type { Perspectiva } from "./perspectivas/tipos.ts";
import { criarCenaVazia } from "../cena/criar.ts";
import { aplicar } from "../cena/comandos.ts";
import { extrairPaleta } from "./temas/paleta.ts";
import { interpretarPerfil, montarPedidoAnalise } from "./temas/analise.ts";
import { normalizarPerfil } from "./temas/tipos.ts";
import type { ObjetoCena } from "../cena/tipos.ts";

let n = 0;
const id = () => `i${++n}`;

test("perspectiva nova entra só com arquivo + uma linha no registro", () => {
  const lateral: Perspectiva = { id: "lateral", nome: "Lateral", imagemExemplo: "/perspectivas/lateral.svg", fragmentoPrompt: "side view", ordenacao: "porZ", projecaoGrid: "nenhuma", permiteGrid: false };
  const lista = [...PERSPECTIVAS, lateral];
  assert.ok(perspectivasDisponiveis("cenario", lista).some((p) => p.id === "lateral"));
  assert.equal(obterPerspectiva("lateral", lista)?.nome, "Lateral");
  assert.ok(PERSPECTIVAS.length >= 2 && PERSPECTIVAS.every((p) => p.imagemExemplo.startsWith("/perspectivas/")));
});

test("grid ignora o seletor; cenário aceita todas", () => {
  assert.equal(mostrarSeletor("grid"), false);
  assert.equal(perspectivaEfetiva("grid", "isometrica"), "topdown");
  assert.deepEqual(perspectivasDisponiveis("grid").map((p) => p.id), ["topdown"]);
  assert.equal(mostrarSeletor("cenario"), true);
  assert.deepEqual(perspectivasDisponiveis("cenario").map((p) => p.id), PERSPECTIVAS.map((p) => p.id));
  const g = criarCenaVazia({ nome: "G", modo: "grid", tipoGrid: "quadrado", colunas: 10, linhas: 10 }, id);
  assert.equal(g.perspectiva, "topdown");
  const c = criarCenaVazia({ nome: "C", modo: "cenario", largura: 800, altura: 600, perspectiva: "isometrica", temaId: "t1" }, id);
  assert.equal(c.perspectiva, "isometrica");
  assert.equal(c.temaId, "t1");
});

test("ordenação por Y em isométrica: maior Y fica na frente, mesmo com z menor", () => {
  const iso = obterPerspectiva("isometrica");
  const tras = { y: 0.3, z: 5 };
  const frente = { y: 0.7, z: 0 };
  assert.ok(chaveOrdem(iso, frente, 1) > chaveOrdem(iso, tras, 0));
  const top = obterPerspectiva("topdown");
  assert.ok(chaveOrdem(top, tras, 0) > chaveOrdem(top, frente, 1)); // top-down segue o z
});

test("troca de perspectiva é bloqueada com objetos", () => {
  let c = criarCenaVazia({ nome: "C", modo: "cenario", largura: 800, altura: 600 }, id);
  c = aplicar(c, { tipo: "definirPerspectiva", perspectiva: "isometrica" }).cena;
  assert.equal(c.perspectiva, "isometrica");
  const o: ObjetoCena = { id: id(), assetId: "a", camadaId: c.camadas[0].id, x: 0.5, y: 0.5, escala: 0.1, rotacao: 0, espelhado: false, z: 0 };
  c = aplicar(c, { tipo: "adicionarObjeto", objeto: o }).cena;
  assert.throws(() => aplicar(c, { tipo: "definirPerspectiva", perspectiva: "topdown" }), /não pode ser trocada/);
  const g = criarCenaVazia({ nome: "G", modo: "grid", tipoGrid: "quadrado", colunas: 5, linhas: 5 }, id);
  assert.throws(() => aplicar(g, { tipo: "definirPerspectiva", perspectiva: "isometrica" }), /top-down/);
});

test("definirTema é reversível", () => {
  const c = criarCenaVazia({ nome: "C", modo: "cenario", largura: 800, altura: 600 }, id);
  const r = aplicar(c, { tipo: "definirTema", temaId: "t9" });
  assert.equal(r.cena.temaId, "t9");
  assert.equal(aplicar(r.cena, r.inverso).cena.temaId, undefined);
});

test("paleta de assets filtra por perspectiva (legado é top-down)", () => {
  assert.equal(assetServe({}, "topdown"), true);
  assert.equal(assetServe({ perspectivaId: "isometrica" }, "topdown"), false);
  assert.equal(assetServe({ perspectivaId: "isometrica" }, "isometrica"), true);
});

test("paleta local tem até 8 cores sem IA", () => {
  const px: number[] = [];
  for (let i = 0; i < 4000; i++) px.push((i * 37) % 256, (i * 91) % 256, (i * 13) % 256, 255);
  const p = extrairPaleta(px);
  assert.ok(p.length > 0 && p.length <= 8);
  assert.ok(p.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  assert.deepEqual(extrairPaleta([0, 0, 0, 0]), []);
});

test("tema com IA: proposta é interpretada e normalizada; sem IA o perfil manual normaliza igual", () => {
  const resp = '```json\n{"descricao":" Pintura sombria ","paleta":["#AABBCC","vermelho"],"regras":["traço grosso"],"proibidos":["neon",""]}\n```';
  const p = interpretarPerfil(resp);
  assert.deepEqual(p, { descricao: "Pintura sombria", paleta: ["#aabbcc"], regras: ["traço grosso"], proibidos: ["neon"] });
  assert.throws(() => interpretarPerfil("sem json"), /perfil válido/);
  assert.equal(normalizarPerfil({ descricao: "à mão" }).descricao, "à mão");
  const ped = montarPedidoAnalise("texto", [{ mime: "image/jpeg", base64: "x" }]);
  assert.equal(ped.mensagens[0].imagens?.length, 1);
});
