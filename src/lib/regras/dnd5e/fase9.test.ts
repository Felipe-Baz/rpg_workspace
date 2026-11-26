import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, atrDaMagia, cdMagia, classesDaFicha, limitesMagia, nivelNaClasse, normalizar, type Atributo, type FichaDnd } from "../../dnd5e.ts";
import { bloqueia } from "../sistema.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type ItemCat, type MulticlasseDados, type Raca } from "./catalogo.ts";
import { derivar, validar } from "./derivar.ts";
import { fichaEfetiva, gravavel } from "./efetiva.ts";
import { ajustarConjuracao, adicionarClasse, atendeRequisito, conferirRequisitos, contribuicaoConjurador, espacosMulticlasse, lerRequisito, textoRequisito } from "./multiclasse.ts";
import { podeAprender } from "./conjuracao.ts";
import { ativaveisDisponiveis } from "./combate.ts";
import { recursosDaFicha, testeAtaqueFurtivo } from "./recursos.ts";
import { subirNivel } from "./progressao.ts";
import type { Build } from "./build.ts";
import { magiaParaFicha, type MagiaCat } from "./magias.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const multi = lerJson<MulticlasseDados>("multiclasse");
const cat = criarCatalogo([{ id: "phb", nome: "x", racas: lerJson<Raca[]>("racas"), antecedentes: lerJson<Antecedente[]>("antecedentes"), classes: lerJson<ClasseCat[]>("classes"), equipamento: lerJson<ItemCat[]>("equipamento"), multiclasse: multi }]);
const magias = lerJson<MagiaCat[]>("magias");
const T = { multiclasse: true };

const attrs = (o: Partial<Record<Atributo, number>> = {}) => ({ for: 13, des: 13, con: 14, int: 13, sab: 13, car: 13, ...o });
const ficha = (b: Build, extra: Partial<FichaDnd> = {}): FichaDnd => normalizar({ ...FICHA_VAZIA, build: b, ...extra });
const base = (classes: Build["classes"], a = {}, extra: Partial<Build> = {}): Build => ({ classes, atributosBase: attrs(a), ...extra });

test("pré-requisitos do livro: ler o texto e conferir contra os atributos finais", () => {
  assert.deepEqual(lerRequisito("Força 13 ou Destreza 13"), [[{ atr: "for", min: 13 }], [{ atr: "des", min: 13 }]]);
  assert.deepEqual(lerRequisito("Destreza 13 e Sabedoria 13"), [[{ atr: "des", min: 13 }, { atr: "sab", min: 13 }]]);
  assert.equal(textoRequisito(lerRequisito("Força 13 e Carisma 13")), "FOR 13 e CAR 13");
  const t = (o: Partial<Record<Atributo, number>>) => ({ for: 8, des: 8, con: 8, int: 8, sab: 8, car: 8, ...o });
  assert.equal(atendeRequisito(lerRequisito("Força 13 ou Destreza 13"), t({ des: 13 })), true);
  assert.equal(atendeRequisito(lerRequisito("Força 13 e Carisma 13"), t({ for: 13 })), false);
  assert.equal(multi.prerequisitos.length, 12);
  for (const p of multi.prerequisitos) assert.ok(lerRequisito(p.requisito).length > 0, p.classe);
  const r = conferirRequisitos(["guerreiro", "paladino"], cat, t({ for: 13, car: 12 }));
  assert.deepEqual(r.map((x) => [x.classe, x.ok]), [["guerreiro", true], ["paladino", false]]);
});

test("espaços de magia: exemplo do livro (patrulheiro 4 / mago 3 = nível de conjurador 5)", () => {
  const r = espacosMulticlasse([{ id: "patrulheiro", nivel: 4 }, { id: "mago", nivel: 3 }], multi.espacosConjurador);
  assert.deepEqual([r.modo, r.nivelConjurador, r.espacos.slice(0, 4)], ["multiclasse", 5, [4, 3, 2, 0]]);
});

test("espaços de magia: metade, um terço (só com a subclasse), uma só conjuradora e pacto do bruxo", () => {
  assert.equal(contribuicaoConjurador({ id: "paladino", nivel: 5 }), 2);
  assert.equal(contribuicaoConjurador({ id: "guerreiro", nivel: 8, subclasse: "cavaleiro-arcano" }), 2);
  assert.equal(contribuicaoConjurador({ id: "guerreiro", nivel: 8 }), 0);
  assert.equal(contribuicaoConjurador({ id: "bruxo", nivel: 8 }), 0);
  const pc = espacosMulticlasse([{ id: "paladino", nivel: 5 }, { id: "clerigo", nivel: 3 }], multi.espacosConjurador);
  assert.deepEqual([pc.nivelConjurador, pc.espacos.slice(0, 3)], [5, [4, 3, 2]]);
  const ek = espacosMulticlasse([{ id: "guerreiro", nivel: 6, subclasse: "cavaleiro-arcano" }, { id: "mago", nivel: 3 }], multi.espacosConjurador);
  assert.equal(ek.nivelConjurador, 5);
  const so = espacosMulticlasse([{ id: "guerreiro", nivel: 5 }, { id: "mago", nivel: 3 }], multi.espacosConjurador); // só uma classe com Conjuração
  assert.deepEqual([so.modo, so.espacos.slice(0, 3)], ["classe", [4, 2, 0]]);
  const pacto = espacosMulticlasse([{ id: "bruxo", nivel: 2 }, { id: "mago", nivel: 3 }], multi.espacosConjurador);
  assert.deepEqual(pacto.espacos.slice(0, 3), [4 + 2, 2, 0]); // 2 espaços de pacto de 1º círculo somados
  assert.deepEqual(espacosMulticlasse([{ id: "guerreiro", nivel: 3 }, { id: "ladino", nivel: 3 }], multi.espacosConjurador).espacos, Array(9).fill(0));
  assert.equal(espacosMulticlasse([{ id: "clerigo", nivel: 1 }, { id: "druida", nivel: 1 }], multi.espacosConjurador).espacos[0], 3);
});

test("entrar numa classe nova: PV do dado da nova classe, histórico, nível total e proficiência", () => {
  const b0 = base([{ id: "guerreiro", nivel: 1, escolhas: { pericias: ["atletismo", "percepcao"] } }]);
  assert.equal(derivar(ficha(b0), cat, T).pvMax.total, 10 + 2);
  const b1 = adicionarClasse(b0, { id: "mago", pv: "medio" });
  assert.deepEqual(b1.classes.map((c) => `${c.id}${c.nivel}`), ["guerreiro1", "mago1"]);
  const c = derivar(ficha(b1), cat, T);
  assert.equal(c.nivel, 2);
  assert.equal(c.pvMax.total, 10 + 4 + 2 * 2); // d10 máximo + média do d6 (4) + Con +2 em cada nível
  assert.equal(adicionarClasse(b1, { id: "mago", pv: 3 }), b1); // não repete
  const b2 = subirNivel(b1, { classe: 1, pv: "medio" }); // 2º nível de mago
  const c2 = derivar(ficha(b2), cat, T);
  assert.equal(c2.nivel, 3);
  assert.equal(c2.pvMax.total, 10 + 4 + 4 + 3 * 2);
  assert.equal(c2.proficiencia, 2);
  const grande = adicionarClasse(base([{ id: "guerreiro", nivel: 5, escolhas: { pericias: [] } }]), { id: "ladino", pv: "medio" });
  assert.equal(derivar(ficha(grande), cat, T).proficiencia, 3); // nível 6
});

test("proficiências de multiclasse são só as da tabela; salvaguardas só da primeira classe", () => {
  const b = adicionarClasse(base([{ id: "mago", nivel: 1, escolhas: { pericias: ["arcanismo", "historia"] } }]), { id: "ladino", pv: "medio", escolhas: { pericias: ["furtividade"] } });
  const c = derivar(ficha(b), cat, T);
  assert.deepEqual(c.armaduras.map((a) => a.nome), ["leve"]);
  assert.ok(c.ferramentas.some((f) => f.nome === "Ferramentas de ladrão"));
  assert.equal(c.pericias.furtividade.nivel, 1);
  assert.equal(c.salvaguardasProf.int, true);
  assert.equal(c.salvaguardasProf.des, false); // salvaguardas do ladino não entram
  assert.ok(!c.armas.some((a) => /marciais/.test(a.nome)));
  const monge = derivar(ficha(adicionarClasse(base([{ id: "mago", nivel: 1, escolhas: { pericias: [] } }]), { id: "monge", pv: "medio" })), cat, T);
  assert.ok(monge.armas.some((a) => a.nome === "espada curta"));
  const barb = derivar(ficha(adicionarClasse(base([{ id: "mago", nivel: 1, escolhas: { pericias: [] } }]), { id: "barbaro", pv: "medio" })), cat, T);
  assert.deepEqual(barb.armaduras.map((a) => a.nome), ["escudo"]);
  assert.ok(barb.armas.some((a) => a.nome === "armas marciais"));
  const bardo = derivar(ficha(adicionarClasse(base([{ id: "guerreiro", nivel: 1, escolhas: { pericias: [] } }]), { id: "bardo", pv: "medio", escolhas: { pericias: ["religiao"], ferramentas: ["Alaúde"] } })), cat, T);
  assert.equal(bardo.pericias.religiao.nivel, 1);
  assert.ok(bardo.ferramentas.some((f) => f.nome === "Alaúde"));
});

test("validação: opção da mesa desligada bloqueia o jogador; perícia/instrumento pendentes e requisito viram aviso", () => {
  const b = adicionarClasse(base([{ id: "guerreiro", nivel: 1, escolhas: { pericias: [] } }], { for: 10 }), { id: "paladino", pv: "medio" });
  const f = ficha(b);
  const sem = validar(f, cat);
  assert.ok(sem.some((v) => v.id === "multiclasse.desligada"));
  assert.equal(bloqueia("jogador", sem), true);
  assert.equal(bloqueia("mestre", sem), false);
  const com = validar(f, cat, T);
  assert.equal(com.some((v) => v.id === "multiclasse.desligada"), false);
  assert.ok(com.some((v) => v.id === "multiclasse.requisito.paladino" && v.gravidade === "aviso" && /FOR 13 e CAR 13/.test(v.mensagem)));
  const bardo = validar(ficha(adicionarClasse(base([{ id: "guerreiro", nivel: 1, escolhas: { pericias: [] } }]), { id: "bardo", pv: "medio" })), cat, T);
  assert.ok(bardo.some((v) => v.id === "classe.pericias.pendente.bardo") && bardo.some((v) => v.id === "classe.instrumento.pendente.bardo"));
  const excesso = validar(ficha(adicionarClasse(base([{ id: "guerreiro", nivel: 1, escolhas: { pericias: [] } }]), { id: "mago", pv: "medio", escolhas: { pericias: ["arcanismo"] } })), cat, T);
  assert.ok(excesso.some((v) => v.id === "classe.pericias.excesso")); // mago não ganha perícia ao entrar
});

test("ficha efetiva: classes e níveis, subclasses juntas, limites de magia por classe, nada disso é gravado", () => {
  const b = adicionarClasse(base([{ id: "mago", nivel: 3, subclasse: "escola-de-evocacao", escolhas: { pericias: [] } }]), { id: "guerreiro", pv: "medio" });
  const f = ficha(b);
  const ef = fichaEfetiva(f, derivar(f, cat, T), cat);
  assert.deepEqual(ef.classes, [{ id: "mago", nivel: 3 }, { id: "guerreiro", nivel: 1 }]);
  assert.equal(ef.nivel, 4);
  assert.equal(ef.classe, "mago");
  assert.match(ef.subclasse, /Evocação/);
  assert.equal(nivelNaClasse(ef, "guerreiro"), 1);
  // só o mago conjura (3º nível, Int do build): limite por classe = limite do mago; o guerreiro sem subclasse conjuradora não soma
  const lim = limitesMagia({ ...ef, atrConjuracao: "int" });
  assert.equal(lim?.truques, 3);
  assert.equal(gravavel(f, { ...ef, classes: [{ id: "x", nivel: 9 }] }).classes, undefined);
  assert.deepEqual(classesDaFicha(normalizar({ classe: "mago", nivel: 5 })), [{ id: "mago", nivel: 5 }]);
  const unica = fichaEfetiva(ficha(base([{ id: "mago", nivel: 3, escolhas: { pericias: [] } }])), derivar(ficha(base([{ id: "mago", nivel: 3, escolhas: { pericias: [] } }])), cat), cat);
  assert.equal(unica.classes, undefined);
});

test("dado de vida principal: a classe com mais níveis", () => {
  const b = adicionarClasse(base([{ id: "mago", nivel: 5, escolhas: { pericias: [] } }]), { id: "guerreiro", pv: "medio" });
  assert.equal(derivar(ficha(b), cat, T).dadoVida, "d6");
  let b2 = b;
  for (let i = 0; i < 5; i++) b2 = subirNivel(b2, { classe: 1, pv: "medio" }); // guerreiro 6 contra mago 5
  assert.equal(derivar(ficha(b2), cat, T).dadoVida, "d10");
});

test("recursos e características usam o nível de CADA classe", () => {
  const f = normalizar({ ...FICHA_VAZIA, classe: "guerreiro", nivel: 8, classes: [{ id: "guerreiro", nivel: 5 }, { id: "mago", nivel: 3 }], atributos: { ...FICHA_VAZIA.atributos } });
  const ids = recursosDaFicha(f).map((r) => r.id);
  assert.deepEqual(ids, ["retomar-o-folego", "surto-de-acao", "recuperacao-arcana"]);
  assert.equal(recursosDaFicha(f).find((r) => r.id === "recuperacao-arcana")?.descricao.includes("até 2"), true); // metade de 3, para cima
  const f2 = normalizar({ ...FICHA_VAZIA, classe: "barbaro", nivel: 4, classes: [{ id: "barbaro", nivel: 1 }, { id: "ladino", nivel: 3 }] });
  assert.equal(recursosDaFicha(f2).find((r) => r.id === "furia")?.max, 2); // barbaro nível 1, não 4
  assert.equal(testeAtaqueFurtivo(f2)?.dado, "2d6"); // ladino 3 → metade, para cima
  assert.deepEqual(ativaveisDisponiveis(f2).map((a) => a.id), ["furia"]); // Ataque Descuidado só no 2º nível de bárbaro
  assert.deepEqual(ativaveisDisponiveis(normalizar({ ...FICHA_VAZIA, classe: "guerreiro", nivel: 4, classes: [{ id: "guerreiro", nivel: 3 }, { id: "mago", nivel: 1 }] })).map((a) => a.id), ["armadura-arcana"]);
});

test("CA: Defesa sem Armadura da primeira classe que tem; não acumula", () => {
  const b = adicionarClasse(base([{ id: "monge", nivel: 1, escolhas: { pericias: [] } }], { des: 14, con: 16, sab: 12 }), { id: "barbaro", pv: "medio" });
  assert.equal(derivar(ficha(b), cat, T).ca.total, 10 + 2 + 1); // monge: Des +2 e Sab +1; a de bárbaro (Con) não soma
  const b2 = adicionarClasse(base([{ id: "barbaro", nivel: 1, escolhas: { pericias: [] } }], { des: 14, con: 16, sab: 12 }), { id: "monge", pv: "medio" });
  assert.equal(derivar(ficha(b2), cat, T).ca.total, 10 + 2 + 3);
});

test("conjuração: espaços pela tabela de multiclasse e atributo por classe de origem", () => {
  const b = adicionarClasse(base([{ id: "mago", nivel: 3, escolhas: { pericias: [] } }], { int: 16, sab: 14 }), { id: "clerigo", pv: "medio" });
  const f = ficha(b);
  const ef = fichaEfetiva(f, derivar(f, cat, T), cat);
  const aj = ajustarConjuracao({ ...ef, espacos: ef.espacos.map(() => ({ total: 0, usados: 1 })) }, b, cat);
  assert.equal(aj.atrConjuracao, "int");
  assert.deepEqual(aj.espacos.slice(0, 3).map((e) => [e.total, e.usados]), [[4, 1], [3, 1], [0, 0]]); // nível de conjurador 4
  const m = magiaParaFicha(magias.find((x) => x.id === "curar-ferimentos")!, "m", true);
  const comOrigem = { ...m, classeOrigem: "clerigo" };
  const efc = { ...ef, atrConjuracao: "int" as const, nivel: 4 };
  assert.equal(atrDaMagia(efc, comOrigem), "sab");
  assert.equal(atrDaMagia(efc, m), "int");
  assert.equal(cdMagia(efc, comOrigem), 8 + 2 + 2); // Sab 14 (+2)
  assert.equal(cdMagia(efc, m), 8 + 2 + 3); // Int 16 (+3)
  const um = ajustarConjuracao(ef, base([{ id: "mago", nivel: 3, escolhas: { pericias: [] } }]), cat);
  assert.equal(um.espacos[0].total, 4); // uma classe: regras da própria classe
});

test("aprender magia: vale a lista de qualquer classe conjuradora do personagem", () => {
  const f = normalizar({ ...FICHA_VAZIA, classe: "guerreiro", nivel: 4, classes: [{ id: "guerreiro", nivel: 3 }, { id: "clerigo", nivel: 1 }], espacos: FICHA_VAZIA.espacos.map((e, i) => (i === 0 ? { total: 2, usados: 0 } : e)) });
  assert.equal(podeAprender(f, magias.find((m) => m.id === "curar-ferimentos")!).ok, true);
  assert.equal(podeAprender(f, magias.find((m) => m.id === "misseis-magicos")!).ok, false);
  assert.equal(podeAprender(normalizar({ ...FICHA_VAZIA, classe: "guerreiro", nivel: 4 }), magias.find((m) => m.id === "misseis-magicos")!).ok, true);
});
