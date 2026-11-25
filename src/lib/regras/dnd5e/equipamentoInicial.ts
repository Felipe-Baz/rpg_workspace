// Equipamento inicial de cada classe (Livro do Jogador, cap. 3), como o livro escreve: grupos de "(a) ... ou (b) ...".
// Cada grupo com uma só opção é fixo. Itens "à escolha" (qualquer arma simples, foco arcano...) viram um seletor que lista
// itens do catálogo. Funções puras: a tela só pergunta e chama `itensDaOpcao`.

import type { ArmaCat, Catalogo, ItemCat } from "./catalogo.ts";

export type Seletor = "simples" | "marcial" | "simples-cac" | "marcial-cac" | "instrumento" | "foco-arcano" | "foco-druidico" | "simbolo-sagrado";

/** Item do equipamento inicial: do catálogo (`ref`), ou um seletor ("qualquer arma simples"). */
export type ItemInicial = { ref?: string; qtd?: number; escolher?: Seletor; rotulo?: string };
export type OpcaoInicial = { rotulo: string; itens: ItemInicial[] };
/** Um grupo do livro: uma ou mais opções (a/b/c). */
export type GrupoInicial = OpcaoInicial[];

const o = (rotulo: string, ...itens: ItemInicial[]): OpcaoInicial => ({ rotulo, itens });
const i = (ref: string, qtd = 1): ItemInicial => ({ ref, qtd });
const q = (escolher: Seletor, rotulo: string, qtd = 1): ItemInicial => ({ escolher, rotulo, qtd });
const fixo = (rotulo: string, ...itens: ItemInicial[]): GrupoInicial => [o(rotulo, ...itens)];

const PACOTE = (id: string, nome: string) => o(`Pacote de ${nome}`, i(`pacote-de-${id}`));
const BESTA = o("Besta leve e 20 virotes", i("besta-leve"), i("virotes-20"));
const SIMPLES = o("Qualquer arma simples", q("simples", "arma simples"));
const FOCO_ARCANO = o("Foco arcano", q("foco-arcano", "foco arcano"));
const BOLSA = o("Bolsa de componentes", i("bolsa-de-componentes"));

export const EQUIPAMENTO_INICIAL: Record<string, GrupoInicial[]> = {
  barbaro: [
    [o("Machado grande", i("machado-grande")), o("Qualquer arma marcial corpo a corpo", q("marcial-cac", "arma marcial corpo a corpo"))],
    [o("Dois machados de mão", i("machadinha", 2)), SIMPLES],
    fixo("Pacote de aventureiro e quatro azagaias", i("pacote-de-aventureiro"), i("azagaia", 4)),
  ],
  bardo: [
    [o("Rapieira", i("rapieira")), o("Espada longa", i("espada-longa")), SIMPLES],
    [PACOTE("diplomata", "diplomata"), PACOTE("artista", "artista")],
    [o("Alaúde", i("alaude")), o("Outro instrumento musical", q("instrumento", "instrumento musical"))],
    fixo("Armadura de couro e uma adaga", i("couro"), i("adaga")),
  ],
  bruxo: [
    [BESTA, SIMPLES],
    [BOLSA, FOCO_ARCANO],
    [PACOTE("estudioso", "estudioso"), PACOTE("explorador", "explorador")],
    fixo("Armadura de couro, uma arma simples e duas adagas", i("couro"), q("simples", "arma simples"), i("adaga", 2)),
  ],
  clerigo: [
    [o("Maça", i("maca")), o("Martelo de guerra (se proficiente)", i("martelo-de-guerra"))],
    [o("Brunea", i("brunea")), o("Armadura de couro", i("couro")), o("Cota de malha (se proficiente)", i("cota-de-malha"))],
    [BESTA, SIMPLES],
    [PACOTE("sacerdote", "sacerdote"), PACOTE("aventureiro", "aventureiro")],
    fixo("Um escudo e um símbolo sagrado", i("escudo"), q("simbolo-sagrado", "símbolo sagrado")),
  ],
  druida: [
    [o("Escudo de madeira", i("escudo")), SIMPLES],
    [o("Cimitarra", i("cimitarra")), o("Qualquer arma simples corpo a corpo", q("simples-cac", "arma simples corpo a corpo"))],
    [PACOTE("estudioso", "estudioso"), PACOTE("explorador", "explorador")],
    fixo("Armadura de couro, pacote de aventureiro e um foco druídico", i("couro"), i("pacote-de-aventureiro"), q("foco-druidico", "foco druídico")),
  ],
  feiticeiro: [
    [BESTA, SIMPLES],
    [BOLSA, FOCO_ARCANO],
    [PACOTE("explorador", "explorador"), PACOTE("aventureiro", "aventureiro")],
  ],
  guerreiro: [
    [o("Cota de malha", i("cota-de-malha")), o("Gibão de peles, arco longo e 20 flechas", i("gibao-de-peles"), i("arco-longo"), i("flechas-20"))],
    [o("Uma arma marcial e um escudo", q("marcial", "arma marcial"), i("escudo")), o("Duas armas marciais", q("marcial", "primeira arma marcial"), q("marcial", "segunda arma marcial"))],
    [BESTA, o("Dois machados de arremesso", i("machadinha", 2))],
    [PACOTE("aventureiro", "aventureiro"), PACOTE("explorador", "explorador")],
  ],
  ladino: [
    [o("Rapieira", i("rapieira")), o("Espada longa", i("espada-longa"))],
    [o("Arco curto e aljava com 20 flechas", i("arco-curto"), i("aljava"), i("flechas-20")), o("Espada curta", i("espada-curta"))],
    [PACOTE("assaltante", "assaltante"), PACOTE("aventureiro", "aventureiro"), PACOTE("explorador", "explorador")],
    fixo("Armadura de couro, duas adagas e ferramentas de ladrão", i("couro"), i("adaga", 2), i("ferramentas-de-ladrao")),
  ],
  mago: [
    [o("Bordão", i("bordao")), o("Adaga", i("adaga"))],
    [BOLSA, FOCO_ARCANO],
    [PACOTE("estudioso", "estudioso"), PACOTE("explorador", "explorador")],
    fixo("Um grimório", i("grimorio")),
  ],
  monge: [
    [o("Espada curta", i("espada-curta")), SIMPLES],
    [PACOTE("explorador", "explorador"), PACOTE("aventureiro", "aventureiro")],
    fixo("10 dardos", i("dardo", 10)),
  ],
  paladino: [
    [o("Uma arma marcial e um escudo", q("marcial", "arma marcial"), i("escudo")), o("Duas armas marciais", q("marcial", "primeira arma marcial"), q("marcial", "segunda arma marcial"))],
    [o("Cinco azagaias", i("azagaia", 5)), o("Qualquer arma simples corpo a corpo", q("simples-cac", "arma simples corpo a corpo"))],
    [PACOTE("sacerdote", "sacerdote"), PACOTE("aventureiro", "aventureiro")],
    fixo("Cota de malha e um símbolo sagrado", i("cota-de-malha"), q("simbolo-sagrado", "símbolo sagrado")),
  ],
  patrulheiro: [
    [o("Brunea", i("brunea")), o("Armadura de couro", i("couro"))],
    [o("Duas espadas curtas", i("espada-curta", 2)), o("Duas armas simples corpo a corpo", q("simples-cac", "primeira arma simples corpo a corpo"), q("simples-cac", "segunda arma simples corpo a corpo"))],
    [PACOTE("explorador", "explorador"), PACOTE("aventureiro", "aventureiro")],
    fixo("Arco longo e aljava com 20 flechas", i("arco-longo"), i("aljava"), i("flechas-20")),
  ],
};

const FOCOS: Record<"foco-arcano" | "foco-druidico" | "simbolo-sagrado", string[]> = {
  "foco-arcano": ["cristal", "orbe", "bastao", "cajado", "varinha"],
  "foco-druidico": ["cajado-de-madeira", "ramo-de-visco", "totem", "varinha-de-teixo"],
  "simbolo-sagrado": ["amuleto", "emblema", "relicario"],
};

/** Itens do catálogo que um seletor oferece. */
export function itensDoSeletor(s: Seletor, cat: Catalogo): ItemCat[] {
  switch (s) {
    case "simples": case "marcial": case "simples-cac": case "marcial-cac": {
      const categoria = s.startsWith("simples") ? "simples" : "marcial";
      const cac = s.endsWith("-cac");
      return cat.equipamento().filter((x): x is ArmaCat => x.tipo === "arma" && x.categoria === categoria && (!cac || !x.distancia));
    }
    case "instrumento": return cat.equipamento().filter((x) => x.tipo === "ferramenta" && x.grupo === "Instrumento musical");
    default: return FOCOS[s].map((id) => cat.item(id)).filter((x): x is ItemCat => !!x);
  }
}

/** Chave estável de um item "à escolha" dentro do equipamento (grupo, opção, posição). */
export const chaveEscolha = (grupo: number, opcao: number, item: number) => `${grupo}.${opcao}.${item}`;

/** Resolve uma opção em itens do catálogo com quantidade; `escolhas` traz o id escolhido de cada seletor. Falta escolha = omite o item. */
export function itensDaOpcao(op: OpcaoInicial, grupo: number, indiceOpcao: number, escolhas: Record<string, string>, cat: Catalogo): { item: ItemCat; qtd: number }[] {
  const saida: { item: ItemCat; qtd: number }[] = [];
  op.itens.forEach((it, k) => {
    const id = it.ref ?? escolhas[chaveEscolha(grupo, indiceOpcao, k)];
    const item = id ? cat.item(id) : undefined;
    if (item) saida.push({ item, qtd: it.qtd ?? 1 });
  });
  return saida;
}

/** Falta escolher alguma coisa (opção de um grupo ou item de um seletor)? */
export function equipamentoPendente(classeId: string, opcaoPorGrupo: Record<number, number>, escolhas: Record<string, string>): number {
  const grupos = EQUIPAMENTO_INICIAL[classeId] ?? [];
  let faltam = 0;
  grupos.forEach((g, gi) => {
    const oi = g.length === 1 ? 0 : opcaoPorGrupo[gi];
    if (oi === undefined) { faltam++; return; }
    g[oi].itens.forEach((it, k) => { if (it.escolher && !escolhas[chaveEscolha(gi, oi, k)]) faltam++; });
  });
  return faltam;
}

/** Ouro que a bolsa do antecedente traz ("uma algibeira contendo 15 po"). */
export const ouroDoAntecedente = (equipamento?: string): number => Number(/(\d+)\s*po\b/i.exec(equipamento ?? "")?.[1] ?? 0);
