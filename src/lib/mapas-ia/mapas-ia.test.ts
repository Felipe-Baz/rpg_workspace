/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de APIs externas */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PROVEDORES, descreverProvedor, provedoresImagem, provedoresLlm } from "./registro.ts";
import { ErroProvedor, type ContextoProvedor, type FerramentaNeutra, type HttpFn, type ProvedorImagem } from "./tipos.ts";
import { googleImagem } from "./provedores/google-imagem.ts";
import { googleLlm } from "./provedores/google-llm.ts";
import { anthropicLlm } from "./provedores/anthropic-llm.ts";
import { planejarGeracao, verificarLlm } from "./orquestrador.ts";
import { CORES_CHAVE, RemovedorFundoChroma, escolherCorChave, detectarCorFundo, type PixelsRgba } from "./fundo.ts";
import { estimarLote, verificarTeto, periodoDe } from "./limites.ts";
import { CANDIDATAS, escolherChave, escolherCorChaveParaAsset, extrairPaleta, paletaPorHeuristica, trechoFundo } from "./corChave.ts";
import { cifrar, decifrar } from "../servidor/cifra.ts";

const CHAVE = "SEGREDO-SUPER-123456";
const resp = (status: number, corpo: unknown): Response => new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
const ctx = (http: HttpFn, extra: Record<string, string> = {}): ContextoProvedor => ({ config: { apiKey: CHAVE, ...extra }, http });

// ---------- 1.3 Suíte de contrato (todo provedor passa pelos mesmos testes) ----------
for (const p of PROVEDORES) {
  test(`contrato [${p.id}]: campos, capacidades e credencial`, () => {
    assert.ok(p.id && p.nome && p.credencialId);
    assert.ok(p.campos.some((c) => c.chave === "apiKey" && c.tipo === "segredo"));
    assert.ok(p.campos.some((c) => c.chave === "modelo" && c.padrao));
    assert.ok(p.capacidades);
    for (const c of p.campos) assert.ok(c.chave && c.rotulo && (c.tipo === "texto" || c.tipo === "segredo"));
  });

  test(`contrato [${p.id}]: erro do provedor não vaza a chave`, async () => {
    const http: HttpFn = async () => resp(401, { error: { message: `chave inválida ${CHAVE}` } });
    const op = p.tipo === "imagem" ? p.gerar(ctx(http), { prompt: "x" }) : p.conversar(ctx(http), { mensagens: [{ papel: "usuario", texto: "x" }] });
    await assert.rejects(op, (e: Error) => e instanceof ErroProvedor && !e.message.includes(CHAVE) && e.message.includes("401"));
    await assert.rejects(p.testar(ctx(http)), (e: Error) => !e.message.includes(CHAVE));
  });

  test(`contrato [${p.id}]: falha de rede e campo ausente`, async () => {
    const http: HttpFn = async () => {
      throw new Error(`boom ${CHAVE}`);
    };
    const op = p.tipo === "imagem" ? p.gerar(ctx(http), { prompt: "x" }) : p.conversar(ctx(http), { mensagens: [{ papel: "usuario", texto: "x" }] });
    await assert.rejects(op, (e: Error) => !e.message.includes(CHAVE));
    await assert.rejects(p.testar({ config: {}, http }), ErroProvedor);
  });
}

// ---------- Adaptadores ----------
test("google-imagem: envia referências, modelo configurável e extrai a imagem", async () => {
  let url = "";
  let corpo: any;
  let headers: any;
  const http: HttpFn = async (u, init) => {
    url = u;
    corpo = JSON.parse(String(init?.body));
    headers = init?.headers;
    return resp(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "QUJD" } }] } }] });
  };
  const r = await googleImagem.gerar(ctx(http, { modelo: "meu-modelo" }), { prompt: "dragão", referencias: [{ mime: "image/png", base64: "ZZ" }] });
  assert.deepEqual(r, { mime: "image/png", base64: "QUJD" });
  assert.ok(url.includes("/models/meu-modelo:generateContent"));
  assert.equal(headers["x-goog-api-key"], CHAVE);
  assert.equal(corpo.contents[0].parts[0].inlineData.data, "ZZ");
  assert.equal(corpo.contents[0].parts.at(-1).text, "dragão");
});

test("google-imagem: resposta sem imagem lança erro claro", async () => {
  const http: HttpFn = async () => resp(200, { candidates: [{ content: { parts: [{ text: "recusei" }] } }] });
  await assert.rejects(googleImagem.gerar(ctx(http), { prompt: "x" }), /não devolveu imagem/);
});

const ferramenta: FerramentaNeutra = {
  nome: "colocar_objeto",
  descricao: "Coloca um objeto na cena",
  parametros: { type: "object", properties: { asset: { type: "string" }, x: { type: "number" } }, required: ["asset"] },
};

test("tool use neutro: Google e Anthropic produzem chamadas equivalentes", async () => {
  const httpG: HttpFn = async (_u, init) => {
    const b = JSON.parse(String(init?.body));
    assert.equal(b.tools[0].functionDeclarations[0].name, "colocar_objeto");
    return resp(200, { candidates: [{ content: { parts: [{ functionCall: { name: "colocar_objeto", args: { asset: "mesa", x: 0.5 } } }] } }] });
  };
  const httpA: HttpFn = async (_u, init) => {
    const b = JSON.parse(String(init?.body));
    assert.equal(b.tools[0].name, "colocar_objeto");
    assert.deepEqual(b.tools[0].input_schema, ferramenta.parametros);
    return resp(200, { content: [{ type: "tool_use", id: "tu1", name: "colocar_objeto", input: { asset: "mesa", x: 0.5 } }] });
  };
  const pedido = { mensagens: [{ papel: "usuario" as const, texto: "coloque uma mesa" }], ferramentas: [ferramenta] };
  const g = await googleLlm.conversar(ctx(httpG), pedido);
  const a = await anthropicLlm.conversar(ctx(httpA), pedido);
  assert.equal(g.chamadas[0].nome, a.chamadas[0].nome);
  assert.deepEqual(g.chamadas[0].argumentos, a.chamadas[0].argumentos);
});

test("anthropic: cabeçalhos, sistema, imagem e resultado de ferramenta", async () => {
  let b: any;
  let h: any;
  const http: HttpFn = async (_u, init) => {
    b = JSON.parse(String(init?.body));
    h = init?.headers;
    return resp(200, { content: [{ type: "text", text: "olá" }] });
  };
  const r = await anthropicLlm.conversar(ctx(http), {
    sistema: "seja breve",
    mensagens: [
      { papel: "usuario", texto: "veja", imagens: [{ mime: "image/png", base64: "AA" }] },
      { papel: "assistente", chamadas: [{ id: "t1", nome: "f", argumentos: {} }] },
      { papel: "ferramenta", texto: "feito", resultadoDe: { id: "t1", nome: "f" } },
    ],
  });
  assert.equal(r.texto, "olá");
  assert.equal(h["x-api-key"], CHAVE);
  assert.equal(b.system, "seja breve");
  assert.equal(b.messages[0].content[0].type, "image");
  assert.equal(b.messages[2].content[0].tool_use_id, "t1");
});

// ---------- 6.1 Provedor de exemplo: um arquivo + uma linha ----------
test("provedor de exemplo aparece na lista (um arquivo + uma linha) com seus campos", () => {
  const exemplo: ProvedorImagem = {
    tipo: "imagem",
    id: "exemplo-imagem",
    nome: "Exemplo",
    credencialId: "exemplo",
    campos: [{ chave: "apiKey", rotulo: "Chave Exemplo", tipo: "segredo" }, { chave: "modelo", rotulo: "Modelo", tipo: "texto", padrao: "m1" }],
    capacidades: { alfaNativo: true, imagensReferencia: 0, inpainting: "nenhum", seed: true, tamanhos: ["512"] },
    testar: async () => {},
    gerar: async () => ({ mime: "image/png", base64: "" }),
  };
  const lista = [...PROVEDORES, exemplo]; // a "linha" no registro
  const desc = provedoresImagem(lista).map(descreverProvedor).find((d) => d.id === "exemplo-imagem");
  assert.ok(desc);
  assert.equal(desc.campos[0].rotulo, "Chave Exemplo");
  assert.equal(JSON.stringify(desc).includes("function"), false);
});

// ---------- 6.3b Combinação mista ----------
test("combinação mista: cada provedor usa sua própria credencial; trocar o LLM não afeta a imagem", () => {
  assert.equal(googleImagem.credencialId, "google");
  assert.equal(googleLlm.credencialId, "google");
  assert.equal(anthropicLlm.credencialId, "anthropic");
  const creds = (ids: string[]) => new Set(PROVEDORES.filter((p) => ids.includes(p.id)).map((p) => p.credencialId));
  assert.equal(creds(["google-imagem", "google-llm"]).size, 1); // uma chave só
  assert.equal(creds(["google-imagem", "anthropic-llm"]).size, 2); // duas chaves
  assert.ok(provedoresLlm().length >= 2 && provedoresImagem().length >= 1);
});

test("combinação mista: requisições vão ao host e com a chave do respectivo fabricante", async () => {
  const visto: { url: string; chave: string }[] = [];
  const http: HttpFn = async (u, init) => {
    const h = init?.headers as Record<string, string>;
    visto.push({ url: u, chave: h["x-goog-api-key"] ?? h["x-api-key"] });
    return u.includes("anthropic")
      ? resp(200, { content: [{ type: "text", text: "ok" }] })
      : resp(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "AA" } }] } }] });
  };
  await googleImagem.gerar({ config: { apiKey: "chave-google-1" }, http }, { prompt: "x" });
  await anthropicLlm.conversar({ config: { apiKey: "chave-anthropic-1" }, http }, { mensagens: [{ papel: "usuario", texto: "x" }] });
  assert.deepEqual(visto.map((v) => v.chave), ["chave-google-1", "chave-anthropic-1"]);
  assert.ok(visto[0].url.includes("googleapis") && visto[1].url.includes("anthropic"));
});

// ---------- 6.3 Degradação ----------
test("degradação: sem alfa nativo remove fundo localmente; com alfa não", () => {
  const sem = planejarGeracao(googleImagem.capacidades, { precisaAlfa: true });
  assert.equal(sem.removerFundoLocal, true);
  const com = planejarGeracao({ ...googleImagem.capacidades, alfaNativo: true }, { precisaAlfa: true });
  assert.equal(com.removerFundoLocal, false);
  assert.equal(planejarGeracao(googleImagem.capacidades, { precisaAlfa: false }).removerFundoLocal, false);
});

test("degradação: sem imagens de referência o estilo vai só como texto", () => {
  const cap = { ...googleImagem.capacidades, imagensReferencia: 0 };
  const p = planejarGeracao(cap, { precisaAlfa: false, referencias: [{ mime: "image/png", base64: "A" }] });
  assert.equal(p.estiloSoTexto, true);
  assert.equal(p.referencias.length, 0);
  const lim = planejarGeracao({ ...cap, imagensReferencia: 1 }, { precisaAlfa: false, referencias: [{ mime: "a", base64: "A" }, { mime: "a", base64: "B" }] });
  assert.equal(lim.referencias.length, 1);
});

test("LLM sem visão: aviso e alternativa manual para análise de tema", () => {
  const r = verificarLlm({ visao: false, ferramentas: true }, "analise-tema");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.alternativa, /manualmente/);
  assert.equal(verificarLlm(anthropicLlm.capacidades, "analise-tema").ok, true);
});

// ---------- Chroma key ----------
const img = (w: number, h: number, px: (x: number, y: number) => [number, number, number]): PixelsRgba => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      d.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { data: d, width: w, height: h };
};

test("chroma: fundo magenta vira transparente, objeto permanece opaco", () => {
  const src = img(10, 10, (x, y) => (x >= 3 && x < 7 && y >= 3 && y < 7 ? [200, 30, 30] : [255, 0, 255]));
  const out = RemovedorFundoChroma.remover(src);
  const a = (x: number, y: number) => out.data[(y * 10 + x) * 4 + 3];
  assert.equal(a(0, 0), 0);
  assert.equal(a(5, 5), 255);
  assert.equal(src.data[3], 255, "não altera a entrada");
});

test("chroma: borda anti-aliasada (mistura objeto+magenta) fica parcialmente transparente", () => {
  const src = img(1, 1, () => [235, 15, 170]);
  const out = RemovedorFundoChroma.remover(src, { tolerancia: 60 });
  assert.ok(out.data[3] < 255);
});

test("chroma: objeto com tons próximos da chave faz o sistema escolher outra cor", () => {
  const magentaIsh = img(8, 8, () => [250, 10, 250]);
  const k = escolherCorChave(magentaIsh);
  assert.notDeepEqual(k, CORES_CHAVE[0]);
  const out = RemovedorFundoChroma.remover(magentaIsh, { corChave: k });
  assert.equal(out.data[3], 255);
});

// ---------- Cifragem (3.1) ----------
test("cifra AES-GCM: round-trip, IV aleatório, adulteração detectada, chave errada falha", () => {
  const k = randomBytes(32);
  const c1 = cifrar(CHAVE, k);
  const c2 = cifrar(CHAVE, k);
  assert.notEqual(c1, c2);
  assert.ok(!c1.includes(CHAVE));
  assert.equal(decifrar(c1, k), CHAVE);
  assert.throws(() => decifrar(c1, randomBytes(32)));
  const buf = Buffer.from(c1, "base64");
  buf[buf.length - 1] ^= 1;
  assert.throws(() => decifrar(buf.toString("base64"), k));
});

// ---------- 5.x Limites ----------
test("limites: teto atingido recusa com mensagem; lote exige confirmação e estimativa", () => {
  assert.equal(verificarTeto({ total: 10 }, 10).ok, false);
  const d = verificarTeto({ total: 9 }, 10);
  assert.equal(d.ok, true);
  const e = estimarLote({ total: 0 }, 50, 20);
  assert.deepEqual([e.exigeConfirmacao, e.cabeNoTeto, e.restanteAposLote], [true, true, 30]);
  assert.equal(estimarLote({ total: 40 }, 50, 20).cabeNoTeto, false);
  assert.equal(periodoDe(new Date("2026-11-18T00:00:00Z")), "2026-11");
});

// ---------- 6.2 Segredos ----------
test("regras do Firestore negam qualquer acesso do cliente a usuarios/**/segredos", () => {
  const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
  const m = /match \/usuarios\/\{uid\}\/\{document=\*\*\} \{([^}]*)\}/.exec(rules);
  assert.ok(m, "bloco de usuarios existe");
  assert.match(m[1], /allow read, write: if false;/);
  assert.match(rules, /match \/uso\/\{docId\} \{\s*allow read: if mestreMesa\(\);\s*allow write: if false;/);
});

test("rotas de IA nunca devolvem o campo cifrado nem a chave (verificação estática)", () => {
  const cfg = readFileSync(new URL("../../app/api/ia/config/route.ts", import.meta.url), "utf8");
  assert.ok(!/cifrado|decifrar/.test(cfg));
  const gerar = readFileSync(new URL("../../app/api/ia/gerar/route.ts", import.meta.url), "utf8");
  assert.match(gerar, /exigirMestre\(req, mesaId\)/);
  assert.ok(!/console\.log/.test(gerar));
});

test("chroma: detecta a cor real do fundo pelas bordas e remove mesmo fora do magenta exato", () => {
  const fundo: [number, number, number] = [250, 8, 244];
  const src = img(12, 12, (x, y) => (x >= 4 && x < 8 && y >= 4 && y < 8 ? [120, 80, 40] : fundo));
  const k = detectarCorFundo(src);
  assert.deepEqual(k, fundo);
  const out = RemovedorFundoChroma.remover(src, { corChave: k });
  assert.equal(out.data[3], 0);
  assert.equal(out.data[(6 * 12 + 6) * 4 + 3], 255);
});

test("chroma: despill tira o tom magenta perto da borda mas preserva objeto roxo longe dela", () => {
  const W = 48;
  const src = img(W, W, (x, y) => {
    if (x < 8 || x >= 40 || y < 8 || y >= 40) return [255, 0, 255];
    if (x >= 8 && x < 12) return [150, 70, 140]; // faixa contaminada (4px), fora da faixa de transparência
    if (x >= 22 && x < 28 && y >= 22 && y < 28) return [110, 40, 150]; // roxo legítimo (6x6), ~14px da borda
    return [40, 140, 40];
  });
  const out = RemovedorFundoChroma.remover(src);
  const px = (x: number, y: number) => Array.from(out.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
  const c = px(10, 24);
  const alfa = out.data[(24 * W + 10) * 4 + 3];
  assert.ok(alfa < 255 || (c[0] <= 90 && c[2] <= 90), `contaminação removida: ${c} a=${alfa}`);
  assert.deepEqual(px(23, 23), [110, 40, 150]);
  assert.deepEqual(px(30, 30), [40, 140, 40]);
});

test("chroma: ponto magenta isolado dentro do objeto (longe da borda) é substituído pela cor vizinha", () => {
  const W = 60;
  const src = img(W, W, (x, y) => {
    if (x < 8 || x >= 52 || y < 8 || y >= 52) return [255, 0, 255];
    if (x >= 29 && x < 31 && y >= 29 && y < 31) return [150, 70, 140]; // 2x2, mistura fundo+folha
    return [40, 140, 40];
  });
  const out = RemovedorFundoChroma.remover(src);
  const i = (30 * W + 30) * 4;
  const px = Array.from(out.data.slice(i, i + 4));
  assert.ok(px[3] === 0 || (px[0] === 40 && px[1] === 140 && px[2] === 40), `ponto removido: ${px}`);
});

test("chroma: bolsão de fundo escurecido (magenta mais escuro) entre folhas vira transparente", () => {
  const W = 60;
  const src = img(W, W, (x, y) => {
    if (x < 8 || x >= 52 || y < 8 || y >= 52) return [255, 0, 255];
    if (x >= 28 && x < 36 && y >= 28 && y < 32) return [155, 62, 152]; // 8x4, longe da tolerância de distância
    return [40, 140, 40];
  });
  const out = RemovedorFundoChroma.remover(src);
  assert.equal(out.data[(30 * W + 31) * 4 + 3], 0);
  assert.equal(out.data[(40 * W + 40) * 4 + 3], 255);
});

// ---------- Escolha inteligente da cor-chave ----------
const llmFalso = (texto: string | Error): { provedor: any; ctx: ContextoProvedor } => ({
  provedor: { conversar: async () => { if (texto instanceof Error) throw texto; return { texto, chamadas: [] }; } },
  ctx: { config: {}, http: fetch },
});

test("cor-chave: muro de pedra -> magenta (nada rosa em um muro)", async () => {
  const r = await escolherCorChaveParaAsset("um muro de pedra antigo");
  assert.equal(r.chave.nome, "magenta");
  assert.equal(r.origem, "heuristica");
});

test("cor-chave: canteiro de flores evita magenta (flores rosa/roxas) e usa outra cor", async () => {
  const r = await escolherCorChaveParaAsset("um canteiro de flores coloridas");
  assert.notEqual(r.chave.nome, "magenta");
  assert.equal(r.chave.nome, "cyan");
});

test("cor-chave: cores citadas na descrição entram na paleta (ex.: vestido verde -> não escolhe verde)", async () => {
  const r = await escolherCorChaveParaAsset("a green banner with gold trim");
  assert.notEqual(r.chave.nome, "green");
  assert.notEqual(r.chave.nome, "yellow");
});

test("cor-chave: com LLM usa a paleta devolvida, tolerando texto extra", async () => {
  const r = await escolherCorChaveParaAsset("objeto qualquer", llmFalso('Claro! {"cores":["#FF69B4","#ff0000","#9b30ff","#ffffff"]} espero ajudar'));
  assert.equal(r.origem, "llm");
  assert.equal(r.paleta.length, 4);
  assert.notEqual(r.chave.nome, "magenta");
  assert.notEqual(r.chave.nome, "red");
});

test("cor-chave: LLM que falha ou devolve lixo cai na heurística sem bloquear", async () => {
  const falha = await escolherCorChaveParaAsset("flores", llmFalso(new Error("boom")));
  assert.equal(falha.origem, "heuristica");
  assert.ok(falha.aviso);
  const lixo = await escolherCorChaveParaAsset("flores", llmFalso("não sei"));
  assert.equal(lixo.origem, "heuristica");
  assert.equal(lixo.chave.nome, "cyan");
});

test("cor-chave: a chave escolhida nunca é removida do objeto pelo recorte", () => {
  for (const desc of ["muro de pedra", "canteiro de flores", "tocha de fogo", "lago", "árvore", "baú de tesouro"]) {
    const paleta = paletaPorHeuristica(desc);
    const chave = escolherChave(paleta);
    const larg = paleta.length;
    const src = img(larg * 4 + 16, 12, (x, y) => {
      const i = Math.floor((x - 8) / 4);
      return x >= 8 && x < 8 + larg * 4 && y >= 2 && y < 10 && i >= 0 && i < larg ? paleta[i] : chave.rgb;
    });
    const out = RemovedorFundoChroma.remover(src, { corChave: chave.rgb });
    for (let i = 0; i < larg; i++) {
      const alfa = out.data[(6 * src.width + 8 + i * 4 + 2) * 4 + 3];
      assert.equal(alfa, 255, `${desc}: cor ${paleta[i]} foi removida com chave ${chave.nome}`);
    }
  }
});

test("cor-chave: extrairPaleta e trechoFundo", () => {
  assert.deepEqual(extrairPaleta("#AABBCC e #aabbcc, #00ff00"), [[170, 187, 204], [0, 255, 0]]);
  const t = trechoFundo(CANDIDATAS[1]);
  assert.ok(t.includes("cyan") && t.includes("#00FFFF") && t.includes("no cyan anywhere"));
});
