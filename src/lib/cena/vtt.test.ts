import { test } from "node:test";
import assert from "node:assert/strict";
import { criarCenaVazia } from "./criar.ts";
import { aplicar } from "./comandos.ts";
import { ASSET_LUZ, type Cena } from "./tipos.ts";
import { corUvtt, montarUvtt, nomeArquivo, planoGrade } from "./vtt.ts";

let n = 0;
const id = () => `id${n++}`;
const cenaGrid = (): Cena => criarCenaVazia({ nome: "Masmorra", modo: "grid", tipoGrid: "quadrado", colunas: 10, linhas: 8 }, id);

test("5.4 VTT com paredes: inclui as paredes em unidades de grid e a imagem na resolução do grid", () => {
  let cena = cenaGrid();
  cena = aplicar(cena, { tipo: "definirParedes", paredes: [{ id: "p1", pontos: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.25 }] }] }).cena;
  const objetos = cena.camadas.find((c) => c.tipo === "objetos")!;
  cena = aplicar(cena, {
    tipo: "adicionarObjeto",
    objeto: { id: "l1", assetId: ASSET_LUZ, camadaId: objetos.id, x: 0.25, y: 0.5, escala: 0.2, rotacao: 0, espelhado: false, z: 0, luz: { cor: "#FFB347", intensidade: 0.8 } },
  }).cena;

  const plano = planoGrade(cena);
  assert.deepEqual(plano, { ppg: 64, largura: 640, altura: 512, celulas: { x: 10, y: 8 }, aproximado: false });
  const u = montarUvtt(cena, plano, "PNGBASE64");
  assert.deepEqual(u.resolution, { map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 8 }, pixels_per_grid: 64 });
  assert.deepEqual(u.line_of_sight, [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }]]);
  assert.deepEqual(u.lights, [{ position: { x: 2.5, y: 4 }, range: 1, intensity: 0.8, color: "ffffb347", shadows: true }]);
  assert.equal(u.image, "PNGBASE64");
});

test("5.4 VTT sem paredes: só imagem e grid", () => {
  const cena = cenaGrid();
  const u = montarUvtt(cena, planoGrade(cena), "PNGBASE64");
  assert.deepEqual(u.line_of_sight, []);
  assert.deepEqual(u.lights, []);
  assert.deepEqual(u.portals, []);
  assert.equal(u.resolution.pixels_per_grid, 64);
  assert.equal(u.image, "PNGBASE64");
});

test("paredes: definir e desfazer; luz em camada oculta não vai ao VTT", () => {
  const cena = cenaGrid();
  const r = aplicar(cena, { tipo: "definirParedes", paredes: [{ id: "p", pontos: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] });
  assert.equal(r.cena.paredes?.length, 1);
  assert.equal(aplicar(r.cena, r.inverso).cena.paredes, undefined);
  const objetos = cena.camadas.find((c) => c.tipo === "objetos")!;
  let c = aplicar(cena, { tipo: "adicionarObjeto", objeto: { id: "l", assetId: ASSET_LUZ, camadaId: objetos.id, x: 0.5, y: 0.5, escala: 0.1, rotacao: 0, espelhado: false, z: 0 } }).cena;
  c = aplicar(c, { tipo: "atualizarCamada", id: objetos.id, patch: { visivel: false } }).cena;
  assert.deepEqual(montarUvtt(c, planoGrade(c), "").lights, []);
});

test("grade de exportação: cenário livre usa as colunas pedidas; hex é aproximado", () => {
  const cenario = criarCenaVazia({ nome: "Floresta", modo: "cenario", largura: 1920, altura: 1080 }, id);
  const p = planoGrade(cenario, 30);
  assert.equal(p.ppg, 64);
  assert.deepEqual(p.celulas, { x: 30, y: 16.875 });
  assert.equal(p.largura, 1920);
  const hex = criarCenaVazia({ nome: "Hex", modo: "grid", tipoGrid: "hex", colunas: 10, linhas: 8 }, id);
  assert.equal(planoGrade(hex).aproximado, true);
});

test("cor e nome de arquivo", () => {
  assert.equal(corUvtt("#AbCdEf"), "ffabcdef");
  assert.equal(corUvtt("vermelho"), "ffffffff");
  assert.equal(nomeArquivo("Torre do Mágico!", "dd2vtt"), "torre-do-magico.dd2vtt");
});
