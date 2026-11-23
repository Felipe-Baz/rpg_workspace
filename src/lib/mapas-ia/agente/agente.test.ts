import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicar, desfazer, executar, historicoVazio, passosRevertidos, reverterIa, reverterPassos, type Comando } from "../../cena/comandos.ts";
import { ehMapaDeCena, patchSalvarRender } from "../../cena/compat.ts";
import { criarCenaVazia } from "../../cena/criar.ts";
import { objetoEm } from "../../cena/geometria.ts";
import { ASSET_LUZ, ASSET_ROTULO, type Asset, type Cena, type ObjetoCena } from "../../cena/tipos.ts";
import { anthropicLlm } from "../provedores/anthropic-llm.ts";
import { googleLlm } from "../provedores/google-llm.ts";
import type { ContextoProvedor, MensagemLlm, PedidoLlm, ProvedorLlm, RespostaLlm } from "../tipos.ts";
import { executarAgente, executarChamada } from "./agente.ts";
import { poissonDisco, rng } from "./aleatorio.ts";
import { resumirCena } from "./contexto.ts";
import { FERRAMENTAS, PREFIXO_PROVISORIO, ordemDesenho } from "./ferramentas.ts";
import { aplicarPasso, previa, substituirIds } from "./passos.ts";
import { validarSchema } from "./schema.ts";
import { LIMITES_PADRAO, type EstadoAgente, type Passo } from "./tipos.ts";

let n = 0;
const id = () => `id${++n}`;
const TEMA = "tema-taverna";

const asset = (p: Partial<Asset>): Asset => ({ id: "a", nome: "x", url: "u", largura: 100, altura: 100, origem: "ia", temaId: TEMA, criadoEm: 0, ...p });
const ASSETS: Asset[] = [
  asset({ id: "piso", nome: "Piso de tábuas", tipo: "textura", tags: ["piso", "madeira", "tabuas"] }),
  asset({ id: "parede", nome: "Parede de pedra", tipo: "pincel", largura: 400, altura: 100, tags: ["parede", "pedra"] }),
  asset({ id: "mesa", nome: "Mesa de madeira", tags: ["mesa", "madeira"], escalaBase: 2 }),
  asset({ id: "cadeira", nome: "Cadeira", tags: ["cadeira", "madeira"] }),
  asset({ id: "arvore", nome: "Árvore", tags: ["arvore", "carvalho"] }),
  asset({ id: "arvore-outro", nome: "Árvore estranha", tags: ["arvore"], temaId: "outro" }),
  asset({ id: "pinheiro-iso", nome: "Pinheiro", tags: ["arvore", "pinheiro"], perspectivaId: "isometrica" }),
];

const grid = (temaId: string | undefined = TEMA) => criarCenaVazia({ nome: "Taverna", modo: "grid", tipoGrid: "quadrado", colunas: 30, linhas: 20, temaId }, id, 1);
const cenario = (perspectiva = "topdown") => criarCenaVazia({ nome: "Clareira", modo: "cenario", largura: 2000, altura: 1000, perspectiva, temaId: TEMA }, id, 1);

function estado(cena: Cena, selecao: string[] = [], assets = ASSETS): EstadoAgente {
  return { cena, assets: [...assets], selecao, passos: [], buscas: [], novoId: id, totalComandos: 0 };
}
const camadaTipo = (c: Cena, tipo: string) => c.camadas.find((x) => x.tipo === tipo)!.id;
const obj = (c: Cena, p: Partial<ObjetoCena>): ObjetoCena => ({
  id: id(), assetId: "mesa", camadaId: camadaTipo(c, "objetos"), x: 0.5, y: 0.5, escala: 0.05, rotacao: 0, espelhado: false, z: 0, ...p,
});
const chamar = (e: EstadoAgente, nome: string, argumentos: Record<string, unknown>) => {
  const r = executarChamada(e, { nome, argumentos });
  return { ...r, json: JSON.parse(r.texto) };
};
const comandosDe = (e: EstadoAgente) => e.passos.flatMap((p) => p.comandos);

/** Aplica os comandos do agente numa cena e confere que o inverso volta exatamente ao início. */
function confereDesfazer(antes: Cena, comandos: Comando[]) {
  const r = aplicar(antes, { tipo: "lote", comandos });
  assert.deepEqual(aplicar(r.cena, r.inverso).cena, antes);
  return r.cena;
}

// ---------------- 1.6 Ferramentas: válido, inválido, desfazer ----------------

test("schema: rejeita tipos, obrigatórios, enum e limites", () => {
  const s = FERRAMENTAS.find((f) => f.nome === "espalhar")!.schemaArgs;
  assert.deepEqual(validarSchema(s, { assetIds: ["a"], densidade: "media" }), []);
  const erros = validarSchema(s, { assetIds: [], densidade: "absurda", semente: 1.5 });
  assert.ok(erros.some((x) => x.includes("assetIds")));
  assert.ok(erros.some((x) => x.includes("densidade")));
  assert.ok(erros.some((x) => x.includes("inteiro")));
  assert.ok(validarSchema(s, { densidade: "media" }).some((x) => x.includes("obrigatório")));
});

test("todas as ferramentas declaram schema de objeto e descrição", () => {
  const nomes = FERRAMENTAS.map((f) => f.nome);
  for (const esperado of ["buscar_asset", "colocar_objeto", "editar_objeto", "remover", "pintar_terreno", "tracar_caminho", "definir_grid", "rotular", "adicionar_luz", "espalhar", "gerar_asset"])
    assert.ok(nomes.includes(esperado), esperado);
  for (const f of FERRAMENTAS) {
    assert.equal(f.schemaArgs.type, "object");
    assert.ok(f.descricao.length > 10);
  }
});

test("buscar_asset: filtra pela perspectiva e pelo tema da cena", () => {
  const e = estado(grid());
  const r = chamar(e, "buscar_asset", { termo: "árvore" });
  assert.deepEqual(r.json.assets.map((a: { id: string }) => a.id), ["arvore"]);
  const com = chamar(e, "buscar_asset", { termo: "arvore", incluirOutrosTemas: true });
  assert.deepEqual(com.json.assets.map((a: { id: string; outroTema?: boolean }) => [a.id, !!a.outroTema]), [["arvore", false], ["arvore-outro", true]]);
  assert.equal(e.passos.length, 0, "consulta não abre passo");
});

test("colocar_objeto: produz adicionarObjeto desfazível e alinhado à célula", () => {
  const c = grid();
  const e = estado(c);
  const r = chamar(e, "colocar_objeto", { assetId: "mesa", x: 3, y: 4 });
  assert.ok(r.ok);
  const [cmd] = comandosDe(e);
  assert.equal(cmd.tipo, "adicionarObjeto");
  const o = (cmd as Extract<Comando, { tipo: "adicionarObjeto" }>).objeto;
  assert.equal(o.x, 3.5 / 30);
  assert.equal(o.y, 4.5 / 20);
  assert.equal(o.escala, 2 / 30); // escalaBase 2 células
  assert.equal(o.camadaId, camadaTipo(c, "objetos"));
  confereDesfazer(c, [cmd]);
});

test("colocar_objeto inválido: fora do canvas, asset inexistente e colisão não alteram a cena", () => {
  const c = grid();
  const e = estado(c);
  for (const args of [{ assetId: "mesa", x: 40, y: 2 }, { assetId: "nao-existe", x: 1, y: 1 }, { assetId: "mesa", x: "a", y: 1 }]) {
    const r = chamar(e, "colocar_objeto", args);
    assert.equal(r.ok, false);
    assert.ok(r.json.erro.length > 5);
  }
  assert.match(chamar(e, "colocar_objeto", { assetId: "mesa", x: 40, y: 2 }).json.erro, /fora do mapa/);
  assert.equal(e.cena, c, "cena simulada intacta");
  assert.equal(e.passos.length, 0);
  assert.ok(chamar(e, "colocar_objeto", { assetId: "mesa", x: 5, y: 5 }).ok);
  assert.match(chamar(e, "colocar_objeto", { assetId: "mesa", x: 5, y: 5 }).json.erro, /Colide/);
  assert.ok(chamar(e, "colocar_objeto", { assetId: "mesa", x: 5, y: 5, permitirSobreposicao: true }).ok);
});

test("editar_objeto e remover: só tocam nos ids pedidos e desfazem", () => {
  let c = grid();
  const a = obj(c, { x: 0.1 }), b = obj(c, { x: 0.9 });
  c = { ...c, objetos: [a, b] };
  const e = estado(c);
  assert.ok(chamar(e, "editar_objeto", { ids: [a.id], fatorTamanho: 2, rotacao: 90 }).ok);
  assert.ok(chamar(e, "remover", { ids: [b.id] }).ok);
  const depois = confereDesfazer(c, comandosDe(e));
  assert.equal(depois.objetos.length, 1);
  assert.equal(depois.objetos[0].escala, 0.1);
  assert.equal(chamar(estado(c), "editar_objeto", { ids: ["fantasma"], fatorTamanho: 2 }).ok, false);
  assert.equal(chamar(estado(c), "remover", {}).ok, false);
  assert.match(chamar(estado(c), "editar_objeto", { ids: ["selecao"], fatorTamanho: 2 }).json.erro, /selecionados/);
});

test("pintar_terreno: ladrilha a região na camada Terreno; cor sem textura muda o fundo", () => {
  const c = grid();
  const e = estado(c);
  assert.ok(chamar(e, "pintar_terreno", { assetId: "piso", regiao: { x: 0, y: 0, largura: 10, altura: 10 } }).ok);
  const cmds = comandosDe(e);
  assert.ok(cmds.length > 0 && cmds.length <= 400);
  const terreno = camadaTipo(c, "terreno");
  for (const k of cmds) {
    const o = (k as Extract<Comando, { tipo: "adicionarObjeto" }>).objeto;
    assert.equal(o.camadaId, terreno);
    assert.ok(o.x <= 10 / 30 && o.y <= 10 / 20);
  }
  confereDesfazer(c, cmds);
  const e2 = estado(c);
  assert.ok(chamar(e2, "pintar_terreno", { cor: "#336633" }).ok);
  assert.deepEqual(comandosDe(e2), [{ tipo: "definirFundo", fundo: "#336633" }]);
  assert.match(chamar(estado(c), "pintar_terreno", { assetId: "mesa" }).json.erro, /não é uma textura/);
  assert.equal(chamar(estado(c), "pintar_terreno", {}).ok, false);
});

test("tracar_caminho: peças ao longo da linha, giradas na direção do trecho", () => {
  const c = grid();
  const e = estado(c);
  assert.ok(chamar(e, "tracar_caminho", { assetId: "parede", tipo: "parede", pontos: [{ x: -0.5, y: -0.5 }, { x: 29.5, y: -0.5 }, { x: 29.5, y: 19.5 }] }).ok);
  const objs = comandosDe(e).map((k) => (k as Extract<Comando, { tipo: "adicionarObjeto" }>).objeto);
  assert.ok(objs.length > 2);
  assert.ok(objs.some((o) => Math.abs(o.rotacao) < 1e-9));
  assert.ok(objs.some((o) => Math.abs(o.rotacao - Math.PI / 2) < 1e-9));
  assert.ok(objs.every((o) => o.camadaId === camadaTipo(c, "caminhos")));
  confereDesfazer(c, comandosDe(e));
  assert.equal(chamar(estado(c), "tracar_caminho", { assetId: "parede", pontos: [{ x: 1, y: 1 }] }).ok, false);
});

test("definir_grid respeita a proporção; rotular e adicionar_luz criam objetos embutidos", () => {
  const c = cenario();
  const e = estado(c);
  assert.match(chamar(e, "definir_grid", { colunas: 20, linhas: 20 }).json.erro, /proporção/);
  assert.ok(chamar(e, "definir_grid", { colunas: 20 }).ok);
  assert.deepEqual(e.cena.grid, { tipo: "quadrado", colunas: 20, linhas: 10, noRender: true });
  assert.ok(chamar(e, "rotular", { texto: "Taverna do Javali", x: 10, y: 1 }).ok);
  assert.ok(chamar(e, "adicionar_luz", { x: 5, y: 5, raio: 3, cor: "#ffaa00" }).ok);
  const rot = e.cena.objetos.find((o) => o.assetId === ASSET_ROTULO)!;
  const luz = e.cena.objetos.find((o) => o.assetId === ASSET_LUZ)!;
  assert.equal(rot.rotulo?.texto, "Taverna do Javali");
  assert.equal(luz.luz?.cor, "#ffaa00");
  assert.ok(e.cena.camadas.some((x) => x.nome === "Luz"));
  // Embutidos são selecionáveis no editor.
  assert.equal(objetoEm(e.cena, new Map(), { x: luz.x, y: luz.y })?.id, luz.id);
  confereDesfazer(c, comandosDe(e));
  const iso = estado(cenario("isometrica"));
  assert.match(chamar(iso, "definir_grid", { colunas: 10 }).json.erro, /grid/);
});

test("espalhar: determinístico pela semente e sem sobreposição", () => {
  const c = cenario();
  const args = { assetIds: ["arvore"], densidade: "media", tamanho: 4, semente: 42, regiao: { x: 10, y: 10, largura: 60, altura: 60 } };
  const e1 = estado(c);
  const e2 = estado(c);
  n = 1000;
  assert.ok(chamar(e1, "espalhar", args).ok);
  n = 1000;
  assert.ok(chamar(e2, "espalhar", args).ok);
  const pos = (e: EstadoAgente) => e.cena.objetos.map((o) => [o.x, o.y, o.escala, o.rotacao]);
  assert.deepEqual(pos(e1), pos(e2));
  const objs = e1.cena.objetos;
  assert.ok(objs.length > 5);
  const minimo = 4 * 0.01 * c.largura * 1.8 - 1e-6;
  for (let i = 0; i < objs.length; i++)
    for (let j = i + 1; j < objs.length; j++) {
      const d = Math.hypot((objs[i].x - objs[j].x) * c.largura, (objs[i].y - objs[j].y) * c.altura);
      assert.ok(d >= minimo, `distância ${d} < ${minimo}`);
    }
  const e3 = estado(c);
  assert.ok(chamar(e3, "espalhar", { ...args, semente: 7 }).ok);
  assert.notDeepEqual(pos(e3), pos(e1));
  confereDesfazer(c, comandosDe(e1));
});

test("poisson: respeita a distância mínima e a forma", () => {
  const pts = poissonDisco(100, 100, 10, rng(1), (p) => p.x < 50);
  assert.ok(pts.length > 10);
  assert.ok(pts.every((p) => p.x < 50));
});

test("buscar antes de gerar: recusa sem busca e reutiliza o asset compatível", () => {
  const c = grid();
  const e = estado(c);
  assert.match(chamar(e, "gerar_asset", { descricao: "mesa de madeira", tipo: "sprite" }).json.erro, /buscar_asset/);
  chamar(e, "buscar_asset", { termo: "mesa" });
  const r = chamar(e, "gerar_asset", { descricao: "mesa de madeira", tipo: "sprite" });
  assert.equal(r.json.reutilizado, true);
  assert.equal(r.json.id, "mesa");
  assert.equal(e.passos.length, 0, "nenhuma geração iniciada");
  chamar(e, "buscar_asset", { termo: "lareira" });
  const g = chamar(e, "gerar_asset", { descricao: "lareira de pedra", tipo: "sprite" });
  assert.ok(g.json.id.startsWith(PREFIXO_PROVISORIO));
  assert.equal(e.passos[0].geracoes[0].pedido.temaId, TEMA);
  assert.ok(chamar(e, "colocar_objeto", { assetId: g.json.id, x: 15, y: 1 }).ok, "id provisório já pode ser usado");
});

test("consistência de estilo: asset de outro tema gera aviso no passo", () => {
  const e = estado(grid());
  assert.ok(chamar(e, "colocar_objeto", { assetId: "arvore-outro", x: 1, y: 1 }).ok);
  assert.match(e.passos[0].avisos.join(), /não pertence ao tema/);
});

test("limite de comandos por pedido", () => {
  const e = estado(grid());
  const r = executarChamada(e, { nome: "pintar_terreno", argumentos: { assetId: "piso", tamanhoLadrilho: 1 } }, { ...LIMITES_PADRAO, maxComandos: 10 });
  assert.equal(r.ok, false);
  assert.match(r.texto, /Limite/);
  assert.equal(e.totalComandos, 0);
});

// ---------------- LLM simulado ----------------

type Roteiro = (msgs: MensagemLlm[]) => RespostaLlm;

/** ProvedorLlm falso que segue um roteiro (cada rodada pode ler os resultados anteriores). */
function llmSimulado(roteiro: Roteiro[]): ProvedorLlm & { pedidos: PedidoLlm[] } {
  const pedidos: PedidoLlm[] = [];
  return {
    tipo: "llm", id: "falso", nome: "Falso", credencialId: "falso", campos: [], capacidades: { visao: false, ferramentas: true }, pedidos,
    async testar() {},
    async conversar(_ctx, p) {
      pedidos.push(structuredClone(p));
      const passo = roteiro[pedidos.length - 1];
      return passo ? passo(p.mensagens) : { texto: "Pronto.", chamadas: [] };
    },
  };
}
const ctxFalso: ContextoProvedor = { config: {}, http: async () => new Response("{}") };
let k = 0;
const ch = (nome: string, argumentos: Record<string, unknown>) => ({ id: `c${++k}`, nome, argumentos });
const ultimoResultado = (msgs: MensagemLlm[], nome: string) => JSON.parse([...msgs].reverse().find((m) => m.papel === "ferramenta" && m.resultadoDe?.nome === nome)!.texto!);

/** Roteiro da taverna, usado com o LLM simulado e com os provedores reais (HTTP falso). */
const ROTEIRO_TAVERNA: Roteiro[] = [
  () => ({ texto: "Vou montar a taverna em quatro passos.", chamadas: [ch("novo_passo", { titulo: "Piso" }), ch("buscar_asset", { termo: "piso de madeira" }), ch("pintar_terreno", { assetId: "piso" })] }),
  () => ({
    texto: "",
    chamadas: [
      ch("novo_passo", { titulo: "Paredes" }),
      ch("tracar_caminho", { assetId: "parede", tipo: "parede", pontos: [{ x: -0.5, y: -0.5 }, { x: 29.5, y: -0.5 }, { x: 29.5, y: 19.5 }, { x: -0.5, y: 19.5 }, { x: -0.5, y: -0.5 }] }),
    ],
  }),
  () => ({ texto: "", chamadas: [ch("novo_passo", { titulo: "Lareira" }), ch("buscar_asset", { termo: "lareira" }), ch("gerar_asset", { descricao: "lareira de pedra", tipo: "sprite", tamanhoSugerido: 3 })] }),
  (msgs) => ({ texto: "", chamadas: [ch("colocar_objeto", { assetId: ultimoResultado(msgs, "gerar_asset").id, x: 15, y: 1 }), ch("adicionar_luz", { x: 15, y: 2, raio: 4 })] }),
  () => ({
    texto: "",
    chamadas: [
      ch("novo_passo", { titulo: "Mobília" }),
      ch("colocar_objeto", { assetId: "mesa", x: 5, y: 15 }),
      ch("colocar_objeto", { assetId: "mesa", x: 9, y: 15 }),
      ch("colocar_objeto", { assetId: "mesa", x: 5, y: 8 }),
      ch("colocar_objeto", { assetId: "cadeira", x: 4, y: 15 }),
      ch("rotular", { texto: "Taverna", x: 15, y: 10 }),
    ],
  }),
  () => ({ texto: "Taverna 30x20 com piso, paredes, lareira acesa e mesas.", chamadas: [] }),
];

/** Simula as gerações confirmadas: cada id provisório vira um asset real. */
function concluirGeracoes(passos: Passo[], assets: Asset[]) {
  const mapa: Record<string, string> = {};
  for (const p of passos)
    for (const g of p.geracoes) {
      const real = asset({ id: `real-${g.idProvisorio}`, nome: g.pedido.nome, temaId: g.pedido.temaId, perspectivaId: g.pedido.perspectivaId });
      assets.push(real);
      mapa[g.idProvisorio] = real.id;
    }
  return passos.map((p) => ({ ...p, comandos: substituirIds(p.comandos, mapa, (x) => x.startsWith(PREFIXO_PROVISORIO)) }));
}

function verificarTaverna(cena0: Cena, plano: Awaited<ReturnType<typeof executarAgente>>) {
  assert.deepEqual(plano.passos.map((p) => p.titulo), ["Piso", "Paredes", "Lareira", "Mobília"]);
  assert.equal(plano.passos[2].geracoes.length, 1);
  const assets = [...ASSETS];
  const passos = concluirGeracoes(plano.passos, assets);
  let cena = cena0;
  let h = historicoVazio();
  for (const p of passos) {
    const r = aplicarPasso(cena, h, p);
    assert.equal(r.ignorados, 0);
    ({ cena, historico: h } = r);
  }
  assert.deepEqual(cena.grid, { tipo: "quadrado", colunas: 30, linhas: 20, noRender: true });
  assert.equal(h.passado.length, 4, "um grupo de undo por passo");
  assert.ok(h.passado.every((e) => e.meta.autor === "ia"));
  const porId = new Map(assets.map((a) => [a.id, a]));
  for (const o of cena.objetos) {
    assert.ok(o.assetId.startsWith("@") || porId.has(o.assetId), `asset existente: ${o.assetId}`);
    if (!o.assetId.startsWith("@")) assert.equal(porId.get(o.assetId)!.temaId, TEMA, "no tema da mesa");
    assert.ok(o.x >= 0 && o.x <= 1 && o.y >= 0 && o.y <= 1);
  }
  // Mobília e lareira (camada Objetos) no centro das células.
  const objetos = cena.objetos.filter((o) => o.camadaId === camadaTipo(cena, "objetos"));
  assert.equal(objetos.length, 5);
  for (const o of objetos) {
    assert.ok(Math.abs(((o.x * 30 - 0.5) % 1)) < 1e-9, "coluna inteira");
    assert.ok(Math.abs(((o.y * 20 - 0.5) % 1)) < 1e-9, "linha inteira");
  }
  assert.ok(cena.objetos.some((o) => o.camadaId === camadaTipo(cena, "caminhos")), "paredes");
  assert.ok(cena.objetos.some((o) => o.assetId === ASSET_LUZ), "luz da lareira");
  return { cena, h };
}

// ---------------- 5.1 Taverna 30x20 ----------------

test("5.1 LLM simulado: taverna 30x20 gera cena válida, em passos, no tema e alinhada ao grid", async () => {
  const cena0 = grid();
  const llm = llmSimulado(ROTEIRO_TAVERNA);
  const eventos: string[] = [];
  const plano = await executarAgente(
    { llm, ctx: ctxFalso, novoId: id, emitir: (ev) => eventos.push(ev.tipo) },
    { pedido: "taverna de beira de estrada, 30x20, com lareira", cena: cena0, assets: ASSETS, selecao: [] },
  );
  verificarTaverna(cena0, plano);
  assert.equal(eventos.filter((x) => x === "passo").length, 4, "passos emitidos em streaming");
  assert.ok(eventos.includes("texto"));
  // O LLM recebeu o resumo da cena e as ferramentas neutras; nada de URLs/chaves.
  const primeiro = llm.pedidos[0];
  assert.match(primeiro.mensagens[0].texto!, /grid quadrado 30x20/);
  assert.equal(primeiro.ferramentas?.length, FERRAMENTAS.length);
  assert.doesNotMatch(JSON.stringify(llm.pedidos), /"url"/);
});

// ---------------- 5.2 "deixe maior" ----------------

test("5.2 'deixe maior' altera só a seleção", async () => {
  let cena = grid();
  const arvore = obj(cena, { assetId: "arvore", x: 0.3 }), outra = obj(cena, { assetId: "arvore", x: 0.7 }), mesa = obj(cena, { y: 0.8 });
  cena = { ...cena, objetos: [arvore, outra, mesa] };
  const llm = llmSimulado([() => ({ texto: "", chamadas: [ch("editar_objeto", { ids: ["selecao"], fatorTamanho: 1.5 })] })]);
  const plano = await executarAgente({ llm, ctx: ctxFalso, novoId: id }, { pedido: "deixe maior", cena, assets: ASSETS, selecao: [arvore.id] });
  assert.match(llm.pedidos[0].mensagens[0].texto!, new RegExp(`Seleção atual[^]*${arvore.id}`));
  const depois = previa(cena, plano.passos);
  assert.equal(depois.objetos[0].escala, arvore.escala * 1.5);
  assert.deepEqual(depois.objetos.slice(1), [outra, mesa]);
  assert.deepEqual({ ...depois.objetos[0], escala: arvore.escala }, arvore);
});

// ---------------- 5.3 Remover mesas do canto ----------------

test("5.3 'tire as mesas do canto sul' remove só as mesas daquela região", async () => {
  let cena = grid();
  const ladoA = (x: number, y: number, assetId = "mesa") => obj(cena, { assetId, x: (x + 0.5) / 30, y: (y + 0.5) / 20 });
  const mesasSul = [ladoA(2, 18), ladoA(5, 17)];
  const resto = [ladoA(2, 3), ladoA(20, 5), ladoA(3, 18, "cadeira"), ladoA(25, 10)];
  cena = { ...cena, objetos: [...resto.slice(0, 2), ...mesasSul, ...resto.slice(2)] };
  const llm = llmSimulado([() => ({ texto: "", chamadas: [ch("remover", { busca: "mesa", regiao: { x: 0, y: 15, largura: 30, altura: 5 } })] })]);
  const plano = await executarAgente({ llm, ctx: ctxFalso, novoId: id }, { pedido: "tire as mesas do canto sul", cena, assets: ASSETS, selecao: [] });
  const depois = previa(cena, plano.passos);
  assert.deepEqual(depois.objetos, resto, "resto da cena idêntico");
  assert.deepEqual({ ...depois, objetos: [] }, { ...cena, objetos: [] });
});

// ---------------- 5.3b Dois LLMs reais sem mudar o agente ----------------

/** Converte o roteiro neutro no formato HTTP de cada fabricante. O id provisório é lido do corpo enviado (formato do fabricante). */
function httpFalso(formato: "anthropic" | "google", roteiro: Roteiro[]) {
  let i = 0;
  const corpos: string[] = [];
  const http = async (_url: string, init?: RequestInit) => {
    const corpo = String(init?.body);
    corpos.push(corpo);
    const gerado = corpo.match(/pendente-[A-Za-z0-9-]+/g)?.at(-1);
    const msgs: MensagemLlm[] = gerado ? [{ papel: "ferramenta", resultadoDe: { id: "", nome: "gerar_asset" }, texto: JSON.stringify({ id: gerado }) }] : [];
    const r = roteiro[i++]?.(msgs) ?? { texto: "Pronto.", chamadas: [] };
    const json =
      formato === "anthropic"
        ? { content: [...(r.texto ? [{ type: "text", text: r.texto }] : []), ...r.chamadas.map((c) => ({ type: "tool_use", id: c.id, name: c.nome, input: c.argumentos }))] }
        : { candidates: [{ content: { parts: [...(r.texto ? [{ text: r.texto }] : []), ...r.chamadas.map((c) => ({ functionCall: { id: c.id, name: c.nome, args: c.argumentos } }))] } }] };
    return new Response(JSON.stringify(json), { status: 200 });
  };
  return { http, corpos };
}

test("5.3b o mesmo agente funciona com Google e Anthropic, sem mudar o código do agente", async () => {
  for (const [llm, formato] of [[googleLlm, "google"], [anthropicLlm, "anthropic"]] as const) {
    const { http, corpos } = httpFalso(formato, ROTEIRO_TAVERNA);
    const cena0 = grid();
    const plano = await executarAgente(
      { llm, ctx: { config: { apiKey: "chave-de-teste-123" }, http }, novoId: id },
      { pedido: "taverna 30x20 com lareira", cena: cena0, assets: ASSETS, selecao: [] },
    );
    verificarTaverna(cena0, plano);
    assert.equal(corpos.length, ROTEIRO_TAVERNA.length, formato);
    assert.match(corpos[0], /pintar_terreno/, `${formato}: ferramentas enviadas no formato do fabricante`);
    assert.ok(corpos.every((c) => !c.includes("chave-de-teste-123")), "a chave nunca vai no corpo");
    // Os 3 resultados da 1ª rodada voltam juntos, num único turno (exigência dos dois fabricantes).
    const segundo = JSON.parse(corpos[1]);
    const turnos = formato === "anthropic" ? segundo.messages : segundo.contents;
    const ultimo = turnos.at(-1);
    const partes = formato === "anthropic" ? ultimo.content.filter((x: { type: string }) => x.type === "tool_result") : ultimo.parts.filter((x: object) => "functionResponse" in x);
    assert.equal(partes.length, 3, formato);
  }
});

// ---------------- Passos: reverter e autoria ----------------

test("reverter o passo 2 de 3 desfaz só ele; reverter a IA preserva o que foi feito à mão", async () => {
  const cena0 = grid();
  const plano = await executarAgente(
    {
      llm: llmSimulado([
        () => ({
          texto: "",
          chamadas: [
            ch("novo_passo", { titulo: "A" }), ch("colocar_objeto", { assetId: "mesa", x: 2, y: 2 }),
            ch("novo_passo", { titulo: "B" }), ch("colocar_objeto", { assetId: "mesa", x: 10, y: 10 }),
            ch("novo_passo", { titulo: "C" }), ch("colocar_objeto", { assetId: "mesa", x: 20, y: 15 }),
          ],
        }),
      ]),
      ctx: ctxFalso,
      novoId: id,
    },
    { pedido: "três mesas", cena: cena0, assets: ASSETS, selecao: [] },
  );
  let cena = cena0;
  let h = historicoVazio();
  for (const p of plano.passos) ({ cena, historico: h } = aplicarPasso(cena, h, p));
  const [a, b, c] = cena.objetos;
  // Edição manual depois da IA.
  const manual = obj(cena, { assetId: "cadeira", x: 0.4, y: 0.4 });
  ({ cena, historico: h } = executar(cena, h, { tipo: "adicionarObjeto", objeto: manual }));

  const r2 = reverterPassos(cena, h, [plano.passos[1].id]);
  assert.deepEqual(r2.cena.objetos.map((o) => o.id), [a.id, c.id, manual.id]);
  assert.ok(passosRevertidos(r2.historico).has(plano.passos[1].id));
  // Desfazer a reversão traz o passo de volta.
  const volta = desfazer(r2.cena, r2.historico);
  assert.deepEqual(volta.cena.objetos.map((o) => o.id), [a.id, b.id, c.id, manual.id]);

  const ia = reverterIa(cena, h);
  assert.deepEqual(ia.cena.objetos, [manual], "só os comandos da IA são desfeitos");
  assert.equal(ia.historico.passado.at(-1)!.meta.reverte!.length, 3);
});

test("reverter passo tolera objetos já removidos à mão", () => {
  let cena = grid();
  let h = historicoVazio();
  const o = obj(cena, {});
  ({ cena, historico: h } = aplicarPasso(cena, h, { id: "p1", titulo: "T", resumo: [], comandos: [{ tipo: "adicionarObjeto", objeto: o }] }));
  ({ cena, historico: h } = executar(cena, h, { tipo: "removerObjeto", id: o.id }));
  const r = reverterPassos(cena, h, ["p1"]);
  assert.equal(r.ignorados, 1);
  assert.equal(r.cena.objetos.length, 0);
});

// ---------------- 4.2 Cenário isométrico ----------------

test("4.2 clareira isométrica: só assets isométricos, sem rotação, ordenados por Y", async () => {
  const cena0 = cenario("isometrica");
  const e = estado(cena0);
  const busca = chamar(e, "buscar_asset", { termo: "arvore" });
  assert.deepEqual(busca.json.assets.map((a: { id: string }) => a.id), ["pinheiro-iso"]);
  assert.ok(chamar(e, "espalhar", { assetIds: ["pinheiro-iso"], densidade: "alta", tamanho: 5, girar: true, semente: 3 }).ok);
  const objs = e.cena.objetos;
  assert.ok(objs.length > 5);
  assert.ok(objs.every((o) => o.rotacao === 0 && o.z === 0));
  const ordem = ordemDesenho(e.cena).map((oid) => objs.find((o) => o.id === oid)!.y);
  assert.deepEqual(ordem, [...ordem].sort((x, y) => x - y), "quem está mais abaixo desenha por último (na frente)");
  assert.match(resumirCena(cena0, ASSETS, []), /Ordenação isométrica/);
});

// ---------------- 5.4 Mapa gerado continua compatível ----------------

test("5.4 mapa gerado por IA continua com coberturas, revelar e pinos", async () => {
  const cena0 = grid();
  const plano = await executarAgente({ llm: llmSimulado(ROTEIRO_TAVERNA), ctx: ctxFalso, novoId: id }, { pedido: "taverna", cena: cena0, assets: ASSETS, selecao: [] });
  const { cena } = verificarTaverna(cena0, plano);
  const mapa = { id: "m1", origem: "cena" as const, cenaId: cena.id, imagem: "antiga.jpg", coberturas: [{ id: "c1" }], pinos: [{ id: "p" }], liberado: true };
  assert.ok(ehMapaDeCena(mapa));
  const salvo = { ...mapa, ...patchSalvarRender("nova.jpg") };
  assert.deepEqual({ ...salvo, imagem: mapa.imagem }, mapa, "só a imagem muda ao salvar");
  // A cena é serializável (vai para o Firestore/Storage).
  assert.deepEqual(JSON.parse(JSON.stringify(cena)), cena);
});
