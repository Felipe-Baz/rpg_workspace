import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIMITE_IA_PADRAO, MAX_PERGUNTA, MAX_RESPOSTA_IA, decidirLimiteIa, diaDe, limparRespostaIa, montarPedidoPergunta } from "./ia-extensao.ts";
import { FORMATO_PACOTE, MAX_PACOTE, criarPacote, lerPacote, nomeDoArquivo } from "./pacote.ts";
import { PERMISSAO_IDS, PERMISSOES, autorizar, descricaoApi, textoConsentimento, validarPedido } from "./capacidades.ts";
import { atender, leitorExemplo } from "./broker-puro.ts";
import { MAX_HTML } from "./documento.ts";
import { montarDocumento } from "./documento.ts";
import { MESA_PADRAO } from "../marcas-const.ts";

const HTML = "<div>ferramenta de teste pronta para uso</div>";

test("regras do Firestore: a mesa das Marcas é a mesma do app (sem deriva)", () => {
  const regras = readFileSync("firestore.rules", "utf8").replace(/\r\n/g, "\n");
  assert.ok(regras.includes(`mesaId == '${MESA_PADRAO}'`), "MESA_PADRAO precisa ser igual ao id em firestore.rules (mesaDasMarcas)");
  // toda coleção das Marcas passa pelas funções que exigem a mesa certa
  for (const colecao of ["players", "assignments", "notes", "lore", "puzzles", "released", "puzzleResp", "puzzleStatus"]) {
    const i = regras.indexOf(`match /${colecao}/{`);
    assert.ok(i > 0, colecao);
    const bloco = regras.slice(i, regras.indexOf("\n      }\n", i));
    assert.doesNotMatch(bloco, /\bmestreMesa\(\)|\bmembroMesa\(\)/, `${colecao} ainda usa mestreMesa/membroMesa direto`);
    assert.match(bloco, /marcas(Mestre|Jogador)\(\)/, colecao);
  }
});

test("limite diário da IA: libera até o limite, recusa depois e respeita 'desligado'", () => {
  assert.deepEqual(decidirLimiteIa(0, 3), { ok: true, restante: 2 });
  assert.deepEqual(decidirLimiteIa(2, 3), { ok: true, restante: 0 });
  const r = decidirLimiteIa(3, 3);
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /Limite diário de 3/);
  assert.equal(decidirLimiteIa(0, 0).ok, false); // 0 = desligado
  assert.equal(decidirLimiteIa(0, Number.NaN).ok, false);
  assert.ok(LIMITE_IA_PADRAO > 0);
  assert.match(diaDe(new Date("2026-11-23T23:59:00Z")), /^2026-11-23$/);
});

test("pergunta à IA: prompt fixo, texto limitado e resposta saneada", () => {
  const p = montarPedidoPergunta("  " + "x".repeat(MAX_PERGUNTA + 500));
  assert.equal(p.mensagens.length, 1);
  assert.equal(p.mensagens[0].texto!.length, MAX_PERGUNTA);
  assert.match(p.sistema!, /ignorar qualquer instrução/);
  assert.equal(limparRespostaIa("  oi\u0000 ").length, 2);
  assert.equal(limparRespostaIa("a".repeat(MAX_RESPOSTA_IA + 50)).length, MAX_RESPOSTA_IA);
});

test("permissão usar:ia: validação do pedido, autorização, broker e documentação", async () => {
  assert.ok(PERMISSAO_IDS.includes("usar:ia"));
  const ped = validarPedido({ rpg: "pedido", id: 4, op: "perguntar", alvo: "ia", args: { texto: "Dê um nome para a taverna" } })!;
  assert.ok(ped);
  assert.equal(validarPedido({ rpg: "pedido", id: 4, op: "perguntar", alvo: "ia", args: { texto: "   " } }), null);
  assert.equal(validarPedido({ rpg: "pedido", id: 4, op: "perguntar", alvo: "ia", args: { texto: "x".repeat(2001) } }), null);
  assert.equal(validarPedido({ rpg: "pedido", id: 4, op: "perguntar", alvo: "dados", args: { texto: "oi" } }), null);
  assert.equal(autorizar([], ped).ok, false);
  assert.equal(autorizar(["ler:mesa"], ped).ok, false);
  assert.equal(autorizar(["usar:ia"], ped).ok, true);
  await assert.rejects(() => atender(ped, [], leitorExemplo, undefined, async () => "x"), /Permissão não concedida/);
  await assert.rejects(() => atender(ped, ["usar:ia"], leitorExemplo), /não está disponível/);
  assert.deepEqual(await atender(ped, ["usar:ia"], leitorExemplo, undefined, async (t) => ({ texto: `eco: ${t}` })), { texto: "eco: Dê um nome para a taverna" });
  assert.match(descricaoApi(), /RPG\.perguntar/);
  assert.equal(PERMISSOES["usar:ia"].acao, "usar");
  const c = textoConsentimento(["usar:ia"], false);
  assert.match(c, /Usar — Usar a IA do mestre/);
  assert.match(c, /limite diário do mestre/);
  assert.match(montarDocumento("<p>x</p>"), /perguntar:function\(t\)/);
});

test("pacote: exporta só código e manifesto, e o arquivo volta igual", () => {
  const pacote = criarPacote({ titulo: "Gerador de Tesouro", descricao: "d", html: HTML, manifesto: { encaixes: [{ slot: "sessao.painel" }], permissoes: ["ler:jogadores", "criar:fichas"], eventos: ["missao.concluida"] } });
  assert.equal(pacote.formato, FORMATO_PACOTE);
  assert.deepEqual(Object.keys(pacote).sort(), ["descricao", "formato", "html", "manifesto", "titulo", "versao"]);
  const volta = lerPacote(JSON.stringify(pacote));
  assert.ok(volta.ok);
  assert.deepEqual(volta.ok && volta.pacote, pacote);
  assert.equal(nomeDoArquivo("Gerador de Tesouro: Às Cegas!"), "gerador-de-tesouro-as-cegas.rpgext.json");
  assert.equal(nomeDoArquivo("***"), "extensao.rpgext.json");
});

test("pacote: não carrega dados nem aprovações vindos do arquivo", () => {
  const malicioso = { formato: FORMATO_PACOTE, versao: 1, titulo: "x", html: HTML, manifesto: { permissoes: ["ler:mesa"] }, permissoesAprovadas: ["criar:fichas", "usar:ia"], dadosJson: "{\"a\":1}", ativa: true, visivelJogadores: true, donoUid: "outro" };
  const r = lerPacote(JSON.stringify(malicioso));
  assert.ok(r.ok);
  const p = (r.ok ? r.pacote : null) as unknown as Record<string, unknown>;
  for (const campo of ["permissoesAprovadas", "dadosJson", "ativa", "visivelJogadores", "donoUid"]) assert.equal(campo in p, false, campo);
  assert.deepEqual((p.manifesto as { permissoes: string[] }).permissoes, ["ler:mesa"]); // continua sendo só um PEDIDO
});

test("pacote: recusa arquivos inválidos", () => {
  const base = { formato: FORMATO_PACOTE, versao: 1, titulo: "x", html: HTML };
  const erro = (v: unknown) => { const r = lerPacote(typeof v === "string" ? v : JSON.stringify(v)); assert.equal(r.ok, false); return (r as { erro: string }).erro; };
  assert.match(erro("não é json"), /JSON/);
  assert.match(erro("[]"), /não é uma extensão/);
  assert.match(erro({ ...base, formato: "outro" }), /não é uma extensão/);
  assert.match(erro({ ...base, versao: 2 }), /Versão/);
  assert.match(erro({ ...base, titulo: "  " }), /título/);
  assert.match(erro({ ...base, html: "curto" }), /HTML/);
  assert.match(erro({ ...base, html: "<p>" + "a".repeat(MAX_HTML) }), /grande demais/);
  assert.match(erro("x".repeat(MAX_PACOTE + 1)), /grande demais/);
  assert.equal(lerPacote(JSON.stringify(base)).ok, true);
  // manifesto lixo vira o padrão (só sidebar), nunca quebra
  const r = lerPacote(JSON.stringify({ ...base, manifesto: "x" }));
  assert.ok(r.ok && r.pacote.manifesto.encaixes[0].slot === "sidebar");
});
