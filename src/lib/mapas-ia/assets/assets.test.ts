import { test } from "node:test";
import assert from "node:assert/strict";
import type { Asset, Cena } from "../../cena/tipos.ts";
import { criarCenaVazia } from "../../cena/criar.ts";
import { executar, historicoVazio } from "../../cena/comandos.ts";
import { CANDIDATAS } from "../corChave.ts";
import type { PixelsRgba } from "../fundo.ts";
import { obterPerspectiva } from "../perspectivas/registro.ts";
import type { CapacidadesImagem, ImagemBase64 } from "../tipos.ts";
import { cenasQueUsam, decidirExclusao, filtrarAssets, normalizarTags, sugerirReuso, substituirAsset, tagsDe } from "./biblioteca.ts";
import { MAX_VARIACOES, validarPedido } from "./jobs.ts";
import { executarPipeline, planejarVariacoes, removerFundoNecessario, type DepsPipeline, type Etapa } from "./pipeline.ts";
import { LIMITE_EMENDA, corrigirCostura, descontinuidade, normalizarTamanho, recortarAoConteudo, verificarTextura } from "./pixels.ts";
import { comporPrompt } from "./prompt.ts";

const capSemAlfa: CapacidadesImagem = { alfaNativo: false, imagensReferencia: 10, inpainting: "instrucao", seed: false, tamanhos: [] };
const capComAlfa: CapacidadesImagem = { ...capSemAlfa, alfaNativo: true, seed: true };

const asset = (p: Partial<Asset>): Asset => ({ id: "a", nome: "x", url: "u", largura: 10, altura: 10, origem: "ia", criadoEm: 0, ...p });

/** Imagem sintética: fundo magenta com um quadrado vermelho no meio. */
function spriteSobreMagenta(w = 200, h = 120): PixelsRgba {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dentro = x > 70 && x < 130 && y > 40 && y < 80;
      d.set(dentro ? [200, 30, 30, 255] : [255, 0, 255, 255], (y * w + x) * 4);
    }
  return { data: d, width: w, height: h };
}

function depsFalsas(px: PixelsRgba, log: Etapa[] = []): DepsPipeline & { log: Etapa[] } {
  return {
    log,
    gerar: async () => ({ mime: "image/png", base64: "FAKE" }),
    decodificar: async () => px,
    codificar: async (p) => ({ mime: "image/png", base64: `png:${p.width}x${p.height}` }),
    aoProgredir: (e) => log.push(e),
  };
}

// ---------- Biblioteca ----------
test("tags: normaliza acentos e remove palavras vazias", () => {
  assert.deepEqual(tagsDe("A Árvore de Carvalho"), ["arvore", "carvalho"]);
  assert.deepEqual(normalizarTags("Árvore, carvalho  grande"), ["arvore", "carvalho", "grande"]);
});

test("busca por tag respeita a perspectiva da cena", () => {
  const todos = [
    asset({ id: "1", nome: "Carvalho", tags: ["arvore", "carvalho"] }),
    asset({ id: "2", nome: "Pinheiro iso", tags: ["arvore"], perspectivaId: "isometrica" }),
    asset({ id: "3", nome: "Barril", tags: ["barril"] }),
  ];
  assert.deepEqual(filtrarAssets(todos, { busca: "árvore", perspectivaId: "topdown" }).map((a) => a.id), ["1"]);
  assert.deepEqual(filtrarAssets(todos, { busca: "arvore", perspectivaId: "isometrica" }).map((a) => a.id), ["2"]);
  assert.deepEqual(filtrarAssets(todos, { tipo: "textura" }), []); // sem tipo = sprite
  assert.equal(filtrarAssets(todos, { tipo: "sprite" }).length, 3);
});

test("reuso: oferece o asset existente no mesmo tema e perspectiva", () => {
  const todos = [
    asset({ id: "1", nome: "Carvalho antigo", tags: ["carvalho"], temaId: "t1" }),
    asset({ id: "2", nome: "Carvalho", tags: ["carvalho"], temaId: "outro" }),
    asset({ id: "3", nome: "Barril", tags: ["barril"], temaId: "t1" }),
  ];
  const r = sugerirReuso(todos, "carvalho", { temaId: "t1", perspectivaId: "topdown" });
  assert.deepEqual(r.map((s) => s.asset.id), ["1"]);
  assert.deepEqual(sugerirReuso(todos, "dragão", { temaId: "t1" }), []);
});

test("exclusão segura: em uso exige substituto", () => {
  const base = criarCenaVazia({ nome: "A", modo: "cenario", largura: 800, altura: 600 }, (() => { let n = 0; return () => `i${++n}`; })());
  const cam = base.camadas[3].id;
  const obj = (assetId: string, id: string) => ({ id, assetId, camadaId: cam, x: 0.5, y: 0.5, escala: 0.1, rotacao: 0, espelhado: false, z: 0 });
  const c1: Cena = { ...base, id: "c1", nome: "Cena 1", objetos: [obj("a1", "o1"), obj("a1", "o2")] };
  const c2: Cena = { ...base, id: "c2", nome: "Cena 2", objetos: [obj("a1", "o3")] };
  const c3: Cena = { ...base, id: "c3", nome: "Cena 3", objetos: [obj("a2", "o4")] };

  const usos = cenasQueUsam("a1", [c1, c2, c3]);
  assert.deepEqual(usos, [{ cenaId: "c1", nome: "Cena 1", objetos: 2 }, { cenaId: "c2", nome: "Cena 2", objetos: 1 }]);

  const negada = decidirExclusao("a1", usos);
  assert.equal(negada.ok, false);
  assert.match(!negada.ok ? negada.motivo : "", /Cena 1.*Cena 2/);
  assert.equal(decidirExclusao("a1", usos, "a1").ok, false); // não pode substituir por ele mesmo
  assert.equal(decidirExclusao("a1", usos, "a2").ok, true);
  assert.equal(decidirExclusao("a9", cenasQueUsam("a9", [c1, c2, c3])).ok, true);

  const nova = substituirAsset(c1, "a1", "a2");
  assert.ok(nova.objetos.every((o) => o.assetId === "a2"));
  assert.ok(c1.objetos.every((o) => o.assetId === "a1")); // original intacto
});

// ---------- Prompt ----------
test("prompt compõe tema, perspectiva, pedido e regras do tipo", () => {
  const p = comporPrompt({
    tipo: "sprite",
    descricao: "barril de madeira",
    tema: { descricao: "pintura sombria", paleta: ["#112233"], regras: ["traço fino"], proibidos: ["neon"] },
    perspectiva: obterPerspectiva("topdown"),
    corChave: CANDIDATAS[0],
    comReferencias: true,
  });
  for (const trecho of ["barril de madeira", "top-down", "pintura sombria", "traço fino", "#112233", "neon", "reference images", "No cast shadow", "magenta"]) {
    assert.ok(p.includes(trecho), `faltou: ${trecho}`);
  }
});

test("prompt: fundo de cor-chave em sprite e decal; textura pede emenda invisível", () => {
  assert.ok(comporPrompt({ tipo: "decal", descricao: "mancha", corChave: CANDIDATAS[0] }).includes("magenta"));
  const tex = comporPrompt({ tipo: "textura", descricao: "grama", corChave: CANDIDATAS[0] });
  assert.ok(!tex.includes("magenta"));
  assert.ok(/seamless/i.test(tex));
  const sem = comporPrompt({ tipo: "sprite", descricao: "baú" });
  assert.ok(!/background/.test(sem));
});

// ---------- Pipeline ----------
test("pipeline sem alfa nativo: remove o fundo, recorta e normaliza", async () => {
  const deps = depsFalsas(spriteSobreMagenta());
  const r = await executarPipeline({ tipo: "sprite", capacidades: capSemAlfa }, deps);
  assert.deepEqual(r.etapas, ["gerar", "removerFundo", "recortar", "normalizar", "salvar"]);
  // recortado ao objeto (60x40 + margem), não ao quadro original (200x120)
  assert.ok(r.largura < 80 && r.altura < 60, `${r.largura}x${r.altura}`);
});

test("pipeline com alfa nativo: pula a remoção de fundo", async () => {
  const d = new Uint8ClampedArray(100 * 100 * 4); // transparente
  for (let y = 30; y < 60; y++) for (let x = 30; x < 70; x++) d.set([10, 200, 10, 255], (y * 100 + x) * 4);
  const r = await executarPipeline({ tipo: "sprite", capacidades: capComAlfa }, depsFalsas({ data: d, width: 100, height: 100 }));
  assert.ok(!r.etapas.includes("removerFundo"));
  assert.deepEqual(r.etapas, ["gerar", "recortar", "normalizar", "salvar"]);
  assert.equal(removerFundoNecessario(capComAlfa, "sprite"), false);
  assert.equal(removerFundoNecessario(capSemAlfa, "sprite"), true);
  assert.equal(removerFundoNecessario(capSemAlfa, "decal"), true); // decal também: sem recorte vira retângulo opaco
  assert.equal(removerFundoNecessario(capSemAlfa, "textura"), false); // textura segue sem recorte
});

test("pipeline: imagem sem conteúdo falha com mensagem clara", async () => {
  const vazio = { data: new Uint8ClampedArray(40 * 40 * 4), width: 40, height: 40 };
  await assert.rejects(executarPipeline({ tipo: "sprite", capacidades: capComAlfa }, depsFalsas(vazio)), /sem conteúdo|conteúdo visível/);
});

test("pipeline de textura: normaliza para 512x512 e verifica as bordas", async () => {
  const w = 300, h = 200;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([90, 120, 60, 255], i * 4);
  const r = await executarPipeline({ tipo: "textura", capacidades: capSemAlfa }, depsFalsas({ data: d, width: w, height: h }));
  assert.deepEqual(r.etapas, ["gerar", "normalizar", "verificar", "salvar"]);
  assert.equal(r.largura, 512);
  assert.equal(r.altura, 512);
  assert.equal(r.naoRepetivel, false);
});

test("o progresso é reportado a cada etapa, em ordem crescente", async () => {
  const pcts: number[] = [];
  const deps = { ...depsFalsas(spriteSobreMagenta()), aoProgredir: (_: Etapa, p: number) => void pcts.push(p) };
  await executarPipeline({ tipo: "sprite", capacidades: capSemAlfa }, deps);
  assert.deepEqual(pcts, [...pcts].sort((a, b) => a - b));
  assert.equal(pcts.at(-1), 100);
});

// ---------- Pixels ----------
test("recortar ao conteúdo e normalizar tamanho", () => {
  const r = recortarAoConteudo(spriteSobreMagenta(), 0, 8);
  assert.ok(r); // o magenta é opaco aqui: ocupa todo o quadro
  const d = new Uint8ClampedArray(100 * 50 * 4);
  d.set([1, 2, 3, 255], (20 * 100 + 40) * 4);
  const c = recortarAoConteudo({ data: d, width: 100, height: 50 }, 1);
  assert.deepEqual([c?.width, c?.height], [3, 3]);
  assert.equal(recortarAoConteudo({ data: new Uint8ClampedArray(16), width: 2, height: 2 }), null);

  const grande = { data: new Uint8ClampedArray(1408 * 768 * 4).fill(255), width: 1408, height: 768 };
  const n = normalizarTamanho(grande, "sprite");
  assert.equal(Math.max(n.width, n.height), 512);
  assert.ok(Math.abs(n.width / n.height - 1408 / 768) < 0.01);
  const pequeno = { data: new Uint8ClampedArray(64 * 32 * 4).fill(255), width: 64, height: 32 };
  assert.equal(normalizarTamanho(pequeno, "sprite").width, 64); // não amplia
  const pinc = normalizarTamanho(grande, "pincel");
  assert.deepEqual([pinc.width, pinc.height], [1024, 256]);
});

function ruido(w: number, h: number, comEmenda: boolean): PixelsRgba {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // padrão periódico (seamless) ou rampa que não fecha (emenda)
      const v = comEmenda ? (x / (w - 1)) * 255 : 128 + 100 * Math.sin((x / w) * Math.PI * 2 * 3) * Math.cos((y / h) * Math.PI * 2 * 2);
      d.set([v, v, v, 255], (y * w + x) * 4);
    }
  return { data: d, width: w, height: h };
}

test("textura: borda contínua passa; borda descontínua é detectada, corrigida e re-medida", () => {
  const boa = ruido(128, 128, false);
  assert.ok(descontinuidade(boa) <= LIMITE_EMENDA, String(descontinuidade(boa)));
  assert.equal(verificarTextura(boa).corrigida, false);

  const ruim = ruido(128, 128, true);
  const antes = descontinuidade(ruim);
  assert.ok(antes > LIMITE_EMENDA, String(antes));
  const corrigida = corrigirCostura(ruim);
  assert.ok(descontinuidade(corrigida) < antes);
  const v = verificarTextura(ruim);
  assert.equal(v.corrigida || v.naoRepetivel, true);
  assert.equal(v.naoRepetivel, v.depois > LIMITE_EMENDA);
});

test("textura impossível de corrigir é sinalizada como não repetível", () => {
  // metade esquerda preta e direita branca: a correção melhora mas a rampa abrupta continua
  const w = 64, h = 64;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(x < w / 2 ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * w + x) * 4);
  const v = verificarTextura({ data: d, width: w, height: h }, 0.5);
  assert.equal(v.naoRepetivel, true);
});

// ---------- Variações e pedido ----------
test("variações: seeds distintas com seed; variações de prompt sem seed", () => {
  const a = planejarVariacoes(capComAlfa, 4);
  assert.equal(a.length, 4);
  assert.equal(new Set(a.map((v) => v.seed)).size, 4);
  assert.ok(a.every((v) => v.instrucao === undefined));

  const b = planejarVariacoes(capSemAlfa, 3, () => 0);
  assert.equal(b.length, 3);
  assert.equal(new Set(b.map((v) => v.instrucao)).size, 3);
  assert.ok(b.every((v) => v.seed === undefined));
  assert.equal(planejarVariacoes(capSemAlfa, 99).length, MAX_VARIACOES);
});

test("validarPedido normaliza e rejeita entradas inválidas", () => {
  const p = validarPedido({ tipo: "sprite", descricao: " Barril de madeira ", quantidade: 99, escalaBase: 50, tags: "Barril, Tonel" });
  assert.equal(p.quantidade, MAX_VARIACOES);
  assert.equal(p.escalaBase, 10);
  assert.ok(p.tags.includes("barril") && p.tags.includes("tonel") && p.tags.includes("madeira"));
  assert.equal(p.nome, "Barril de madeira");
  assert.throws(() => validarPedido({ tipo: "x", descricao: "a" }), /Tipo/);
  assert.throws(() => validarPedido({ tipo: "sprite", descricao: "  " }), /Descreva/);
});

// ---------- Ponta a ponta com provedor simulado (5.1) ----------
test("ponta a ponta: gerar -> aparece na paleta por tag -> carimbar na cena", async () => {
  const pedido = validarPedido({ tipo: "sprite", descricao: "barril de madeira", temaId: "t1", perspectivaId: "topdown" });
  const px = spriteSobreMagenta();
  const saida: ImagemBase64[] = [];
  const r = await executarPipeline(
    { tipo: pedido.tipo, capacidades: capSemAlfa },
    { ...depsFalsas(px), codificar: async (p) => { const o = { mime: "image/png", base64: `${p.width}x${p.height}` }; saida.push(o); return o; } },
  );
  assert.equal(saida.length, 1);

  const novo: Asset = {
    id: "gerado1", nome: pedido.nome, url: "https://exemplo/barril.png", largura: r.largura, altura: r.altura, origem: "ia",
    tipo: pedido.tipo, tags: pedido.tags, temaId: pedido.temaId, perspectivaId: pedido.perspectivaId, escalaBase: pedido.escalaBase, criadoEm: 1,
    geradoPor: { provedor: "simulado", modelo: "m", prompt: "p" },
  };
  const cena = criarCenaVazia({ nome: "T", modo: "grid", tipoGrid: "quadrado", colunas: 10, linhas: 10 }, (() => { let n = 0; return () => `x${++n}`; })());
  const naPaleta = filtrarAssets([novo], { busca: "barril", perspectivaId: cena.perspectiva });
  assert.deepEqual(naPaleta.map((a) => a.id), ["gerado1"]);

  const obj = { id: "o1", assetId: naPaleta[0].id, camadaId: cena.camadas[3].id, x: 0.5, y: 0.5, escala: 0.1, rotacao: 0, espelhado: false, z: 0 };
  const res = executar(cena, historicoVazio(), { tipo: "adicionarObjeto", objeto: obj });
  assert.equal(res.cena.objetos.length, 1);
  assert.equal(res.cena.objetos[0].assetId, "gerado1");
});

// ---------- Biblioteca pública ----------
test("público: IA vira pública sem tema, prompt ou vínculos; enviado nunca", async () => {
  const { paraPublico } = await import("./biblioteca.ts");
  const ia = asset({
    id: "p1", tipo: "sprite", tags: ["barril"], temaId: "tema-secreto", versaoDeId: "x",
    geradoPor: { provedor: "google-imagem", modelo: "m", prompt: "pedido privado do mestre" },
  });
  const pub = paraPublico(ia);
  const json = JSON.stringify(pub);
  assert.equal(pub.publico, true);
  assert.equal(pub.temaId, undefined);
  assert.equal(pub.versaoDeId, undefined);
  assert.ok(!json.includes("tema-secreto") && !json.includes("pedido privado"));
  assert.deepEqual(pub.tags, ["barril"]);
  assert.throws(() => paraPublico(asset({ origem: "enviado" })), /gerados por IA/);
});
