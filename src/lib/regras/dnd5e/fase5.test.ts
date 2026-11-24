import test from "node:test";
import assert from "node:assert/strict";
import { FICHA_VAZIA, descansoCurto, descansoLongo, normalizar, type FichaDnd } from "../../dnd5e.ts";
import {
  CONDICOES, ataquesContraVoce, aplicarCura, aplicarDano, ativaveisDisponiveis, comSugestao, condicoesEfetivas, defesasDe, deslocamentoEfetivo,
  estabilizar, estadoVital, modoDaJogada, pvMaxEfetivo, salvaguardaDeMorte, type Defesas,
} from "./combate.ts";
import { criarCatalogo } from "./catalogo.ts";
import { derivar } from "./derivar.ts";
import { desligarAtivavel, gastarRecurso, imposicaoDasMaos, ligarAtivavel, recursosCalculados, recursosDaFicha, restaurarRecursos, testeAtaqueFurtivo } from "./recursos.ts";

const ficha = (p: Partial<FichaDnd> = {}): FichaDnd => normalizar({ ...FICHA_VAZIA, pvMax: 20, pv: 20, ...p, atributos: { ...FICHA_VAZIA.atributos, ...p.atributos } });
const nenhuma: Defesas = { resistencias: [], vulnerabilidades: [], imunidades: [] };

test("condições: as 14 do Apêndice A, com ids únicos", () => {
  assert.equal(CONDICOES.length, 14);
  assert.equal(new Set(CONDICOES.map((c) => c.id)).size, 14);
});

test("vantagem/desvantagem: envenenado, invisível, caído e cancelamento", () => {
  const atq = { tipo: "ataque", corpo: true, atributo: "for" } as const;
  assert.deepEqual(modoDaJogada(ficha({ condicoes: ["envenenado"] }), atq), { modo: "d", vantagens: [], desvantagens: ["Envenenado"] });
  assert.equal(modoDaJogada(ficha({ condicoes: ["invisivel"] }), atq).modo, "v");
  const anulado = modoDaJogada(ficha({ condicoes: ["invisivel", "envenenado"] }), atq);
  assert.equal(anulado.modo, null);
  assert.deepEqual([anulado.vantagens, anulado.desvantagens], [["Invisível"], ["Envenenado"]]);
  assert.equal(modoDaJogada(ficha({ condicoes: ["envenenado"] }), { tipo: "teste", atributo: "des" }).modo, "d");
  assert.equal(modoDaJogada(ficha({ condicoes: ["cego"] }), { tipo: "salvaguarda", atributo: "sab" }).modo, null);
});

test("salvaguardas: impedido pesa em Des; atordoado falha em For/Des; exaustão", () => {
  assert.equal(modoDaJogada(ficha({ condicoes: ["impedido"] }), { tipo: "salvaguarda", atributo: "des" }).modo, "d");
  assert.equal(modoDaJogada(ficha({ condicoes: ["impedido"] }), { tipo: "salvaguarda", atributo: "con" }).modo, null);
  assert.match(modoDaJogada(ficha({ condicoes: ["atordoado"] }), { tipo: "salvaguarda", atributo: "for" }).falhaAutomatica ?? "", /Atordoado/);
  assert.equal(modoDaJogada(ficha({ condicoes: ["atordoado"] }), { tipo: "salvaguarda", atributo: "sab" }).falhaAutomatica, undefined);
  assert.equal(modoDaJogada(ficha({ exaustao: 1 }), { tipo: "teste", atributo: "for" }).modo, "d");
  assert.equal(modoDaJogada(ficha({ exaustao: 1 }), { tipo: "ataque", corpo: true, atributo: "for" }).modo, null);
  assert.equal(modoDaJogada(ficha({ exaustao: 3 }), { tipo: "ataque", corpo: true, atributo: "for" }).modo, "d");
  assert.equal(modoDaJogada(ficha({ exaustao: 3 }), { tipo: "salvaguarda", atributo: "sab" }).modo, "d");
});

test("a 0 PV a criatura está inconsciente; armadura sem proficiência pesa em For/Des", () => {
  const zero = ficha({ pv: 0 });
  assert.deepEqual(condicoesEfetivas(zero), ["inconsciente"]);
  assert.ok(ataquesContraVoce(zero).some((t) => /crítico/.test(t)));
  const m = modoDaJogada({ ...ficha(), armaduraSemProf: true }, { tipo: "teste", atributo: "des" });
  assert.equal(m.modo, "d");
  assert.equal(modoDaJogada({ ...ficha(), armaduraSemProf: true }, { tipo: "teste", atributo: "sab" }).modo, null);
  const t = comSugestao({ titulo: "x", dado: "1d20", d20: true, partes: [] }, m);
  assert.equal(t.sugestao?.modo, "d");
});

test("Fúria e Ataque Descuidado: vantagem em Força, resistências e dano", () => {
  const b = ficha({ classe: "barbaro", nivel: 9, ativos: ["furia", "ataque-descuidado"] });
  assert.equal(modoDaJogada(b, { tipo: "teste", atributo: "for" }).modo, "v");
  assert.equal(modoDaJogada(b, { tipo: "salvaguarda", atributo: "for" }).modo, "v");
  assert.equal(modoDaJogada(b, { tipo: "ataque", corpo: true, atributo: "for" }).modo, "v");
  assert.equal(modoDaJogada(b, { tipo: "ataque", corpo: false, atributo: "des" }).modo, null);
  assert.ok(ataquesContraVoce(b).includes("Ataque Descuidado: vantagem"));
  assert.deepEqual(defesasDe(b).resistencias.filter((r) => ["cortante", "perfurante"].includes(r)), ["cortante", "perfurante"]);
  assert.equal(defesasDe(ficha()).resistencias.length, 0);
  assert.deepEqual(ativaveisDisponiveis(ficha({ classe: "barbaro", nivel: 1 })).map((a) => a.id), ["furia"]);
  assert.deepEqual(ativaveisDisponiveis(ficha({ classe: "ladino", nivel: 5 })), []);
});

test("deslocamento e PV máximos pela exaustão e condições", () => {
  assert.equal(deslocamentoEfetivo(9, ficha({ exaustao: 2 })).valor, 4.5);
  assert.equal(deslocamentoEfetivo(9, ficha({ exaustao: 5 })).valor, 0);
  assert.equal(deslocamentoEfetivo(9, ficha({ condicoes: ["agarrado"] })).valor, 0);
  assert.equal(deslocamentoEfetivo(9, ficha({ condicoes: ["envenenado"] })).valor, 9);
  assert.equal(pvMaxEfetivo(21, ficha({ exaustao: 4 })), 10);
  assert.equal(pvMaxEfetivo(21, ficha({ exaustao: 3 })), 21);
  assert.equal(estadoVital(ficha({ exaustao: 6 })), "morto");
});

test("dano: PV temporários, resistência, vulnerabilidade e imunidade", () => {
  const f = ficha({ pvTemp: 5 });
  const r = aplicarDano(f, { valor: 8, defesas: nenhuma });
  assert.deepEqual([r.ficha.pvTemp, r.ficha.pv], [0, 17]);
  const res = aplicarDano(f, { valor: 9, tipo: "Fogo", defesas: { ...nenhuma, resistencias: ["fogo"] } });
  assert.equal(res.final, 4);
  assert.deepEqual([res.ficha.pvTemp, res.ficha.pv], [1, 20]);
  assert.equal(aplicarDano(f, { valor: 9, tipo: "frio", defesas: { ...nenhuma, vulnerabilidades: ["frio"] } }).final, 18);
  const imune = aplicarDano(f, { valor: 9, tipo: "veneno", defesas: { ...nenhuma, imunidades: ["veneno"] } });
  assert.equal(imune.ficha, f);
  const ambos = aplicarDano(f, { valor: 9, tipo: "fogo", defesas: { resistencias: ["fogo"], vulnerabilidades: ["fogo"], imunidades: [] } });
  assert.equal(ambos.final, 8); // metade (4) e depois dobro
});

test("dano: cair a 0, morte instantânea e dano a 0 PV", () => {
  const cai = aplicarDano(ficha({ pv: 5 }), { valor: 12, defesas: nenhuma });
  assert.deepEqual([cai.ficha.pv, cai.caiu, cai.morreu], [0, true, false]);
  assert.equal(estadoVital(cai.ficha), "inconsciente");
  const instantanea = aplicarDano(ficha({ pv: 5 }), { valor: 25, defesas: nenhuma }); // restam 20 = PV máx
  assert.equal(instantanea.morreu, true);
  assert.equal(estadoVital(instantanea.ficha), "morto");
  const a0 = aplicarDano(ficha({ pv: 0 }), { valor: 3, defesas: nenhuma });
  assert.equal(a0.ficha.morteFalhas, 1);
  assert.equal(aplicarDano(ficha({ pv: 0 }), { valor: 3, critico: true, defesas: nenhuma }).ficha.morteFalhas, 2);
  assert.equal(aplicarDano(ficha({ pv: 0, morteFalhas: 2 }), { valor: 1, defesas: nenhuma }).morreu, true);
  assert.equal(aplicarDano(ficha({ pv: 0 }), { valor: 20, defesas: nenhuma }).morreu, true);
  const morto = ficha({ pv: 0, morteFalhas: 3 });
  assert.equal(aplicarDano(morto, { valor: 5, defesas: nenhuma }).ficha, morto);
});

test("salvaguarda de morte, estabilização e cura", () => {
  const f = ficha({ pv: 0 });
  assert.deepEqual([salvaguardaDeMorte(f, 20).ficha.pv, salvaguardaDeMorte(f, 20).ficha.morteFalhas], [1, 0]);
  assert.equal(salvaguardaDeMorte(f, 1).ficha.morteFalhas, 2);
  assert.equal(salvaguardaDeMorte(f, 10).ficha.morteSucessos, 1);
  assert.equal(salvaguardaDeMorte(f, 9).ficha.morteFalhas, 1);
  assert.equal(estadoVital(salvaguardaDeMorte({ ...f, morteSucessos: 2 }, 15).ficha), "estavel");
  assert.equal(estadoVital(salvaguardaDeMorte({ ...f, morteFalhas: 2 }, 5).ficha), "morto");
  assert.equal(salvaguardaDeMorte({ ...f, morteSucessos: 3 }, 1).ficha.morteFalhas, 0); // estável não rola
  assert.equal(estadoVital(estabilizar(f)), "estavel");
  const curado = aplicarCura({ ...f, morteFalhas: 2 }, 4);
  assert.deepEqual([curado.pv, curado.morteFalhas, estadoVital(curado)], [4, 0, "vivo"]);
  const morto = ficha({ pv: 0, morteFalhas: 3 });
  assert.equal(aplicarCura(morto, 10), morto);
  assert.equal(aplicarCura(ficha({ pv: 18 }), 10).pv, 20);
});

test("recursos por classe e nível", () => {
  const ids = (f: FichaDnd) => recursosDaFicha(f).map((r) => `${r.id}:${r.max}`);
  assert.deepEqual(ids(ficha({ classe: "barbaro", nivel: 1 })), ["furia:2"]);
  assert.deepEqual(ids(ficha({ classe: "barbaro", nivel: 6 })), ["furia:4"]);
  assert.equal(recursosDaFicha(ficha({ classe: "barbaro", nivel: 20 }))[0].ilimitado, true);
  const bardo = recursosDaFicha(ficha({ classe: "bardo", nivel: 5, atributos: { ...FICHA_VAZIA.atributos, car: 16 } }))[0];
  assert.deepEqual([bardo.max, bardo.recarga, bardo.rolagem?.dado], [3, "curto", "1d8"]);
  assert.equal(recursosDaFicha(ficha({ classe: "bardo", nivel: 4 }))[0].recarga, "longo");
  assert.deepEqual(ids(ficha({ classe: "guerreiro", nivel: 9 })), ["retomar-o-folego:1", "surto-de-acao:1", "indomavel:1"]);
  assert.equal(recursosDaFicha(ficha({ classe: "guerreiro", nivel: 17 })).find((r) => r.id === "surto-de-acao")?.max, 2);
  assert.deepEqual(ids(ficha({ classe: "monge", nivel: 5 })), ["pontos-de-ki:5"]);
  assert.deepEqual(ids(ficha({ classe: "monge", nivel: 1 })), []);
  assert.deepEqual(ids(ficha({ classe: "paladino", nivel: 4 })), ["imposicao-das-maos:20", "sentido-divino:1"]);
  assert.deepEqual(ids(ficha({ classe: "clerigo", nivel: 6 })), ["canalizar-divindade:2"]);
  assert.deepEqual(ids(ficha({ classe: "feiticeiro", nivel: 3 })), ["pontos-de-feiticaria:3"]);
  assert.deepEqual(ids(ficha({ classe: "ladino", nivel: 3 })), []);
  assert.deepEqual(recursosDaFicha(ficha({ classe: "ladino" }), { racaId: "draconato", talentos: ["sortudo"] }).map((r) => r.id), ["arma-de-sopro", "pontos-de-sorte"]);
});

test("gastar e restaurar nos descansos (curto devolve só os de recarga curta)", () => {
  const f = ficha({ classe: "guerreiro", nivel: 9 });
  const defs = recursosDaFicha(f);
  let g = gastarRecurso(f, defs, "retomar-o-folego");
  g = gastarRecurso(g, defs, "indomavel");
  assert.equal(gastarRecurso(g, defs, "indomavel"), g); // sem usos
  assert.deepEqual(recursosCalculados(g, defs).map((r) => r.restantes), [0, 1, 0]);
  const curto = restaurarRecursos(g, defs, "curto");
  assert.deepEqual(recursosCalculados(curto, defs).map((r) => r.restantes), [1, 1, 0]);
  assert.deepEqual(recursosCalculados(restaurarRecursos(g, defs, "longo"), defs).map((r) => r.restantes), [1, 1, 1]);
  assert.equal(gastarRecurso(g, defs, "retomar-o-folego", -1).recursos?.["retomar-o-folego"], 0);
  assert.equal(descansoCurto(f).pv, f.pv); // o descanso clássico segue funcionando
  assert.equal(descansoLongo(f).descansosCurtos, 0);
});

test("ligar Fúria gasta um uso, encerra nos descansos e ilimitada não gasta", () => {
  const f = ficha({ classe: "barbaro", nivel: 1 });
  const defs = recursosDaFicha(f);
  const on = ligarAtivavel(f, defs, "furia")!;
  assert.deepEqual([on.ativos, on.recursos?.furia], [["furia"], 1]);
  const on2 = ligarAtivavel(desligarAtivavel(on, "furia"), defs, "furia")!;
  assert.equal(ligarAtivavel(desligarAtivavel(on2, "furia"), defs, "furia"), null); // 2 usos acabaram
  assert.deepEqual(restaurarRecursos(on, defs, "curto").ativos, []);
  const lv20 = ficha({ classe: "barbaro", nivel: 20 });
  assert.ok(ligarAtivavel(lv20, recursosDaFicha(lv20), "furia"));
  assert.equal(ligarAtivavel(ficha({ classe: "barbaro", nivel: 2 }), recursosDaFicha(ficha({ classe: "barbaro", nivel: 2 })), "nao-existe"), null);
});

test("imposição das mãos e ataque furtivo", () => {
  const f = ficha({ classe: "paladino", nivel: 3 });
  const defs = recursosDaFicha(f);
  const g = imposicaoDasMaos(f, defs, 10)!;
  assert.equal(recursosCalculados(g, defs)[0].restantes, 5);
  assert.equal(imposicaoDasMaos(g, defs, 6), null);
  assert.equal(testeAtaqueFurtivo(ficha({ classe: "ladino", nivel: 5 }))?.dado, "3d6");
  assert.equal(testeAtaqueFurtivo(ficha({ classe: "ladino", nivel: 1 }))?.dado, "1d6");
  assert.equal(testeAtaqueFurtivo(ficha({ classe: "mago" })), null);
});

test("Armadura Arcana: CA 13 + Des só sem armadura, e é ativável por mago e feiticeiro", () => {
  assert.deepEqual(ativaveisDisponiveis(ficha({ classe: "mago", nivel: 1 })).map((a) => a.id), ["armadura-arcana"]);
  assert.deepEqual(ativaveisDisponiveis(ficha({ classe: "feiticeiro", nivel: 3 })).map((a) => a.id), ["armadura-arcana"]);
  assert.deepEqual(ativaveisDisponiveis(ficha({ classe: "guerreiro", nivel: 3 })), []);
  const base = { id: "i1", nome: "", quantidade: 1, peso: 0, equipado: true, descricao: "", catalogoId: "couro" };
  const mago = (ativos: string[], itens: typeof base[]) => normalizar({ ...FICHA_VAZIA, ativos, itens, build: { classes: [{ id: "mago", nivel: 3, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 14, con: 10, int: 10, sab: 10, car: 10 } } });
  const cat = criarCatalogo([{ id: "phb", nome: "x", classes: [{ id: "mago", nome: "Mago", pacote: "phb", dadoVida: 6, salvaguardas: ["int", "sab"] }], equipamento: [{ id: "couro", nome: "Couro", pacote: "phb", tipo: "armadura", categoria: "leve", caBase: 11, somaDes: true, peso: 5 }] }]);
  assert.equal(derivar(mago([], []), cat).ca.total, 12);
  assert.equal(derivar(mago(["armadura-arcana"], []), cat).ca.total, 15);
  assert.equal(derivar(mago(["armadura-arcana"], [base]), cat).ca.total, 13); // com armadura, vale a armadura
});
