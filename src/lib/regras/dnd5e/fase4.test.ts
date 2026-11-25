import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar, testeAtaque, testeDano, type FichaDnd, type Item } from "../../dnd5e.ts";
import { criarCatalogo, type ArmaCat, type ClasseCat, type ItemCat, type Raca } from "./catalogo.ts";
import { derivar } from "./derivar.ts";
import { fichaEfetiva, gravavel } from "./efetiva.ts";
import { capacidadeDeCarga, emOuro, itensDeTexto, pagar, proficienteEmArma, trocarMoedas } from "./equipamento.ts";
import type { Build } from "./build.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const equipamento = lerJson<ItemCat[]>("equipamento");
const classes = lerJson<ClasseCat[]>("classes");
const racas = lerJson<Raca[]>("racas");
const cat = criarCatalogo([{ id: "phb", nome: "Livro do Jogador", racas, classes, equipamento }]);
const arma = (id: string) => cat.item(id) as ArmaCat;

let n = 0;
const item = (catalogoId: string, extra: Partial<Item> = {}): Item => ({ id: `i${++n}`, nome: "", quantidade: 1, peso: 0, equipado: true, descricao: "", catalogoId, ...extra });
const com = (classe: string, atributos: Partial<FichaDnd["atributos"]>, itens: Item[], b: Partial<Build> = {}): FichaDnd => normalizar({
  ...FICHA_VAZIA, itens,
  build: { classes: [{ id: classe, nivel: 3, escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10, ...atributos }, ...b },
});

test("catálogo de equipamento: contagens e dados do livro", () => {
  assert.equal(equipamento.filter((x) => x.tipo === "arma").length, 37);
  assert.equal(equipamento.filter((x) => x.tipo === "armadura").length, 12);
  assert.equal(equipamento.filter((x) => x.tipo === "pacote").length, 7);
  assert.equal(new Set(equipamento.map((x) => x.id)).size, equipamento.length);
  const longa = arma("espada-longa");
  assert.deepEqual([longa.dado, longa.tipoDano, longa.propriedades.versatil], ["1d8", "cortante", "1d10"]);
  assert.equal(arma("adaga").propriedades.acuidade, true);
  assert.deepEqual(arma("arco-longo").propriedades.municao, { normal: 45, longo: 180 });
  const placas = cat.item("placas");
  assert.ok(placas?.tipo === "armadura" && placas.caBase === 18 && placas.forca === 15 && placas.furtividadeDesv);
});

test("CA: armadura pesada + escudo; leve e média somam Destreza (média com limite +2)", () => {
  const pesada = derivar(com("guerreiro", { for: 15, des: 14 }, [item("cota-de-malha"), item("escudo")]), cat);
  assert.equal(pesada.ca.total, 16 + 2); // pesada ignora Des
  const leve = derivar(com("ladino", { des: 18 }, [item("couro-batido")]), cat);
  assert.equal(leve.ca.total, 12 + 4);
  const media = derivar(com("clerigo", { des: 18 }, [item("brunea")], { raca: { id: "anao", sub: "anao-da-montanha" } }), cat);
  assert.equal(media.ca.total, 14 + 2); // Des +4 limitado a +2
  const semArmadura = derivar(com("mago", { des: 14 }, []), cat);
  assert.equal(semArmadura.ca.total, 12);
});

test("CA: Defesa sem Armadura de bárbaro e monge; armadura equipada tem prioridade", () => {
  assert.equal(derivar(com("barbaro", { des: 14, con: 16 }, []), cat).ca.total, 10 + 2 + 3);
  assert.equal(derivar(com("monge", { des: 16, sab: 14 }, []), cat).ca.total, 10 + 3 + 2);
  assert.equal(derivar(com("monge", { des: 16, sab: 14 }, [item("escudo")]), cat).ca.total, 10 + 3 + 2); // escudo anula só o do monge
  assert.equal(derivar(com("barbaro", { des: 14, con: 16 }, [item("escudo")]), cat).ca.total, 10 + 2 + 3 + 2);
  assert.equal(derivar(com("barbaro", { des: 14, con: 16 }, [item("couro")]), cat).ca.total, 11 + 2);
});

test("CA: bônus mágico, item de CA, não equipado não conta e ajuste do mestre", () => {
  const f = com("guerreiro", { for: 16 }, [item("cota-de-malha", { bonusMagico: 1 }), item("escudo", { equipado: false }), { ...item("", { catalogoId: undefined }), nome: "Anel de proteção", bonusCa: 1 }]);
  const c = derivar(f, cat);
  assert.equal(c.ca.total, 16 + 1 + 1);
  assert.ok(c.ca.partes.some((p) => p.rotulo === "Anel de proteção"));
  const aj = derivar({ ...f, build: { ...f.build!, ajustes: { ca: { somar: 2, rotulo: "Regra da casa" } } } }, cat);
  assert.equal(aj.ca.total, 20);
  assert.deepEqual(aj.ajustados, ["ca"]);
});

test("avisos: sem proficiência em armadura, Força insuficiente e furtividade", () => {
  const mago = derivar(com("mago", {}, [item("cota-de-malha")]), cat);
  assert.ok(mago.avisos.some((a) => /Sem proficiência em armadura pesada/.test(a)));
  const fraco = derivar(com("guerreiro", { for: 12 }, [item("cota-de-malha")]), cat);
  assert.ok(fraco.avisos.some((a) => /Força 12/.test(a)));
  assert.equal(fraco.deslocamento.total, 9 - 3);
  assert.ok(fraco.avisos.some((a) => /Furtividade/.test(a)));
  const forte = derivar(com("guerreiro", { for: 13 }, [item("cota-de-malha")]), cat);
  assert.equal(forte.deslocamento.total, 9);
  assert.deepEqual(forte.avisos.filter((a) => /Força/.test(a)), []);
});

test("ataques das armas: atributo, proficiência, acuidade, versátil e bônus mágico", () => {
  const g = derivar(com("guerreiro", { for: 16, des: 14 }, [item("espada-longa", { bonusMagico: 1 }), item("arco-longo"), item("adaga")]), cat);
  const por = (id: string) => g.ataques.find((a) => a.id.includes(id))!;
  const espada = g.ataques.find((a) => a.nome === "Espada Longa")!;
  assert.deepEqual([espada.atr, espada.proficiente, espada.bonusAtaque, espada.dano], ["for", true, 1, "1d8"]);
  assert.equal(g.ataques.find((a) => a.nome === "Espada Longa (duas mãos)")!.dano, "1d10");
  assert.equal(g.ataques.find((a) => a.nome === "Arco Longo")!.atr, "des");
  assert.equal(g.ataques.find((a) => a.nome === "Adaga")!.atr, "for"); // acuidade: maior entre For 16 e Des 14
  assert.ok(g.ataques.some((a) => a.id === "arma:desarmado"));
  void por;
  const l = derivar(com("ladino", { for: 10, des: 16 }, [item("adaga"), item("rapieira")]), cat);
  assert.equal(l.ataques.find((a) => a.nome === "Adaga")!.atr, "des");
  assert.equal(l.ataques.find((a) => a.nome === "Rapieira")!.atr, "des");
});

test("proficiência em armas: categorias, nomes no plural e apelidos do livro", () => {
  const mago = derivar(com("mago", {}, [item("espada-longa"), item("adaga"), item("besta-leve"), item("cajado")]), cat);
  const prof = (nome: string) => mago.ataques.find((a) => a.nome === nome)?.proficiente;
  assert.equal(prof("Espada Longa"), false);
  assert.equal(prof("Adaga"), true);
  assert.equal(prof("Besta Leve"), true);
  assert.equal(proficienteEmArma(arma("foice-curta"), ["foices", "clavas"]), true);
  assert.equal(proficienteEmArma(arma("porrete"), ["clavas"]), true);
  assert.equal(proficienteEmArma(arma("maca-estrela"), ["maças"]), false);
  assert.equal(proficienteEmArma(arma("maca"), ["maças"]), true);
  assert.equal(proficienteEmArma(arma("besta-de-mao"), ["bestas de mão"]), true);
  assert.equal(proficienteEmArma(arma("alabarda"), ["armas simples", "armas marciais"]), true);
  assert.deepEqual(itensDeTexto("Armas simples, bestas de mão e espadas curtas"), ["Armas simples", "bestas de mão", "espadas curtas"]);
  assert.deepEqual(itensDeTexto("Nenhuma"), []);
  // raça concede armas (alto elfo: espada longa)
  const elfo = derivar(com("mago", {}, [item("espada-longa")], { raca: { id: "elfo", sub: "alto-elfo" } }), cat);
  assert.equal(elfo.ataques.find((a) => a.nome === "Espada Longa")?.proficiente, true);
});

test("bônus de ataque e dano usam o atributo e a proficiência corretos", () => {
  const f = com("guerreiro", { for: 16 }, [item("espada-longa", { bonusMagico: 1 })], { classes: [{ id: "guerreiro", nivel: 5, escolhas: { pericias: [] } }] });
  const ef = fichaEfetiva(f, derivar(f, cat), cat);
  const a = ef.ataques.find((x) => x.nome === "Espada Longa")!;
  const t = testeAtaque(ef, a);
  assert.equal(t.partes.reduce((s, p) => s + p.valor, 0), 3 + 3 + 1); // For +3, prof +3, +1 mágica
  const d = testeDano(ef, a);
  assert.equal(d.partes.reduce((s, p) => s + p.valor, 0), 3 + 1);
});

test("ficha efetiva: CA e ataques derivados não são gravados", () => {
  const f = { ...com("guerreiro", { for: 16 }, [item("cota-de-malha")]), ataques: [{ id: "m1", nome: "Soco inglês", atr: "for" as const, proficiente: true, bonusAtaque: 0, dano: "1d4", bonusDano: 0, tipoDano: "", notas: "" }] };
  const ef = fichaEfetiva(f, derivar(f, cat), cat);
  assert.equal(ef.ca, 16);
  assert.ok(ef.ataques.some((a) => a.derivado) && ef.ataques.some((a) => a.id === "m1"));
  const g = gravavel(f, { ...ef, ca: 99, ataques: [...ef.ataques, { ...f.ataques[0], id: "m2" }] });
  assert.equal(g.ca, f.ca);
  assert.deepEqual(g.ataques.map((a) => a.id), ["m1", "m2"]);
});

test("carga e sintonização", () => {
  assert.equal(capacidadeDeCarga(10), 75);
  const pesado = com("guerreiro", { for: 8 }, [item("cota-de-malha", { peso: 27.5, quantidade: 3 })]);
  assert.ok(derivar(pesado, cat).avisos.some((a) => /Carga/.test(a)));
  const sint = com("mago", {}, [1, 2, 3, 4].map((i) => item("", { catalogoId: undefined, nome: `Item ${i}`, sintonizado: true, equipado: false })));
  const c = derivar(sint, cat);
  assert.equal(c.sintonizados, 4);
  assert.ok(c.avisos.some((a) => /sintonizados/.test(a)));
});

test("moedas: câmbio, troca exata e pagamento com troco", () => {
  const m = { pc: 0, pp: 0, pe: 0, po: 10, pl: 0 };
  assert.equal(emOuro(m), 10);
  assert.deepEqual(trocarMoedas(m, "po", "pp", 3), { pc: 0, pp: 30, pe: 0, po: 7, pl: 0 });
  assert.deepEqual(trocarMoedas(m, "po", "pl", 10), { pc: 0, pp: 0, pe: 0, po: 0, pl: 1 });
  assert.equal(trocarMoedas({ ...m, po: 5 }, "po", "pl", 5).pl, 0); // 5 po não fecham 1 pl... troca só o que dá
  const pago = pagar(m, 1550); // 15,5 po com 10 po: não cobre
  assert.equal(pago, null);
  assert.deepEqual(pagar({ pc: 0, pp: 0, pe: 0, po: 10, pl: 0 }, 450), { pc: 0, pp: 0, pe: 1, po: 5, pl: 0 }); // paga 5 po, volta 1 pe de troco
  const troco = pagar({ pc: 0, pp: 0, pe: 0, po: 1, pl: 0 }, 50)!;
  assert.equal(emOuro(troco), 0.5);
  assert.equal(emOuro(pagar({ pc: 5, pp: 3, pe: 0, po: 2, pl: 0 }, 235)!), (5 + 30 + 200 - 235) / 100);
});
