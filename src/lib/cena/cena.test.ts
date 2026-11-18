import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicar, desfazer, executar, historicoVazio, refazer, validarResolucao, type Comando } from "./comandos.ts";
import { criarCenaVazia } from "./criar.ts";
import { larguraCelulaFracao, objetoEm, snapGrid, tamanhoExport } from "./geometria.ts";
import { ehMapaDeCena, patchSalvarRender } from "./compat.ts";
import type { Asset, ObjetoCena } from "./tipos.ts";

let n = 0;
const id = () => `id${++n}`;
const base = () => criarCenaVazia({ nome: "T", modo: "grid", tipoGrid: "quadrado", colunas: 30, linhas: 20 }, id, 1);
const obj = (cena: ReturnType<typeof base>, p: Partial<ObjetoCena> = {}): ObjetoCena => ({
  id: id(), assetId: "a1", camadaId: cena.camadas[3].id, x: 0.5, y: 0.5, escala: 0.1, rotacao: 0, espelhado: false, z: 0, ...p,
});
const asset: Asset = { id: "a1", nome: "x", url: "u", largura: 100, altura: 100, origem: "enviado", criadoEm: 0 };

test("cena em grid 30x20 trava proporção 3:2", () => {
  const c = base();
  assert.equal(c.largura / c.altura, 1.5);
  assert.deepEqual(c.grid, { tipo: "quadrado", colunas: 30, linhas: 20, noRender: true });
  assert.equal(c.camadas.length, 5);
});

test("cena de cenário não tem grid e é top-down", () => {
  const c = criarCenaVazia({ nome: "C", modo: "cenario", largura: 1600, altura: 900 }, id);
  assert.equal(c.grid, undefined);
  assert.equal(c.perspectiva, "topdown");
});

test("mover objeto altera só ele", () => {
  let c = base();
  const a = obj(c), b = obj(c, { x: 0.2 });
  c = { ...c, objetos: [a, b] };
  const r = aplicar(c, { tipo: "atualizarObjeto", id: a.id, patch: { x: 0.9 } });
  assert.equal(r.cena.objetos[0].x, 0.9);
  assert.equal(r.cena.objetos[1], b);
});

test("desfazer remoção restaura posição, camada e ordem", () => {
  let c = base();
  const [a, b, d] = [obj(c), obj(c, { x: 0.3 }), obj(c, { x: 0.7 })];
  c = { ...c, objetos: [a, b, d] };
  let h = historicoVazio();
  ({ cena: c, historico: h } = executar(c, h, { tipo: "removerObjeto", id: b.id }));
  assert.equal(c.objetos.length, 2);
  ({ cena: c, historico: h } = desfazer(c, h));
  assert.deepEqual(c.objetos, [a, b, d]);
});

test("refazer após desfazer leva ao mesmo estado", () => {
  let c = base();
  const o = obj(c);
  let h = historicoVazio();
  ({ cena: c, historico: h } = executar(c, h, { tipo: "adicionarObjeto", objeto: o }));
  ({ cena: c, historico: h } = executar(c, h, { tipo: "atualizarObjeto", id: o.id, patch: { rotacao: 1 } }));
  const antes = c;
  ({ cena: c, historico: h } = desfazer(c, h));
  ({ cena: c, historico: h } = desfazer(c, h));
  assert.equal(c.objetos.length, 0);
  ({ cena: c, historico: h } = refazer(c, h));
  ({ cena: c, historico: h } = refazer(c, h));
  assert.deepEqual(c, antes);
});

test("novo comando limpa o refazer", () => {
  let c = base();
  let h = historicoVazio();
  ({ cena: c, historico: h } = executar(c, h, { tipo: "definirFundo", fundo: "#111" }));
  ({ cena: c, historico: h } = desfazer(c, h));
  ({ cena: c, historico: h } = executar(c, h, { tipo: "definirFundo", fundo: "#222" }));
  assert.equal(h.futuro.length, 0);
});

test("remover camada leva objetos e desfazer devolve tudo", () => {
  let c = base();
  const o1 = obj(c), o2 = obj(c, { camadaId: c.camadas[0].id });
  c = { ...c, objetos: [o1, o2] };
  const antes = c;
  const r = aplicar(c, { tipo: "removerCamada", id: c.camadas[3].id });
  assert.equal(r.cena.objetos.length, 1);
  assert.deepEqual(aplicar(r.cena, r.inverso).cena, antes);
});

test("lote é revertido por inteiro", () => {
  const c = base();
  const o = obj(c);
  const cmd: Comando = { tipo: "lote", comandos: [{ tipo: "adicionarObjeto", objeto: o }, { tipo: "atualizarObjeto", id: o.id, patch: { x: 0.1 } }] };
  const r = aplicar(c, cmd);
  assert.equal(r.cena.objetos[0].x, 0.1);
  assert.deepEqual(aplicar(r.cena, r.inverso).cena, c);
});

test("aspect ratio travado: mudar só a largura é recusado; mesma proporção passa", () => {
  const c = base();
  assert.ok(validarResolucao(c, c.largura + 100, c.altura));
  assert.throws(() => aplicar(c, { tipo: "redimensionar", largura: 3000, altura: 1280 }));
  assert.equal(validarResolucao(c, c.largura * 2, c.altura * 2), null);
});

test("snap quadrado vai ao centro da célula", () => {
  const c = base();
  const p = snapGrid(c, { x: 0.51, y: 0.52 });
  const cel = 1 / 30;
  assert.ok(Math.abs(p.x - (15 + 0.5) * cel) < 1e-9);
  assert.ok(Math.abs(larguraCelulaFracao(c)! - cel) < 1e-9);
});

test("snap hex escolhe o centro mais próximo", () => {
  const c = criarCenaVazia({ nome: "H", modo: "grid", tipoGrid: "hex", colunas: 10, linhas: 8 }, id);
  const p = snapGrid(c, { x: 0.3, y: 0.3 });
  // o ponto snapado deve ser idempotente
  const q = snapGrid(c, p);
  assert.ok(Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9);
});

test("seleção respeita camada travada e rotação", () => {
  let c = base();
  const o = obj(c, { rotacao: Math.PI / 2, escala: 0.2 });
  c = { ...c, objetos: [o] };
  const assets = new Map([[asset.id, asset]]);
  assert.equal(objetoEm(c, assets, { x: 0.5, y: 0.5 })?.id, o.id);
  assert.equal(objetoEm(c, assets, { x: 0.9, y: 0.9 }), null);
  const travada = { ...c, camadas: c.camadas.map((l) => (l.id === o.camadaId ? { ...l, travada: true } : l)) };
  assert.equal(objetoEm(travada, assets, { x: 0.5, y: 0.5 }), null);
});

test("render limita o lado maior a 4096 preservando a proporção", () => {
  const t = tamanhoExport({ largura: 8000, altura: 4000 });
  assert.deepEqual(t, { largura: 4096, altura: 2048 });
  assert.deepEqual(tamanhoExport({ largura: 1920, altura: 1280 }), { largura: 1920, altura: 1280 });
});

// --- Compatibilidade com mapas de imagem (5.1–5.3) ---
test("salvar atualiza só a imagem: coberturas, zonas, pinos e liberação ficam intactos", () => {
  const mapa = { id: "m", imagem: "velha", todos: true, liberadoPara: ["u"], zonas: [{ id: "z", nome: "Sala" }], cobertas: [{ id: "c", zonaId: "z", pontos: [{ x: 0.1, y: 0.1 }], revelada: false }] };
  const depois = { ...mapa, ...patchSalvarRender("nova") };
  assert.deepEqual(Object.keys(patchSalvarRender("nova")), ["imagem"]);
  assert.equal(depois.imagem, "nova");
  assert.deepEqual(depois.cobertas, mapa.cobertas);
  assert.deepEqual(depois.zonas, mapa.zonas);
  assert.equal(depois.todos, true);
  assert.deepEqual(depois.liberadoPara, ["u"]);
});

test("coberturas em fração não se deslocam: proporção do render = proporção do canvas", () => {
  const c = base();
  const t = tamanhoExport(c);
  assert.ok(Math.abs(t.largura / t.altura - c.largura / c.altura) < 1e-3);
});

test("mapa sem origem é de imagem; sem cenaId também (cena opcional)", () => {
  assert.equal(ehMapaDeCena({}), false);
  assert.equal(ehMapaDeCena({ origem: "cena", cenaId: "x" }), true);
  assert.equal(ehMapaDeCena({ origem: "cena" }), false);
});

test("alças: escala no canto inferior direito, rotação acima do topo", async () => {
  const { alcaEm, geometriaSelecao } = await import("./geometria.ts");
  const c = base();
  const o = obj(c, { escala: 0.2 });
  const g = geometriaSelecao(c, o, asset);
  assert.equal(alcaEm(c, o, asset, 1, g.alcaEscala), "escala");
  assert.equal(alcaEm(c, o, asset, 1, g.alcaRotacao), "rotacao");
  assert.equal(alcaEm(c, o, asset, 1, g.centro), null);
});
