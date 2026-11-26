import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHA_VAZIA, normalizar, type FichaDnd, type Item } from "../../dnd5e.ts";
import { criarCatalogo, type ClasseCat, type InvocacaoCat } from "./catalogo.ts";
import { derivar, validar } from "./derivar.ts";
import { fichaEfetiva } from "./efetiva.ts";
import { planoDeConjuracao } from "./conjuracao.ts";
import { magiaParaFicha, type MagiaCat } from "./magias.ts";
import { recursosCalculados, recursosDaFicha, restaurarRecursos, gastarRecurso } from "./recursos.ts";
import { subirNivel } from "./progressao.ts";
import {
  EFEITOS, armasParaPacto, conferirInvocacoes, definirArmaPacto, definirInvocacoes, invocacoesConhecidas, invocacoesDaFicha, pactoDaFicha, requisitosFaltando, truquesDaFicha,
} from "./invocacoes.ts";

const lerJson = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`../../../data/dnd5e/phb/${nome}.json`, import.meta.url), "utf8"));
const invocacoes = lerJson<InvocacaoCat[]>("invocacoes");
const classes = lerJson<ClasseCat[]>("classes");
const magias = lerJson<MagiaCat[]>("magias");
const equipamento = lerJson<import("./catalogo.ts").ItemCat[]>("equipamento");
const cat = criarCatalogo([{ id: "phb", nome: "Livro do Jogador", classes, invocacoes, equipamento }]);
const por = (id: string) => invocacoes.find((i) => i.id === id)!;

const bruxo = (nivel: number, escolhas: Record<string, string[]> = {}, extra: Partial<FichaDnd> = {}, car = 16): FichaDnd => normalizar({
  ...FICHA_VAZIA, ...extra,
  build: { classes: [{ id: "bruxo", nivel, subclasse: "o-corruptor", escolhas: { pericias: [], ...escolhas } }], atributosBase: { for: 10, des: 14, con: 12, int: 10, sab: 10, car } },
});

test("catálogo: 32 invocações do livro, com pré-requisitos lidos em dados", () => {
  assert.equal(invocacoes.length, 32);
  assert.equal(new Set(invocacoes.map((i) => i.id)).size, 32);
  assert.deepEqual(por("lamina-sedenta").requisitos, { nivel: 5, pacto: "lamina" });
  assert.deepEqual(por("explosao-agonizante").requisitos, { truque: "rajada-mistica" });
  assert.deepEqual(por("correntes-de-carceri").requisitos, { nivel: 15, pacto: "corrente" }); // o livro diz "Corrente de Cárceri", erro de tradução
  assert.equal(por("armadura-de-sombras").requisitos, undefined);
  for (const id of Object.keys(EFEITOS)) assert.ok(por(id), `efeito curado para id inexistente: ${id}`);
});

test("quantas invocações por nível (tabela do bruxo)", () => {
  assert.deepEqual([1, 2, 3, 4, 9, 12, 15, 18, 20].map(invocacoesConhecidas), [0, 2, 2, 3, 5, 6, 7, 8, 8]);
});

test("pré-requisitos: nível de bruxo, pacto e truque; aprende junto com o pré-requisito", () => {
  const ctx = { nivelBruxo: 5, pacto: "lamina", truques: ["rajada-mistica"] };
  assert.deepEqual(requisitosFaltando(por("lamina-sedenta"), ctx), []);
  assert.deepEqual(requisitosFaltando(por("lamina-sedenta"), { ...ctx, pacto: "tomo" }), ["Pacto da Lâmina"]);
  assert.deepEqual(requisitosFaltando(por("sorvedor-de-vida"), ctx), ["12º nível de bruxo"]);
  assert.deepEqual(requisitosFaltando(por("explosao-agonizante"), { ...ctx, truques: [] }), ["truque rajada mística"]);
  assert.deepEqual(requisitosFaltando(por("armadura-de-sombras"), { nivelBruxo: 2, truques: [] }), []);
});

test("Armadura de Sombras: sem armadura a CA é 13 + Des; com armadura vale a armadura", () => {
  const sem = bruxo(2, { invocacoes: [] });
  assert.equal(derivar(sem, cat).ca.total, 12); // 10 + Des 14 (+2)
  const com = bruxo(2, { invocacoes: ["armadura-de-sombras", "visao-diabolica"] });
  const ca = derivar(com, cat).ca;
  assert.equal(ca.total, 15);
  assert.ok(ca.partes.some((p) => p.rotulo === "Armadura de Sombras" && p.valor === 13));
  const couro: Item = { id: "i1", nome: "", quantidade: 1, peso: 0, equipado: true, descricao: "", catalogoId: "couro" };
  assert.equal(derivar({ ...com, itens: [couro] }, cat).ca.total, 13); // couro 11 + Des 2
  assert.equal(fichaEfetiva(com, derivar(com, cat), cat).ca, 15);
});

test("Armadura de Sombras com Defesa sem Armadura de outra classe: vale a melhor fórmula", () => {
  const f = normalizar({ ...FICHA_VAZIA, build: {
    classes: [{ id: "barbaro", nivel: 1, escolhas: { pericias: [] } }, { id: "bruxo", nivel: 2, escolhas: { pericias: [], invocacoes: ["armadura-de-sombras"] } }],
    atributosBase: { for: 10, des: 14, con: 20, int: 10, sab: 10, car: 10 },
  } });
  // Con +5: 10 + Des 2 + Con 5 = 17 vence 13 + 2 = 15
  assert.equal(derivar(f, cat, { multiclasse: true }).ca.total, 17);
});

test("Influência Enganadora concede Enganação e Persuasão, com a fonte", () => {
  const calc = derivar(bruxo(2, { invocacoes: ["influencia-enganadora", "visao-mistica"] }), cat);
  assert.equal(calc.pericias.enganacao?.nivel, 1);
  assert.equal(calc.pericias.persuasao?.nivel, 1);
  assert.ok(calc.pericias.persuasao.fontes.includes("Invocações Místicas"));
  assert.equal(derivar(bruxo(2), cat).pericias.persuasao, undefined);
});

test("traços: cada invocação e a Dádiva do Pacto aparecem na ficha, com o texto do livro", () => {
  const calc = derivar(bruxo(3, { invocacoes: ["visao-diabolica", "olhos-do-guardiao-das-runas"], pacto: ["tomo"] }), cat);
  const fonte = calc.fontes.find((f) => f.id === "invocacoes-misticas")!;
  assert.deepEqual(fonte.tracos.map((t) => t.nome), ["Dádiva do Pacto: Pacto do Tomo", "Visão Diabólica", "Olhos do Guardião das Runas"]);
  assert.match(fonte.tracos[1].texto, /36 metros/);
  assert.equal(derivar(bruxo(3), cat).fontes.some((f) => f.id === "invocacoes-misticas"), false);
});

test("usos: magias à vontade são ilimitadas; as de descanso longo têm 1 uso e voltam no descanso longo", () => {
  const f = bruxo(5, { invocacoes: ["visao-mistica", "encharcar-a-mente", "visao-diabolica"] });
  const defs = recursosDaFicha(f, { catalogo: cat });
  assert.deepEqual(defs.filter((d) => d.id.startsWith("invocacao-")).map((d) => [d.id, d.max, !!d.ilimitado, d.recarga]), [
    ["invocacao-visao-mistica", 1, true, "longo"], ["invocacao-encharcar-a-mente", 1, false, "longo"],
  ]); // visão diabólica é passiva: sem uso
  assert.equal(defs[0].nome, "Visão Mística");
  const gasto = gastarRecurso(f, defs, "invocacao-encharcar-a-mente");
  assert.equal(recursosCalculados(gasto, defs).find((r) => r.id === "invocacao-encharcar-a-mente")?.restantes, 0);
  assert.equal(recursosCalculados(restaurarRecursos(gasto, defs, "curto"), defs).find((r) => r.id === "invocacao-encharcar-a-mente")?.restantes, 0);
  assert.equal(recursosCalculados(restaurarRecursos(gasto, defs, "longo"), defs).find((r) => r.id === "invocacao-encharcar-a-mente")?.restantes, 1);
});

test("Rajada Mística: Explosão Agonizante soma Carisma por raio; Lança e Repulsiva viram lembretes", () => {
  const rajada = magias.find((m) => m.id === "rajada-mistica")!;
  const m = magiaParaFicha(rajada, "m1", true);
  const base = bruxo(5, { invocacoes: ["explosao-agonizante", "lanca-mistica", "explosao-repulsiva"] });
  const f = { ...fichaEfetiva(base, derivar(base, cat), cat), magias: [m] };
  const plano = planoDeConjuracao(f, m, rajada, 0);
  assert.equal(plano.dardos, 2);
  assert.deepEqual(plano.danos[0].partes, [{ rotulo: "Explosão Agonizante (Carisma)", valor: 3 }]);
  assert.equal(plano.notas?.length, 3);
  const sem = bruxo(5, { invocacoes: ["visao-mistica"] });
  const fs = { ...fichaEfetiva(sem, derivar(sem, cat), cat), magias: [m] };
  assert.deepEqual(planoDeConjuracao(fs, m, rajada, 0).danos[0].partes, []);
  assert.equal(planoDeConjuracao(fs, m, rajada, 0).notas, undefined);
});

test("conferência: pendentes e pacto são avisos; excesso e fora do catálogo; requisitos faltando", () => {
  const ids = (f: FichaDnd) => conferirInvocacoes(f, cat).map((p) => p.id);
  assert.deepEqual(ids(bruxo(1)), []);
  assert.deepEqual(ids(bruxo(2)), ["invocacoes.pendentes"]);
  assert.deepEqual(ids(bruxo(3, { invocacoes: ["visao-mistica", "visao-diabolica"] })), ["pacto.pendente"]);
  assert.deepEqual(ids(bruxo(3, { invocacoes: ["visao-mistica", "visao-diabolica"], pacto: ["tomo"] })), []);
  assert.deepEqual(ids(bruxo(2, { invocacoes: ["visao-mistica", "visao-diabolica", "idioma-bestial"] })), ["invocacoes.excesso"]);
  assert.deepEqual(ids(bruxo(2, { invocacoes: ["visao-mistica", "sorvedor-de-vida"] })), ["invocacao.requisito.sorvedor-de-vida"]);
  assert.deepEqual(ids(bruxo(2, { invocacoes: ["visao-mistica", "nao-existe"] })), ["invocacao.desconhecida.nao-existe"]);
  // validar: só o excesso bloqueia o jogador
  const graves = (f: FichaDnd) => validar(f, cat).filter((v) => v.gravidade !== "aviso").map((v) => v.id);
  assert.deepEqual(graves(bruxo(2)), []);
  assert.deepEqual(graves(bruxo(2, { invocacoes: ["visao-mistica", "visao-diabolica", "idioma-bestial"] })), ["invocacoes.excesso"]);
});

test("truque exigido: reconhece o da ficha (catálogo ou cadastrado à mão)", () => {
  const rajada = magiaParaFicha(magias.find((m) => m.id === "rajada-mistica")!, "m1", true);
  assert.deepEqual(truquesDaFicha({ magias: [rajada] }).includes("rajada-mistica"), true);
  const manual = { ...rajada, catalogoId: undefined, nome: "Rajada Mística" };
  assert.equal(truquesDaFicha({ magias: [manual] }).includes("rajada-mistica"), true);
  assert.equal(truquesDaFicha({ magias: [{ ...rajada, nivel: 1 }] }).includes("rajada-mistica"), false);
});

test("subir de nível do bruxo grava invocações e pacto na classe; outras classes não são tocadas", () => {
  const b = bruxo(2, { invocacoes: ["visao-mistica", "visao-diabolica"] }).build!;
  const n3 = subirNivel(b, { pv: "medio", invocacoes: ["visao-mistica", "idioma-bestial"], pacto: "corrente" });
  assert.equal(n3.classes[0].nivel, 3);
  assert.deepEqual(invocacoesDaFicha({ build: n3 }), ["visao-mistica", "idioma-bestial"]);
  assert.equal(pactoDaFicha({ build: n3 }), "corrente");
  assert.deepEqual(n3.classes[0].escolhas?.pericias, []); // o resto das escolhas fica
  assert.deepEqual(invocacoesDaFicha({ build: subirNivel(b, { pv: "medio" }) }), ["visao-mistica", "visao-diabolica"]); // sem mudança, mantém
  assert.deepEqual(invocacoesDaFicha({ build: definirInvocacoes(b, ["a", "a", "b"]) }), ["a", "b"]);
  const mago = { classes: [{ id: "mago", nivel: 1 }], atributosBase: b.atributosBase };
  assert.equal(subirNivel(mago, { pv: "medio", invocacoes: ["x"] }).classes[0].escolhas, undefined);
});

test("Arma do pacto: só no Pacto da Lâmina, proficiente, com Lâmina Sedenta e Sorvedor de Vida", () => {
  const com = (nivel: number, esc: Record<string, string[]>) => {
    const f = bruxo(nivel, esc, {}, 16);
    return derivar({ ...f, build: definirArmaPacto(f.build!, esc.armaPactoTeste?.[0] ?? "espada-longa") }, cat);
  };
  assert.ok(armasParaPacto(cat).every((a) => !a.distancia));
  const linha = (c: ReturnType<typeof derivar>) => c.ataques.find((a) => a.id === "arma:pacto");
  assert.equal(linha(com(3, { pacto: ["corrente"] })), undefined);
  assert.equal(linha(derivar(bruxo(3, { pacto: ["lamina"] }), cat)), undefined); // sem forma escolhida, sem linha
  const base = linha(com(3, { pacto: ["lamina"] }))!;
  assert.deepEqual([base.dano, base.tipoDano, base.atr, base.proficiente, base.bonusDano], ["1d8", "cortante", "for", true, 0]);
  assert.match(base.notas, /mágica/);
  const sedenta = linha(com(5, { pacto: ["lamina"], invocacoes: ["lamina-sedenta", "visao-mistica", "idioma-bestial"] }))!;
  assert.match(sedenta.notas, /2 ataques/);
  const sorvedor = linha(com(12, { pacto: ["lamina"], invocacoes: ["sorvedor-de-vida"] }))!;
  assert.equal(sorvedor.bonusDano, 3); // Car 16 → +3
  assert.match(sorvedor.notas, /necrótico/);
  // fica antes do ataque desarmado e vai para a ficha efetiva
  const f = bruxo(3, { pacto: ["lamina"] });
  const b2 = { ...f, build: definirArmaPacto(f.build!, "adaga") };
  const ids = fichaEfetiva(b2, derivar(b2, cat), cat).ataques.map((a) => a.id);
  assert.deepEqual(ids.slice(-2), ["arma:pacto", "arma:desarmado"]);
  assert.equal(derivar(b2, cat).ataques.find((a) => a.id === "arma:pacto")?.atr, "des"); // adaga tem acuidade e Des 14 > For 10
});
