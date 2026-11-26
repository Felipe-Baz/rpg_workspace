import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar, type FichaDnd } from "../../dnd5e.ts";
import { criarCatalogo, type Antecedente, type ClasseCat, type ItemCat, type Raca } from "./catalogo.ts";
import { derivar, validar } from "./derivar.ts";
import { escolhasDaClasse, escolhasDoNivel } from "./escolhasClasse.ts";
import { subirNivel } from "./progressao.ts";
import { USOS_CATALOGO } from "./usosCatalogo.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const racas = lerJson<Raca[]>("racas");
const cat = criarCatalogo([{ id: "phb", nome: "Livro do Jogador", racas, antecedentes: lerJson<Antecedente[]>("antecedentes"), classes: lerJson<ClasseCat[]>("classes"), equipamento: lerJson<ItemCat[]>("equipamento") }]);

const ficha = (classe: string, nivel: number, sub: string | undefined, escolhas: Record<string, string[]>, extra: Partial<FichaDnd> = {}): FichaDnd => normalizar({
  ...FICHA_VAZIA, ...extra,
  build: { classes: [{ id: classe, nivel, ...(sub ? { subclasse: sub } : {}), escolhas: { pericias: [], ...escolhas } }], atributosBase: { for: 14, des: 14, con: 14, int: 10, sab: 10, car: 12 } },
});

test("raças: traços de todas as seções do livro entram (Tiefling, Meio-orc, Meio-elfo, Draconato, Gnomo)", () => {
  const ids = (r: string) => racas.find((x) => x.id === r)!.tracos!.map((t) => t.id);
  assert.ok(["visao-no-escuro", "resistencia-infernal", "legado-infernal", "idiomas"].every((t) => ids("tiefling").includes(t)));
  assert.ok(["ameacador", "resistencia-implacavel", "ataques-selvagens"].every((t) => ids("meio-orc").includes(t)));
  assert.ok(["ancestral-feerico", "versatilidade-em-pericia"].every((t) => ids("meio-elfo").includes(t)));
  assert.ok(["arma-de-sopro", "resistencia-a-dano"].every((t) => ids("draconato").includes(t)));
  assert.ok(ids("gnomo").includes("esperteza-gnomica"));
  for (const r of racas) assert.ok(!ids(r.id).includes("sub-raca"), `${r.id} traz o traço fantasma sub-raca`);
});

test("Tiefling Infernal: usos do Legado Infernal (3º e 5º nível)", () => {
  const ids = USOS_CATALOGO.filter((u) => u.subRaca === "tiefling-infernal").map((u) => [u.id, u.nivel]);
  assert.deepEqual(ids, [["magia-infernal-repreensao-infernal", 3], ["magia-infernal-escuridao", 5]]);
});

test("escolhas liberadas por nível e subclasse", () => {
  assert.deepEqual(escolhasDaClasse("guerreiro", 1).map((e) => e.id), ["estilo-de-luta"]);
  assert.deepEqual(escolhasDaClasse("paladino", 1).map((e) => e.id), []);
  assert.deepEqual(escolhasDoNivel("paladino", 2).map((e) => e.id), ["estilo-de-luta"]);
  assert.deepEqual(escolhasDaClasse("patrulheiro", 1).map((e) => e.id), ["inimigo-favorito", "idioma-inimigo", "terreno-favorito"]);
  assert.deepEqual(escolhasDaClasse("ladino", 1).map((e) => e.id), ["especializacao"]);
  assert.deepEqual(escolhasDaClasse("feiticeiro", 1, "magia-selvagem").map((e) => e.id), []);
  assert.deepEqual(escolhasDaClasse("feiticeiro", 1, "linhagem-draconica").map((e) => e.id), ["ancestral-draconico"]);
  assert.deepEqual(escolhasDaClasse("bardo", 1, undefined, false).map((e) => e.id), []); // multiclasse não repete os instrumentos
  assert.deepEqual(escolhasDaClasse("bardo", 1).map((e) => e.id), ["ferramentas"]);
});

test("Estilo de Luta Defesa soma +1 de CA só com armadura", () => {
  const cota = cat.item("cota-de-malha");
  const base = ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["defesa"] });
  assert.equal(derivar(base, cat).ca.total, 12);
  assert.ok(cota);
  const com = { ...base, itens: [{ id: "a", nome: "Cota de malha", quantidade: 1, peso: 25, equipado: true, descricao: "", catalogoId: cota.id }] } as FichaDnd;
  const sem = { ...com, build: { ...com.build!, classes: [{ ...com.build!.classes[0], escolhas: { pericias: [] } }] } } as FichaDnd;
  assert.equal(derivar(com, cat).ca.total, derivar(sem, cat).ca.total + 1);
});

test("Especialização do ladino dobra a proficiência da perícia escolhida", () => {
  const f = ficha("ladino", 1, undefined, { pericias: ["furtividade", "atletismo", "acrobacia", "enganacao"], especializacao: ["furtividade", "acrobacia"] });
  const c = derivar(f, cat);
  assert.equal(c.pericias.furtividade.nivel, 2);
  assert.equal(c.pericias.atletismo.nivel, 1);
  assert.ok(!validar(f, cat).some((v) => v.id.startsWith("escolha.pendente")));
  assert.ok(validar(ficha("ladino", 1, undefined, { pericias: ["furtividade"] }), cat).some((v) => v.id === "escolha.pendente.ladino.especializacao"));
});

test("Linhagem Dracônica: +1 PV por nível, CA 13 + Des e idioma Dracônico", () => {
  const f = ficha("feiticeiro", 3, "linhagem-draconica", { "ancestral-draconico": ["ouro"] });
  const s = ficha("feiticeiro", 3, "magia-selvagem", {});
  assert.equal(derivar(f, cat).pvMax.total, derivar(s, cat).pvMax.total + 3);
  assert.equal(derivar(f, cat).ca.total, 13 + 2);
  assert.ok(derivar(f, cat).idiomas.some((i) => i.nome === "Dracônico"));
});

test("domínios dão proficiências extras e o druida fala Druídico", () => {
  const guerra = derivar(ficha("clerigo", 1, "dominio-da-guerra", {}), cat);
  assert.ok(guerra.armaduras.some((a) => /pesadas/i.test(a.nome)));
  assert.ok(guerra.armas.some((a) => /marciais/i.test(a.nome)));
  assert.ok(derivar(ficha("druida", 1, undefined, {}), cat).idiomas.some((i) => i.nome === "Druídico"));
});

test("subir de nível grava as escolhas de classe do nível (Estilo de Luta do paladino no 2º)", () => {
  const f = ficha("paladino", 1, undefined, {});
  const b = subirNivel(f.build!, { classe: 0, pv: "medio", escolhasClasse: { "estilo-de-luta": ["duelismo"] } });
  assert.deepEqual(b.classes[0].escolhas?.["estilo-de-luta"], ["duelismo"]);
  assert.equal(b.classes[0].nivel, 2);
});

// ---------- magias concedidas ----------
import { aplicarMagiasConcedidas, magiasConcedidas } from "./magiasConcedidas.ts";
import { atrDaMagia, cdMagia } from "../../dnd5e.ts";
import type { MagiaCat } from "./magias.ts";

const magiasCat = lerJson<MagiaCat[]>("magias");

test("magias concedidas: todos os ids da tabela existem no catálogo de magias", () => {
  const ids = new Set(magiasCat.map((m) => m.id));
  const todas = new Set<string>();
  const subs = ["tiefling-infernal", "tiefling-abyssal", "tiefling-chthonic", "elfo-negro-drow"];
  for (const s of subs) for (const m of magiasConcedidas({ raca: { id: s.startsWith("tiefling") ? "tiefling" : "elfo", sub: s }, classes: [{ id: "guerreiro", nivel: 20 }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } }, [])) todas.add(m.catalogoId);
  for (const [classe, subs2] of [["clerigo", ["dominio-do-conhecimento", "dominio-da-enganacao", "dominio-da-guerra", "dominio-da-luz", "dominio-da-natureza", "dominio-da-tempestade", "dominio-da-vida", "dominio-da-morte"]], ["paladino", ["juramento-de-devocao", "juramento-dos-ancioes", "juramento-de-vinganca", "quebrador-de-juramento"]]] as const)
    for (const s of subs2) for (const m of magiasConcedidas({ classes: [{ id: classe, nivel: 20, subclasse: s }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } }, [])) todas.add(m.catalogoId);
  for (const t of ["ártico", "costa", "deserto", "floresta", "pradaria", "montanha", "pântano"])
    for (const m of magiasConcedidas({ classes: [{ id: "druida", nivel: 20, subclasse: "circulo-da-terra", escolhas: { "terreno-circulo": [t] } }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } }, [])) todas.add(m.catalogoId);
  const faltam = [...todas].filter((id) => !ids.has(id));
  assert.deepEqual(faltam, []);
  assert.ok(todas.size > 100);
});

test("magias concedidas entram como sempre preparadas, com o atributo do legado", () => {
  const b = { raca: { id: "tiefling", sub: "tiefling-chthonic", escolhas: { "atributo-conjuracao": ["sab"] } }, classes: [{ id: "guerreiro", nivel: 5 }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 16, car: 10 } };
  const c = magiasConcedidas(b, []);
  assert.deepEqual(c.map((m) => m.catalogoId).sort(), ["raio-do-enfraquecimento", "taumaturgia", "toque-arrepiante", "vitalidade-falsa"]);
  let n = 0;
  const f = aplicarMagiasConcedidas(normalizar({ ...FICHA_VAZIA, nivel: 5, atributos: { ...FICHA_VAZIA.atributos, sab: 16 }, build: b }), c, magiasCat, () => `m${n++}`);
  assert.equal(f.magias.length, 4);
  assert.ok(f.magias.every((m) => m.sempre && m.ativa && m.atributoConj === "sab"));
  assert.equal(atrDaMagia(f, f.magias[0]), "sab");
  assert.equal(cdMagia(f, f.magias[0]), 8 + 3 + 3);
  // aplicar de novo não duplica
  assert.equal(aplicarMagiasConcedidas(f, c, magiasCat, () => "x").magias.length, 4);
});

test("domínio da Luz: truque luz e magias de domínio por nível de clérigo", () => {
  const b = { classes: [{ id: "clerigo", nivel: 3, subclasse: "dominio-da-luz" }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 16, car: 10 } };
  assert.deepEqual(magiasConcedidas(b, []).map((m) => m.catalogoId), ["luz", "maos-flamejantes", "fogo-das-fadas", "esfera-flamejante", "raio-ardente"]);
});

test("truque do alto elfo vira magia concedida (Inteligência)", () => {
  const b = { raca: { id: "elfo", sub: "alto-elfo", escolhas: { truque: ["prestidigitacao"] } }, classes: [{ id: "guerreiro", nivel: 1 }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } };
  const fontes = derivar(normalizar({ ...FICHA_VAZIA, build: b }), cat).fontes;
  const c = magiasConcedidas(b, fontes);
  assert.deepEqual(c.map((m) => [m.catalogoId, m.atributo]), [["prestidigitacao", "int"]]);
});

test("sentidos: Visão no Escuro por raça; drow troca por Visão no Escuro Superior", () => {
  const sentidos = (raca: string, sub?: string) => derivar(normalizar({ ...FICHA_VAZIA, build: { raca: { id: raca, ...(sub ? { sub } : {}) }, classes: [{ id: "guerreiro", nivel: 1 }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } } }), cat).sentidos.map((s) => s.nome);
  assert.deepEqual(sentidos("tiefling", "tiefling-infernal"), ["Visão no Escuro 18 m"]);
  assert.deepEqual(sentidos("elfo", "elfo-negro-drow"), ["Visão no Escuro Superior 36 m"]);
  assert.deepEqual(sentidos("elfo", "alto-elfo"), ["Visão no Escuro 18 m"]);
  assert.deepEqual(sentidos("humano"), []);
});

test("variação de antecedente: pirata troca a característica; mercador troca a escolha de ferramenta", () => {
  const base = (ant: object) => normalizar({ ...FICHA_VAZIA, build: { antecedente: ant as never, classes: [{ id: "guerreiro", nivel: 1 }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } } });
  const pirata = derivar(base({ id: "marinheiro", variacao: "pirata" }), cat).fontes.find((f) => f.tipo === "antecedente")!;
  assert.equal(pirata.tracos.find((t) => t.id === "caracteristica")?.nome, "Má Reputação");
  const comum = derivar(base({ id: "marinheiro" }), cat).fontes.find((f) => f.tipo === "antecedente")!;
  assert.notEqual(comum.tracos.find((t) => t.id === "caracteristica")?.nome, "Má Reputação");
  const merc = derivar(base({ id: "artesao-de-guilda", variacao: "mercador-de-guilda", escolhas: { mercador: ["navegador"] } }), cat);
  assert.ok(merc.ferramentas.some((f) => /navega/i.test(f.nome)));
});

import { itensDoAntecedente } from "./equipamentoInicial.ts";
test("equipamento do antecedente vira itens (sem a bolsa de moedas)", () => {
  const ant = (id: string) => cat.antecedente(id)!.equipamento;
  const criminoso = itensDoAntecedente(ant("criminoso"), cat);
  assert.deepEqual(criminoso.map((i) => [i.nome, i.ref]), [["Pé de cabra", "pe-de-cabra"], ["Roupas comuns", "roupas-comuns"]]);
  const acolito = itensDoAntecedente(ant("acolito"), cat);
  assert.ok(acolito.some((i) => /incenso/i.test(i.nome) && i.qtd === 5));
  assert.ok(!acolito.some((i) => /algibeira/i.test(i.nome)));
  const art = itensDoAntecedente(ant("artesao-de-guilda"), cat, ["Ferramentas de ferreiro"]);
  assert.equal(art[0].nome, "Ferramentas de ferreiro");
  assert.ok(art[0].ref);
  const eremita = itensDoAntecedente(ant("eremita"), cat);
  assert.ok(eremita.length >= 4 && !eremita.some((i) => /^5 po|^e 5/.test(i.nome)));
  console.log(acolito.map((i) => `${i.qtd}x ${i.nome}${i.ref ? "*" : ""}`).join(" | "));
});

// ---------- metamagia, manobras, disciplinas, estilos, lembretes, capítulo 5 ----------
import { lembretesRaciais } from "./combate.ts";
import { semRepeticao } from "./escolhasClasse.ts";

test("metamagia, manobras e disciplinas: opções do livro por nível, sem repetir", () => {
  assert.deepEqual(escolhasDaClasse("feiticeiro", 3).filter((e) => e.id.startsWith("metamagia")).map((e) => [e.id, e.qtd]), [["metamagia", 2]]);
  assert.deepEqual(escolhasDaClasse("feiticeiro", 17).filter((e) => e.id.startsWith("metamagia")).map((e) => e.id), ["metamagia", "metamagia-10", "metamagia-17"]);
  assert.equal(escolhasDaClasse("feiticeiro", 3)[0].opcoes!.length, 8);
  assert.deepEqual(escolhasDaClasse("guerreiro", 3, "mestre-de-batalha").filter((e) => e.id.startsWith("manobras")).map((e) => [e.id, e.qtd]), [["manobras", 3]]);
  assert.equal(escolhasDaClasse("guerreiro", 3, "campeao").filter((e) => e.id.startsWith("manobras")).length, 0);
  const disc = escolhasDaClasse("monge", 3, "caminho-dos-quatro-elementos").find((e) => e.id === "disciplina-3")!;
  assert.ok(!disc.opcoes!.some((o) => typeof o !== "string" && /\(11º nível\)/.test(o.nome)), "disciplinas de nível alto não aparecem no 3º");
  assert.ok(!disc.opcoes!.some((o) => typeof o !== "string" && o.id === "sintonia-elemental"));
  const d11 = escolhasDaClasse("monge", 11, "caminho-dos-quatro-elementos").find((e) => e.id === "disciplina-11")!;
  assert.ok(d11.opcoes!.some((o) => typeof o !== "string" && /11º nível/.test(o.nome)));
  const todas = escolhasDaClasse("feiticeiro", 10);
  const m10 = semRepeticao(todas.find((e) => e.id === "metamagia-10")!, { metamagia: ["magia-acelerada", "magia-sutil"] }, todas);
  assert.equal(m10.opcoes!.length, 6);
});

test("metamagia escolhida vira traço com o texto do livro e some dos avisos", () => {
  const f = ficha("feiticeiro", 3, "magia-selvagem", { metamagia: ["magia-sutil", "magia-distante"] });
  const c = derivar(f, cat);
  assert.ok(c.fontes.find((x) => x.id === "feiticeiro")!.tracos.some((t) => /Magia Sutil/.test(t.nome)));
  assert.ok(!validar(f, cat).some((v) => v.id === "escolha.pendente.feiticeiro.metamagia"));
  assert.ok(validar(ficha("feiticeiro", 3, "magia-selvagem", {}), cat).some((v) => v.id === "escolha.pendente.feiticeiro.metamagia"));
});

test("estilos de luta: Arquearia e Duelismo mudam o ataque; Ataque Extra e Artes Marciais", () => {
  const arma = (catalogoId: string, nome: string) => ({ id: "w", nome, quantidade: 1, peso: 1, equipado: true, descricao: "", catalogoId });
  const arco = derivar(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["arquearia"] }, { itens: [arma("arco-longo", "Arco longo")] }), cat);
  const sem = derivar(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["defesa"] }, { itens: [arma("arco-longo", "Arco longo")] }), cat);
  assert.equal(arco.ataques.find((a) => a.id === "arma:w")!.bonusAtaque, sem.ataques.find((a) => a.id === "arma:w")!.bonusAtaque + 2);
  const espada = derivar(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["duelismo"] }, { itens: [arma("espada-longa", "Espada longa")] }), cat);
  assert.equal(espada.ataques.find((a) => a.id === "arma:w")!.bonusDano, 2);
  assert.equal(derivar(ficha("guerreiro", 5, undefined, {}), cat).ataquesPorAcao, 2);
  assert.equal(derivar(ficha("guerreiro", 11, undefined, {}), cat).ataquesPorAcao, 3);
  assert.equal(derivar(ficha("mago", 11, undefined, {}), cat).ataquesPorAcao, 1);
  const monge = derivar(ficha("monge", 5, undefined, {}), cat).ataques.find((a) => a.id === "arma:desarmado")!;
  assert.equal(monge.dano, "1d6");
  const ladino = derivar(ficha("ladino", 3, undefined, {}, { itens: [arma("rapieira", "Rapieira")] }), cat).ataques.find((a) => a.id === "arma:w")!;
  assert.match(ladino.notas ?? "", /Ataque Furtivo: \+2d6/);
});

test("lembretes raciais de salvaguarda e sensibilidade à luz", () => {
  assert.deepEqual(lembretesRaciais({ id: "anao" }, { tipo: "salvaguarda", atributo: "con" }), ["Resiliência Anã: vantagem contra veneno"]);
  assert.ok(lembretesRaciais({ id: "gnomo" }, { tipo: "salvaguarda", atributo: "sab" }).some((l) => /Esperteza Gnômica/.test(l)));
  assert.equal(lembretesRaciais({ id: "gnomo" }, { tipo: "salvaguarda", atributo: "for" }).length, 0);
  assert.ok(lembretesRaciais({ id: "elfo", sub: "elfo-negro-drow" }, { tipo: "ataque", corpo: true, atributo: "for" }).some((l) => /Sensibilidade/.test(l)));
  assert.equal(lembretesRaciais({ id: "humano" }, { tipo: "salvaguarda", atributo: "for" }).length, 0);
});

test("capítulo 5: montarias, veículos, comida e serviços entram no catálogo; 100 bugigangas", () => {
  const eq = lerJson<ItemCat[]>("equipamento");
  const grupo = (g: string) => eq.filter((i) => "grupo" in i && i.grupo === g);
  assert.equal(grupo("Montarias e outros animais").length, 8);
  assert.equal(grupo("Veículos aquáticos").length, 6);
  assert.ok(grupo("Arreios, selas e veículos de tração").some((i) => i.nome === "Sela de viagem"));
  assert.ok(grupo("Serviços").some((i) => i.nome === "Passagem de navio"));
  const cavalo = eq.find((i) => i.nome === "Cavalo de montaria") as { preco: { valor: number; moeda: string }; nota?: string };
  assert.deepEqual(cavalo.preco, { valor: 75, moeda: "po" });
  assert.match(cavalo.nota ?? "", /deslocamento 18m/);
  assert.equal(lerJson<string[]>("bugigangas").length, 100);
});

// ---------- subclasses conjuradoras, ações de opções, duas armas ----------
import { acoesDeOpcoes, custoDeChi } from "./opcoesAtivas.ts";
import { espacosDaSub, limitesMagia, subConjuradora } from "../../dnd5e.ts";
import { podeAprender } from "./conjuracao.ts";
import { fichaEfetiva } from "./efetiva.ts";
import { ajustarConjuracao } from "./multiclasse.ts";

const efetiva = (f: FichaDnd) => { const ef = fichaEfetiva(f, derivar(f, cat), cat); return { ...ef, ...ajustarConjuracao(ef, f.build!, cat) }; };

test("Cavaleiro Arcano: espaços, truques e magias conhecidas de um terço de conjurador", () => {
  assert.equal(subConjuradora("guerreiro", "Cavaleiro Arcano")?.id, "cavaleiro-arcano");
  assert.equal(subConjuradora("guerreiro", "Cavaleiro Místico")?.id, "cavaleiro-arcano");
  assert.equal(subConjuradora("guerreiro", "Campeão"), undefined);
  assert.equal(subConjuradora("ladino", "Trapaceiro Arcano")?.id, "trapaceiro-arcano");
  assert.deepEqual(espacosDaSub(3).slice(0, 2), [2, 0]);
  assert.deepEqual(espacosDaSub(7).slice(0, 3), [4, 2, 0]);
  assert.deepEqual(espacosDaSub(19).slice(0, 4), [4, 3, 3, 1]);
  const ek = efetiva(ficha("guerreiro", 7, "cavaleiro-arcano", {}));
  assert.equal(ek.atrConjuracao, "int");
  assert.deepEqual(ek.espacos.slice(0, 3).map((e) => e.total), [4, 2, 0]);
  assert.deepEqual(limitesMagia(ek), { truques: 2, magias: 5 });
  assert.deepEqual(limitesMagia(efetiva(ficha("ladino", 10, "trapaceiro-arcano", {}))), { truques: 3, magias: 7 });
  assert.equal(limitesMagia(efetiva(ficha("guerreiro", 2, "cavaleiro-arcano", {}))), null);
  assert.equal(limitesMagia(efetiva(ficha("guerreiro", 7, "campeao", {}))), null);
});

test("Cavaleiro Arcano só aprende abjuração/evocação (mais uma magia livre por nível da tabela)", () => {
  const magias = lerJson<MagiaCat[]>("magias");
  const doMago = (escola: string, nivel = 1) => magias.find((m) => m.classes.includes("mago") && m.escola === escola && m.nivel === nivel)!;
  const base = efetiva(ficha("guerreiro", 3, "cavaleiro-arcano", {}));
  assert.ok(podeAprender(base, doMago("evocação")).ok);
  assert.ok(podeAprender(base, doMago("abjuração")).ok);
  assert.ok(podeAprender(base, doMago("necromancia")).ok, "a primeira de outra escola é a livre do 3º nível");
  const comLivre = { ...base, magias: [{ id: "x", catalogoId: "y", nome: "y", nivel: 1, ativa: true, escola: "Necromancia", tempo: "", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des" } as FichaDnd["magias"][number]] };
  assert.equal(podeAprender(comLivre, doMago("ilusão")).ok, false);
  assert.ok(podeAprender({ ...comLivre, nivel: 8 }, doMago("ilusão")).ok, "no 8º nível ganha outra livre");
  assert.equal(podeAprender(base, magias.find((m) => !m.classes.includes("mago") && m.nivel === 1)!).ok, false);
  assert.equal(podeAprender(base, doMago("evocação", 2)).ok, false, "ainda sem espaços de 2º círculo");
});

test("ações de opções: metamagia, manobra, disciplina e sopro", () => {
  const sorc = acoesDeOpcoes(efetiva(ficha("feiticeiro", 3, "magia-selvagem", { metamagia: ["magia-acelerada", "magia-duplicada"] })));
  assert.deepEqual(sorc.map((a) => [a.nome, a.custo?.qtd, a.custoVariavel]), [["Magia Acelerada", 2, undefined], ["Magia Duplicada", 1, "nivel-da-magia"]]);
  const mb = acoesDeOpcoes(efetiva(ficha("guerreiro", 10, "mestre-de-batalha", { manobras: ["aparar"], "manobras-7": ["derrubar"] })));
  assert.equal(mb.length, 2);
  assert.equal(mb[0].teste?.dado, "1d10");
  assert.equal(mb[0].custo?.recurso, "superioridade-em-combate");
  const mg = acoesDeOpcoes(efetiva(ficha("monge", 3, "caminho-dos-quatro-elementos", { "disciplina-3": ["chicote-de-agua"] })));
  assert.ok(mg.some((a) => a.id === "disciplina-sintonia-elemental"));
  assert.equal(mg.find((a) => a.id === "disciplina-chicote-de-agua")?.custo?.qtd, 2);
  assert.equal(custoDeChi("Você pode gastar 4 pontos de chi para conjurar voo"), 4);
  const dr = normalizar({ ...FICHA_VAZIA, build: { raca: { id: "draconato", escolhas: { ancestral: ["ouro"] } }, classes: [{ id: "guerreiro", nivel: 6, escolhas: { pericias: [] } }], atributosBase: { for: 15, des: 10, con: 14, int: 10, sab: 10, car: 10 } } });
  const sopro = acoesDeOpcoes(efetiva(dr)).find((a) => a.id === "arma-de-sopro")!;
  assert.equal(sopro.teste?.dado, "3d6");
  assert.match(sopro.info ?? "", /cone de 4,5 m.*Destreza.*CD 13/);
  assert.match(sopro.nome, /fogo/);
});

test("estilos: Proteção e Armas Grandes viram ações; Duas Armas cria a linha da mão secundária", () => {
  assert.deepEqual(acoesDeOpcoes(efetiva(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["protecao"] }))).map((a) => a.reacao), [true]);
  assert.equal(acoesDeOpcoes(efetiva(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["armas-grandes"] })))[0].pedeFaces, true);
  const arma = (id: string, catalogoId: string) => ({ id, nome: catalogoId, quantidade: 1, peso: 1, equipado: true, descricao: "", catalogoId });
  const itens = [arma("a", "espada-curta"), arma("b", "adaga")];
  const com = derivar(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["duas-armas"] }, { itens }), cat).ataques.find((a) => a.id === "arma:b:sec")!;
  const sem = derivar(ficha("guerreiro", 1, undefined, { "estilo-de-luta": ["defesa"] }, { itens }), cat).ataques.find((a) => a.id === "arma:b:sec")!;
  assert.equal(com.bonusDano, 0);
  assert.ok(sem.bonusDano <= 0 && sem.bonusDano === -Math.max(0, 2), "sem o estilo o modificador positivo some do dano");
  assert.ok(!derivar(ficha("guerreiro", 1, undefined, {}, { itens: [arma("a", "espada-curta")] }), cat).ataques.some((a) => a.id.endsWith(":sec")), "com uma arma só não há mão secundária");
});

// ---------- multiclasse: limites por classe; Mão Mágica; idioma do inimigo; reação ----------
import { contagemPorClasse, limitesPorClasse, podeAtivar } from "../../dnd5e.ts";

test("multiclasse: limites de magias ativas por classe (mago 3 / clérigo 2)", () => {
  const ficha2 = normalizar({
    ...FICHA_VAZIA, nome: "M", atributos: { ...FICHA_VAZIA.atributos, int: 16, sab: 14 },
    build: { classes: [{ id: "mago", nivel: 3, escolhas: { pericias: [] } }, { id: "clerigo", nivel: 2, subclasse: "dominio-da-vida", escolhas: { pericias: [] } }], atributosBase: { for: 10, des: 10, con: 10, int: 16, sab: 14, car: 10 } },
  });
  const ef = { ...efetiva(ficha2), atributos: { ...FICHA_VAZIA.atributos, int: 16, sab: 14 } };
  assert.equal(ef.classes?.length, 2);
  const l = limitesPorClasse(ef)!;
  assert.deepEqual(l.map((x) => [x.classe, x.truques, x.magias]), [["mago", 3, 3 + 3], ["clerigo", 3, 2 + 2]]);
  assert.deepEqual(limitesMagia(ef), { truques: 6, magias: 10 });
  // quatro magias ativas de clérigo: a quinta é recusada, mas uma de mago ainda cabe
  const mk = (id: string, classeOrigem: string, ativa: boolean) => ({ id, catalogoId: id, classeOrigem, nome: id, nivel: 1, ativa, escola: "", tempo: "", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des" } as FichaDnd["magias"][number]);
  const cheio = { ...ef, magias: [mk("a", "clerigo", true), mk("b", "clerigo", true), mk("c", "clerigo", true), mk("d", "clerigo", true), mk("e", "clerigo", false), mk("f", "mago", false)] };
  assert.equal(podeAtivar(cheio, cheio.magias[4]), false);
  assert.equal(podeAtivar(cheio, cheio.magias[5]), true);
  assert.deepEqual(contagemPorClasse(cheio).map((c) => [c.classe, c.magiasAtivas, c.magias]), [["mago", 0, 6], ["clerigo", 4, 4]]);
});

test("Trapaceiro Arcano ganha Mão Mágica como truque extra no 3º nível", () => {
  const b = (nivel: number) => ({ classes: [{ id: "ladino", nivel, subclasse: "trapaceiro-arcano" }], atributosBase: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 } });
  assert.deepEqual(magiasConcedidas(b(3), []).map((m) => m.catalogoId), ["maos-magicas"]);
  assert.deepEqual(magiasConcedidas(b(2), []), []);
});

test("idioma do inimigo favorito é opcional e entra como idioma", () => {
  const f = ficha("patrulheiro", 1, undefined, { "inimigo-favorito": ["dragoes"], "terreno-favorito": ["floresta"], "idioma-inimigo": ["Dracônico"] });
  assert.ok(derivar(f, cat).idiomas.some((i) => i.nome === "Dracônico"));
  const sem = ficha("patrulheiro", 1, undefined, { "inimigo-favorito": ["bestas"], "terreno-favorito": ["floresta"] });
  assert.ok(!validar(sem, cat).some((v) => v.id.includes("idioma-inimigo")));
});
