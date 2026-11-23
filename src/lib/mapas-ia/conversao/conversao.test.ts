import { test } from "node:test";
import assert from "node:assert/strict";
import type { Asset, Cena } from "../../cena/tipos.ts";
import { aplicar } from "../../cena/comandos.ts";
import type { PixelsRgba } from "../fundo.ts";
import { ErroProvedor } from "../tipos.ts";
import { interpretarSegmentos } from "../provedores/google-segmentacao.ts";
import {
  AVISO_SEM_INPAINTING,
  COR_BURACO,
  MAX_OBJETOS_CONVERSAO,
  converterMapa,
  copiarPinos,
  dividirSegmento,
  estimarConversao,
  juntarSegmentos,
  mascaraDe,
  prepararRevisao,
  validarPedidoConversao,
  type DepsConversao,
  type MapaOrigem,
  type NovoMapa,
  type PedidoConversao,
} from "./conversao.ts";
import { area, codificarRle, decodificarRle, dividir, mascaraDoSegmento, mascaraVazia, unir, type Mascara } from "./mascaras.ts";

// ---------- Cenário sintético: piso cinza com dois objetos ----------
const W = 40, H = 30;
const PISO = [100, 100, 100];
const VERMELHO = [200, 30, 30];
const AZUL = [30, 30, 200];
const retVermelho = { x0: 10, y0: 10, x1: 18, y1: 18 }; // [x0, x1)
const retAzul = { x0: 25, y0: 4, x1: 32, y1: 11 };

const dentro = (r: typeof retVermelho, x: number, y: number) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;

function mapaSintetico(): PixelsRgba {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) d.set([...(dentro(retVermelho, x, y) ? VERMELHO : dentro(retAzul, x, y) ? AZUL : PISO), 255], (y * W + x) * 4);
  return { data: d, width: W, height: H };
}

function mascaraRet(r: typeof retVermelho, w = W, h = H): Mascara {
  const m = mascaraVazia(w, h);
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) m.bits[y * w + x] = 1;
  return m;
}

const cor = (px: PixelsRgba, x: number, y: number) => Array.from(px.data.slice((y * px.width + x) * 4, (y * px.width + x) * 4 + 3));

const mapaOrigem = (): MapaOrigem & { imagem: string; todos: boolean; liberadoPara: string[] } => ({
  id: "orig",
  nome: "Taverna",
  imagem: "https://exemplo/mapa.jpg",
  todos: true,
  liberadoPara: ["j1"],
  zonas: [{ id: "z1", nome: "Salão" }, { id: "z2", nome: "Cozinha" }, { id: "z3", nome: "Porão" }],
  cobertas: [
    { id: "c1", zonaId: "z1", pontos: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }], revelada: false },
    { id: "c2", zonaId: "z2", pontos: [{ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.9, y: 0.9 }], revelada: true },
    { id: "c3", zonaId: "z3", pontos: [{ x: 0.6, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.3 }], revelada: false },
  ],
});

const pedido = (objetos = [{ nome: "Mesa", m: mascaraRet(retVermelho) }, { nome: "Baú", m: mascaraRet(retAzul) }]): PedidoConversao => ({
  mapaId: "orig",
  colecao: "mapas",
  largura: W,
  altura: H,
  objetos: objetos.map((o) => ({ nome: o.nome, rle: codificarRle(o.m), incompleto: false })),
});

/** "Inpainting" falso: troca o magenta pelo piso (o que um bom provedor faria). */
const inpaintPiso = async (img: PixelsRgba): Promise<PixelsRgba> => {
  const d = new Uint8ClampedArray(img.data);
  for (let i = 0; i < d.length; i += 4)
    if (d[i] === COR_BURACO[0] && d[i + 1] === COR_BURACO[1] && d[i + 2] === COR_BURACO[2]) d.set([...PISO, 255], i);
  return { ...img, data: d };
};

/** Banco em memória que registra a ordem das escritas e desfaz o que for apagado. */
function depsFalsas(extra: Partial<DepsConversao> = {}) {
  let n = 0;
  const log: string[] = [];
  const arquivos = new Map<string, { px: PixelsRgba; uso: string }>();
  const assets = new Map<string, Asset>();
  const cenas = new Map<string, Cena>();
  const pinos = new Set<string>();
  const mapas = new Map<string, NovoMapa>();
  const deps: DepsConversao = {
    editar: inpaintPiso,
    registrarUso: async () => void log.push("uso"),
    salvarImagem: async (px, uso) => {
      const caminho = `arq${n++}`;
      arquivos.set(caminho, { px, uso });
      log.push(`arquivo:${uso}`);
      return { url: `https://x/${caminho}`, caminho };
    },
    copiarImagemDoMapa: async () => {
      arquivos.set("copia", { px: { data: new Uint8ClampedArray(4), width: 1, height: 1 }, uso: "mapa" });
      log.push("arquivo:mapa");
      return { url: "https://x/copia", caminho: "copia" };
    },
    apagarArquivo: async (c) => void arquivos.delete(c),
    gravarAsset: async (a) => void (assets.set(a.id, a), log.push("asset")),
    apagarAsset: async (id) => void assets.delete(id),
    gravarCena: async (c) => void (cenas.set(c.id, c), log.push("cena")),
    apagarCena: async (id) => void cenas.delete(id),
    copiarPinos: async (_de, para) => void (pinos.add(para), log.push("pinos")),
    apagarPinos: async (para) => void pinos.delete(para),
    gravarMapa: async (m) => void (mapas.set(m.id, m), log.push("mapa")),
    novoId: () => `id${n++}`,
    agora: () => 1000,
    ...extra,
  };
  return { deps, log, arquivos, assets, cenas, pinos, mapas };
}

// ---------- Máscaras ----------
test("máscaras: RLE ida e volta, união e divisão", () => {
  const a = mascaraRet(retVermelho), b = mascaraRet(retAzul);
  const rle = codificarRle(a);
  assert.deepEqual(decodificarRle(rle, W, H).bits, a.bits);
  assert.throws(() => decodificarRle([5], W, H), /inválida/);
  const u = unir(a, b);
  assert.equal(area(u), area(a) + area(b));
  // Dois componentes separados viram duas partes; um só vira duas metades.
  assert.equal(dividir(u).length, 2);
  const metades = dividir(a);
  assert.equal(metades.length, 2);
  assert.equal(area(metades[0]) + area(metades[1]), area(a));
});

test("máscara do segmento: usa a máscara cinza dentro da caixa (ou a caixa inteira)", () => {
  const cinza: PixelsRgba = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), width: 2, height: 1 }; // metade esquerda
  const m = mascaraDoSegmento(10, 10, { x0: 0, y0: 0, x1: 1, y1: 1 }, cinza);
  assert.equal(area(m), 50);
  assert.equal(m.bits[0], 1);
  assert.equal(m.bits[9], 0);
  assert.equal(area(mascaraDoSegmento(10, 10, { x0: 0.2, y0: 0.2, x1: 0.5, y1: 0.5 })), 9);
});

test("segmentador Gemini: interpreta caixas 0–1000 e máscaras data URI, ignora entradas inválidas", () => {
  const texto = '```json\n[{"box_2d":[100,200,500,600],"mask":"data:image/png;base64,QUJD","label":"mesa"},{"box_2d":[1,2]},{"box_2d":[500,500,100,100],"label":"x"},{"box_2d":[0,0,1000,1000]}]\n```';
  const s = interpretarSegmentos(texto);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].caixa, { x0: 0.2, y0: 0.1, x1: 0.6, y1: 0.5 });
  assert.deepEqual(s[0].mascara, { mime: "image/png", base64: "QUJD" });
  assert.equal(s[0].rotulo, "mesa");
  assert.equal(s[1].rotulo, "objeto");
  assert.equal(s[1].mascara, undefined);
  assert.throws(() => interpretarSegmentos("nada aqui"), ErroProvedor);
});

// ---------- Revisão ----------
test("revisão: descarta ruído e fundo, aceita até o limite, marca incompletos; juntar e dividir", () => {
  let k = 0;
  const id = () => `s${k++}`;
  const borda = mascaraRet({ x0: 0, y0: 20, x1: 6, y1: 26 }); // encosta na borda esquerda
  const ruido = mascaraRet({ x0: 35, y0: 25, x1: 35, y1: 25 }); // vazia
  const fundo = mascaraRet({ x0: 0, y0: 0, x1: 40, y1: 30 }); // a imagem toda
  const rev = prepararRevisao(W, H, [
    { rotulo: "mesa", mascara: mascaraRet(retVermelho) },
    { rotulo: "baú", mascara: mascaraRet(retAzul) },
    { rotulo: "barril", mascara: borda },
    { rotulo: "ruído", mascara: ruido },
    { rotulo: "chão", mascara: fundo },
  ], id, 2);
  assert.deepEqual(rev.segmentos.map((s) => s.nome), ["mesa", "baú", "barril"]); // por área, sem ruído nem fundo
  assert.deepEqual(rev.segmentos.map((s) => s.aceito), [true, true, false]); // limite 2: o mestre escolhe os demais
  assert.deepEqual(rev.segmentos.map((s) => s.incompleto), [false, false, true]);

  const junto = juntarSegmentos(rev, [rev.segmentos[0].id, rev.segmentos[1].id], id);
  assert.equal(junto.segmentos.length, 2);
  assert.equal(junto.segmentos[0].nome, "mesa");
  assert.equal(area(mascaraDe(junto, junto.segmentos[0])), 64 + 49);

  const separado = dividirSegmento(junto, junto.segmentos[0].id, id);
  assert.deepEqual(separado.segmentos.map((s) => s.nome), ["mesa 1", "mesa 2", "barril"]);
});

test("estimativa: uma geração a cada 4 objetos; sem inpainting não custa imagem; limite de objetos", () => {
  assert.deepEqual(estimarConversao(5, true), { objetos: 5, geracoes: 2, excedeLimite: false, parcial: false });
  assert.equal(estimarConversao(5, false).geracoes, 0);
  assert.equal(estimarConversao(MAX_OBJETOS_CONVERSAO + 1, true).excedeLimite, true);
});

test("pedido: valida tamanho, limite e máscaras vazias", () => {
  const ok = validarPedidoConversao(pedido());
  assert.equal(ok.objetos.length, 2);
  assert.throws(() => validarPedidoConversao({ ...pedido(), objetos: [] }), /ao menos um/);
  const muitos = Array.from({ length: MAX_OBJETOS_CONVERSAO + 1 }, () => pedido().objetos[0]);
  assert.throws(() => validarPedidoConversao({ ...pedido(), objetos: muitos }), /No máximo/);
  assert.throws(() => validarPedidoConversao({ ...pedido(), objetos: [{ nome: "x", rle: [W * H] }] }), /vazio/);
  assert.throws(() => validarPedidoConversao({ ...pedido(), largura: 5000 }), /Tamanho/);
});

// ---------- 5.1 Conversão preserva coberturas e o original ----------
test("5.1 converter mapa com coberturas: novo mapa de cena com as mesmas zonas/coberturas; original intacto", async () => {
  const mapa = mapaOrigem();
  const antesMapa = JSON.stringify(mapa);
  const original = mapaSintetico();
  const antesPx = Buffer.from(original.data).toString("base64");
  const f = depsFalsas();

  const r = await converterMapa({ mapa, original, pedido: pedido() }, f.deps);

  // Um NOVO mapa de cena, ligado à cena criada, não liberado a ninguém.
  const novo = f.mapas.get(r.mapaId)!;
  assert.notEqual(novo.id, mapa.id);
  assert.equal(novo.origem, "cena");
  assert.equal(novo.cenaId, r.cenaId);
  assert.ok(f.cenas.has(r.cenaId));
  assert.equal(novo.todos, false);
  assert.deepEqual(novo.liberadoPara, []);
  // Mesmas zonas e coberturas, nas mesmas frações, sem compartilhar referência.
  assert.deepEqual(novo.zonas, mapa.zonas);
  assert.deepEqual(novo.cobertas, mapa.cobertas);
  novo.cobertas![0].pontos[0].x = 0.99;
  assert.equal(mapa.cobertas![0].pontos[0].x, 0.1);
  novo.cobertas![0].pontos[0].x = 0.1;
  // A imagem do novo mapa é uma cópia, nunca o arquivo do original.
  assert.equal(novo.imagem, "https://x/copia");
  // Original: documento e pixels sem nenhuma mudança.
  assert.equal(JSON.stringify(mapa), antesMapa);
  assert.equal(Buffer.from(original.data).toString("base64"), antesPx);
  // Pinos copiados para o novo mapa; o mapa novo é a ÚLTIMA escrita.
  assert.ok(f.pinos.has(r.mapaId));
  assert.equal(f.log[f.log.length - 1], "mapa");
  // Objetos viraram assets da mesa (reutilizáveis), com o fundo; nada vai à biblioteca pública.
  assert.equal(r.assetIds.length, 3);
  for (const id of r.assetIds) {
    const a = f.assets.get(id)!;
    assert.equal(a.convertidoDe, "orig");
    assert.ok(!a.publico);
    assert.ok(a.tags?.includes("convertido"));
  }
  assert.deepEqual(r.assetIds.slice(1).map((id) => f.assets.get(id)!.nome), ["Mesa", "Baú"]);
  assert.equal(r.parcial, false);
  assert.equal(f.log.filter((x) => x === "uso").length, 1); // 2 objetos = 1 lote de inpainting
});

test("5.1 pinos e notas dos jogadores são copiados para o novo mapa", () => {
  const doc = { porMapa: { orig: [{ id: "p", x: 0.3, y: 0.4, titulo: "Alçapão", texto: "" }], outro: [] }, notas: { orig: "cheiro de enxofre" } };
  const c = copiarPinos(doc, "orig")!;
  assert.deepEqual(c.pinos, doc.porMapa.orig);
  assert.notEqual(c.pinos, doc.porMapa.orig);
  assert.equal(c.nota, "cheiro de enxofre");
  assert.equal(copiarPinos(doc, "outro"), null);
});

// ---------- 5.2 Mover objeto convertido não deixa buraco ----------
test("5.2 mover objeto convertido: o lugar de origem mostra o fundo reconstruído", async () => {
  const f = depsFalsas();
  const original = mapaSintetico();
  const r = await converterMapa({ mapa: mapaOrigem(), original, pedido: pedido() }, f.deps);
  const fundo = [...f.arquivos.values()].find((a) => a.uso === "fundo")!.px;
  const cena = f.cenas.get(r.cenaId)!;

  // Fundo na camada de terreno (travada), objetos na camada de objetos, na posição original.
  const terreno = cena.camadas.find((c) => c.tipo === "terreno")!;
  assert.equal(terreno.travada, true);
  const objFundo = cena.objetos.find((o) => o.camadaId === terreno.id)!;
  assert.deepEqual([objFundo.x, objFundo.y, objFundo.escala], [0.5, 0.5, 1]);
  const mesaId = r.assetIds[1];
  const mesa = cena.objetos.find((o) => o.assetId === mesaId)!;
  assert.ok(Math.abs(mesa.x - (retVermelho.x0 + retVermelho.x1) / 2 / W) < 0.02);
  assert.ok(Math.abs(mesa.escala - (retVermelho.x1 - retVermelho.x0) / W) < 0.06);

  // Move a mesa para longe: onde ela estava, o fundo é piso (nem a mesa, nem o magenta do buraco).
  const movida = aplicar(cena, { tipo: "atualizarObjeto", id: mesa.id, patch: { x: 0.9, y: 0.9 } }).cena;
  assert.notEqual(movida.objetos.find((o) => o.id === mesa.id)!.x, mesa.x);
  for (let y = retVermelho.y0; y < retVermelho.y1; y++)
    for (let x = retVermelho.x0; x < retVermelho.x1; x++) assert.deepEqual(cor(fundo, x, y), PISO, `buraco em ${x},${y}`);
  // Fora dos objetos, o fundo é o original pixel a pixel.
  assert.deepEqual(cor(fundo, 2, 2), cor(original, 2, 2));
  // O sprite tem a mesa opaca e transparência fora dela.
  const sprite = [...f.arquivos.values()].filter((a) => a.uso === "sprite")[0].px;
  const meio = (Math.floor(sprite.height / 2) * sprite.width + Math.floor(sprite.width / 2)) * 4;
  assert.deepEqual(Array.from(sprite.data.slice(meio, meio + 4)), [...VERMELHO, 255]);
});

test("5.2 sem inpainting: conversão parcial com aviso, e o objeto continua no fundo", async () => {
  const f = depsFalsas({ editar: undefined });
  const r = await converterMapa({ mapa: mapaOrigem(), original: mapaSintetico(), pedido: pedido() }, f.deps);
  assert.equal(r.parcial, true);
  assert.ok(r.avisos.includes(AVISO_SEM_INPAINTING));
  const fundo = [...f.arquivos.values()].find((a) => a.uso === "fundo")!.px;
  assert.deepEqual(cor(fundo, 12, 12), VERMELHO);
  assert.equal(f.log.filter((x) => x === "uso").length, 0);
  assert.ok(f.mapas.has(r.mapaId));
});

// ---------- 5.3 Falha no meio não publica mapa parcial ----------
test("5.3 inpainting falha: nenhuma escrita, nenhum mapa, original igual", async () => {
  const mapa = mapaOrigem();
  const antes = JSON.stringify(mapa);
  const original = mapaSintetico();
  const muitos = Array.from({ length: 6 }, (_, i) => ({ nome: `o${i}`, m: mascaraRet({ x0: i * 6, y0: 20, x1: i * 6 + 4, y1: 24 }) }));
  let chamadas = 0;
  const f = depsFalsas({
    editar: async (img) => {
      if (++chamadas === 2) throw new ErroProvedor("Provedor respondeu 500: erro");
      return inpaintPiso(img);
    },
  });
  await assert.rejects(converterMapa({ mapa, original, pedido: pedido(muitos) }, f.deps), /500/);
  assert.equal(f.mapas.size, 0);
  assert.equal(f.assets.size + f.cenas.size + f.pinos.size + f.arquivos.size, 0);
  assert.equal(JSON.stringify(mapa), antes);
});

test("5.3 provedor devolve o buraco sem preencher: falha, sem mapa", async () => {
  const f = depsFalsas({ editar: async (img) => img });
  await assert.rejects(converterMapa({ mapa: mapaOrigem(), original: mapaSintetico(), pedido: pedido() }, f.deps), /não reconstruiu/);
  assert.equal(f.mapas.size, 0);
  assert.equal(f.log.filter((x) => x === "uso").length, 0); // falha não conta
});

test("5.3 falha depois das primeiras escritas: tudo é desfeito e o mapa não é publicado", async () => {
  for (const ponto of ["gravarCena", "copiarPinos", "gravarMapa"] as const) {
    const f = depsFalsas();
    f.deps[ponto] = async () => {
      throw new Error(`falha em ${ponto}`);
    };
    await assert.rejects(converterMapa({ mapa: mapaOrigem(), original: mapaSintetico(), pedido: pedido() }, f.deps), new RegExp(ponto));
    assert.equal(f.mapas.size, 0, ponto);
    assert.equal(f.assets.size, 0, ponto);
    assert.equal(f.cenas.size, 0, ponto);
    assert.equal(f.pinos.size, 0, ponto);
    assert.equal(f.arquivos.size, 0, ponto);
  }
});
