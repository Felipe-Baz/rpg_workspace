// Escolhas de classe e de subclasse que o Livro do Jogador pede e o catálogo gerado (texto) não modela: Estilo de Luta,
// Especialização, Inimigo/Terreno Favorito, ancestral da Linhagem Dracônica, instrumentos do bardo, ferramenta do monge,
// perícias e idiomas de domínio. Tabela CURADA (ids estáveis em `build.classes[].escolhas`). Ver `derivar.ts`.

import type { Concessoes, EscolhaDef, EscolhaOpcao } from "./catalogo.ts";
import { DISCIPLINAS_ELEMENTAIS, MANOBRAS, METAMAGIAS, type OpcaoTexto } from "./opcoesClasse.ts";

/** Uma escolha liberada num nível da classe (ou, com `subclasse`, só para essa subclasse). */
export type EscolhaDeClasse = EscolhaDef & {
  nivel: number; subclasse?: string; apenasPrimeiraClasse?: boolean;
  /** Escolhas do mesmo grupo não repetem a mesma opção (ex.: as metamágicas dos níveis 3, 10 e 17). */
  grupo?: string;
  /** Pode ficar sem resposta (não vira pendência): ex.: o idioma do inimigo favorito, quando ele não fala nenhum. */
  opcional?: boolean;
};

const op = (id: string, nome: string, descricao: string, concede?: Concessoes): EscolhaOpcao => ({ id, nome, descricao, ...(concede ? { concede } : {}) });

// ---------- Estilo de Luta ----------
const ESTILOS: Record<string, EscolhaOpcao> = {
  arquearia: op("arquearia", "Arquearia", "Você ganha +2 de bônus nas jogadas de ataque com armas à distância."),
  defesa: op("defesa", "Defesa", "Enquanto estiver usando armadura, você ganha +1 de bônus na CA."),
  duelismo: op("duelismo", "Duelismo", "Empunhando uma arma corpo a corpo numa só mão e nenhuma outra arma, você ganha +2 de bônus nas jogadas de dano com ela."),
  "armas-grandes": op("armas-grandes", "Combate com Armas Grandes", "Com uma arma corpo a corpo de duas mãos, você pode jogar de novo um 1 ou 2 no dado de dano (e deve usar o novo resultado). A arma precisa ter a propriedade duas mãos ou versátil."),
  protecao: op("protecao", "Proteção", "Usando um escudo, você pode usar sua reação para impor desvantagem no ataque contra uma criatura a até 1,5 m de você, que não seja você."),
  "duas-armas": op("duas-armas", "Combate com Duas Armas", "Lutando com duas armas, você pode somar seu modificador de habilidade ao dano da segunda arma."),
};
const estilos = (...ids: string[]) => ids.map((i) => ESTILOS[i]);

// ---------- Patrulheiro ----------
const INIMIGOS = [
  "Aberrações", "Bestas", "Celestiais", "Constructos", "Dragões", "Elementais", "Fadas", "Infernais", "Gigantes", "Monstruosidades", "Limos", "Plantas", "Mortos-vivos",
].map((n) => op(n.toLowerCase(), n, `Inimigo favorito: ${n.toLowerCase()}. Vantagem em testes de Sabedoria (Sobrevivência) para rastreá-los e de Inteligência para lembrar informações sobre eles; aprenda um idioma que eles falem.`));
const INIMIGO_HUMANOIDES = op("humanoides", "Dois tipos de humanoides", "Inimigo favorito: escolha duas raças de humanoides (ex.: gnolls e orcs), anote nas anotações. Mesmos benefícios.");
const TERRENOS = ["Ártico", "Costa", "Deserto", "Floresta", "Pradaria", "Montanha", "Pântano", "Subterrâneo"]
  .map((n) => op(n.toLowerCase(), n, `Terreno favorito: ${n.toLowerCase()}. Benefícios de Explorador Nato nesse terreno (o dobro da proficiência em testes de Inteligência e Sabedoria ligados a ele, ao viajar etc.).`));
const inimigo = (id: string, nivel: number, rotulo = "Inimigo favorito"): EscolhaDeClasse => ({ id, rotulo, tipo: "opcao", qtd: 1, opcoes: [...INIMIGOS, INIMIGO_HUMANOIDES], nivel, grupo: "inimigo" });
const idiomaInimigo = (id: string, nivel: number): EscolhaDeClasse => ({ id, rotulo: "Idioma do inimigo favorito (se ele falar algum)", tipo: "idioma", qtd: 1, nivel, opcional: true });
const terreno = (id: string, nivel: number, rotulo = "Terreno favorito"): EscolhaDeClasse => ({ id, rotulo, tipo: "opcao", qtd: 1, opcoes: TERRENOS, nivel, grupo: "terreno" });

// ---------- Feiticeiro: Linhagem Dracônica ----------
const DRAGOES = ["Azul", "Branco", "Negro", "Verde", "Vermelho", "Bronze", "Cobre", "Latão", "Ouro", "Prata"].map((n) =>
  op(n.toLowerCase().replace("ã", "a"), n, `Ancestral dracônico: dragão ${n.toLowerCase()}. Você fala, lê e escreve Dracônico e seu ancestral define o tipo de dano da Afinidade Elemental (6º nível).`, { idiomas: ["Dracônico"] }));

// ---------- Metamagia, Manobras e Disciplinas Elementais (texto do livro, gerado em opcoesClasse.ts) ----------
const doTexto = (o: OpcaoTexto): EscolhaOpcao => ({ id: o.id, nome: o.nome, descricao: o.texto });
const metamagia = (id: string, nivel: number, qtd: number, rotulo: string): EscolhaDeClasse => ({ id, rotulo, tipo: "opcao", qtd, opcoes: METAMAGIAS.map(doTexto), nivel, grupo: "metamagia" });
const manobras = (id: string, nivel: number, qtd: number, rotulo: string): EscolhaDeClasse => ({ id, rotulo, tipo: "opcao", qtd, opcoes: MANOBRAS.map(doTexto), nivel, grupo: "manobras", subclasse: "mestre-de-batalha" });
// a Sintonia Elemental é aprendida de graça no 3º nível; as demais respeitam o nível pedido pela disciplina
const disciplina = (id: string, nivel: number, rotulo: string): EscolhaDeClasse => ({
  id, rotulo, tipo: "opcao", qtd: 1, nivel, grupo: "disciplina", subclasse: "caminho-dos-quatro-elementos",
  opcoes: DISCIPLINAS_ELEMENTAIS.filter((d) => d.id !== "sintonia-elemental" && (d.nivel ?? 1) <= nivel).map((d) => doTexto({ ...d, nome: d.nivel && d.nivel > 1 ? `${d.nome} (${d.nivel}º nível)` : d.nome })),
});

// ---------- instrumentos e ferramentas ----------
export const INSTRUMENTOS = ["Alaúde", "Flauta", "Flauta de pã", "Gaita de foles", "Lira", "Oboé", "Tambor", "Trombeta", "Violino", "Xilofone"];
export const FERRAMENTAS_ARTESAO = [
  "Ferramentas de carpinteiro", "Ferramentas de cartógrafo", "Ferramentas de costureiro", "Ferramentas de coureiro", "Ferramentas de entalhador", "Ferramentas de ferreiro",
  "Ferramentas de funileiro", "Ferramentas de joalheiro", "Ferramentas de oleiro", "Ferramentas de pedreiro", "Ferramentas de pintor", "Ferramentas de sapateiro",
  "Ferramentas de vidreiro", "Suprimentos de alquimista", "Suprimentos de cervejeiro", "Suprimentos de caligrafia", "Utensílios de cozinheiro",
];

export const ESCOLHAS_CLASSE: Record<string, EscolhaDeClasse[]> = {
  guerreiro: [
    manobras("manobras", 3, 3, "Manobras (3)"), manobras("manobras-7", 7, 2, "Manobras adicionais (7º nível)"), manobras("manobras-10", 10, 2, "Manobras adicionais (10º nível)"), manobras("manobras-15", 15, 2, "Manobras adicionais (15º nível)"),
    { id: "estudioso-ferramenta", rotulo: "Estudioso da Guerra: ferramenta de artesão", tipo: "ferramenta", qtd: 1, opcoes: FERRAMENTAS_ARTESAO, nivel: 3, subclasse: "mestre-de-batalha" },
    { id: "estilo-de-luta", rotulo: "Estilo de Luta", tipo: "opcao", qtd: 1, opcoes: estilos("arquearia", "defesa", "duelismo", "armas-grandes", "protecao", "duas-armas"), nivel: 1 }],
  paladino: [{ id: "estilo-de-luta", rotulo: "Estilo de Luta", tipo: "opcao", qtd: 1, opcoes: estilos("defesa", "duelismo", "armas-grandes", "protecao"), nivel: 2 }],
  patrulheiro: [
    inimigo("inimigo-favorito", 1), idiomaInimigo("idioma-inimigo", 1), terreno("terreno-favorito", 1, "Explorador Nato (terreno favorito)"),
    { id: "estilo-de-luta", rotulo: "Estilo de Luta", tipo: "opcao", qtd: 1, opcoes: estilos("arquearia", "defesa", "duelismo", "duas-armas"), nivel: 2 },
    terreno("terreno-favorito-6", 6, "Terreno favorito adicional"), inimigo("inimigo-favorito-6", 6, "Inimigo favorito adicional"), idiomaInimigo("idioma-inimigo-6", 6),
    terreno("terreno-favorito-10", 10, "Terreno favorito adicional"), inimigo("inimigo-favorito-14", 14, "Inimigo favorito adicional"), idiomaInimigo("idioma-inimigo-14", 14),
  ],
  ladino: [
    { id: "especializacao", rotulo: "Especialização (2 perícias)", tipo: "especializacao", qtd: 2, nivel: 1, grupo: "especializacao" },
    { id: "especializacao-6", rotulo: "Especialização (mais 2 perícias)", tipo: "especializacao", qtd: 2, nivel: 6, grupo: "especializacao" },
  ],
  bardo: [
    { id: "ferramentas", rotulo: "Instrumentos musicais", tipo: "ferramenta", qtd: 3, opcoes: INSTRUMENTOS, nivel: 1, apenasPrimeiraClasse: true },
    { id: "especializacao", rotulo: "Especialização (2 perícias)", tipo: "especializacao", qtd: 2, nivel: 3, grupo: "especializacao" },
    { id: "especializacao-10", rotulo: "Especialização (mais 2 perícias)", tipo: "especializacao", qtd: 2, nivel: 10, grupo: "especializacao" },
  ],
  monge: [
    disciplina("disciplina-3", 3, "Disciplina Elemental (além da Sintonia Elemental)"), disciplina("disciplina-6", 6, "Disciplina Elemental adicional (6º nível)"),
    disciplina("disciplina-11", 11, "Disciplina Elemental adicional (11º nível)"), disciplina("disciplina-17", 17, "Disciplina Elemental adicional (17º nível)"),
    { id: "ferramentas", rotulo: "Ferramenta de artesão ou instrumento", tipo: "ferramenta", qtd: 1, opcoes: [...FERRAMENTAS_ARTESAO, ...INSTRUMENTOS], nivel: 1, apenasPrimeiraClasse: true }],
  feiticeiro: [metamagia("metamagia", 3, 2, "Metamagia (2 opções)"), metamagia("metamagia-10", 10, 1, "Metamagia adicional (10º nível)"), metamagia("metamagia-17", 17, 1, "Metamagia adicional (17º nível)"), { id: "ancestral-draconico", rotulo: "Ancestral dracônico", tipo: "opcao", qtd: 1, opcoes: DRAGOES, nivel: 1, subclasse: "linhagem-draconica" }],
  clerigo: [
    { id: "dominio-idiomas", rotulo: "Idiomas do Domínio do Conhecimento", tipo: "idioma", qtd: 2, nivel: 1, subclasse: "dominio-do-conhecimento" },
    { id: "dominio-pericias", rotulo: "Perícias do Domínio do Conhecimento (em dobro)", tipo: "pericia", qtd: 2, opcoes: ["arcanismo", "historia", "natureza", "religiao"], nivel: 1, subclasse: "dominio-do-conhecimento" },
    { id: "dominio-pericia", rotulo: "Perícia do Domínio da Natureza", tipo: "pericia", qtd: 1, opcoes: ["adestrar", "natureza", "sobrevivencia"], nivel: 1, subclasse: "dominio-da-natureza" },
    { id: "dominio-truque", rotulo: "Truque de druida (Domínio da Natureza)", tipo: "truque", qtd: 1, lista: "druida", nivel: 1, subclasse: "dominio-da-natureza" },
  ],
  druida: [
    { id: "terreno-circulo", rotulo: "Terreno do Círculo da Terra", tipo: "opcao", qtd: 1, opcoes: ["Ártico", "Costa", "Deserto", "Floresta", "Pradaria", "Montanha", "Pântano"].map((n) => op(n.toLowerCase(), n, `Círculo da Terra (${n.toLowerCase()}): define as magias de círculo que você sempre tem preparadas.`)), nivel: 2, subclasse: "circulo-da-terra" },
    { id: "circulo-truque", rotulo: "Truque de druida adicional (Círculo da Terra)", tipo: "truque", qtd: 1, lista: "druida", nivel: 2, subclasse: "circulo-da-terra" },
  ],
};
// Colégio do Conhecimento (bardo, 3º nível): três perícias à escolha
ESCOLHAS_CLASSE.bardo.push({ id: "colegio-pericias", rotulo: "Perícias do Colégio do Conhecimento", tipo: "pericia", qtd: 3, nivel: 3, subclasse: "colegio-do-conhecimento" });

/** Proficiências e idiomas que o livro dá no momento em que a subclasse é obtida (texto do livro). */
export const CONCESSOES_SUBCLASSE: Record<string, Concessoes> = {
  "dominio-da-guerra": { armas: ["Armas marciais"], armaduras: ["Armaduras pesadas"] },
  "dominio-da-tempestade": { armas: ["Armas marciais"], armaduras: ["Armaduras pesadas"] },
  "dominio-da-vida": { armaduras: ["Armaduras pesadas"] },
  "dominio-da-natureza": { armaduras: ["Armaduras pesadas"] },
  "dominio-da-morte": { armas: ["Armas marciais"] },
  "colegio-da-bravura": { armaduras: ["Armaduras médias", "Escudos"], armas: ["Armas marciais"] },
};

/** Concessões fixas da classe que não dependem de escolha (ex.: o idioma Druídico). Só a primeira classe as recebe. */
export const CONCESSOES_CLASSE: Record<string, Concessoes> = { druida: { idiomas: ["Druídico"] } };

/** Escolhas da classe já liberadas no nível dado (e da subclasse, quando escolhida). */
export function escolhasDaClasse(classeId: string, nivel: number, subclasseId?: string, primeira = true): EscolhaDeClasse[] {
  return (ESCOLHAS_CLASSE[classeId] ?? []).filter((e) => e.nivel <= nivel && (!e.subclasse || e.subclasse === subclasseId) && (primeira || !e.apenasPrimeiraClasse));
}

/** Escolhas liberadas exatamente neste nível (o assistente de subida pergunta só estas). */
/** A mesma definição sem as opções que o personagem já escolheu em outras escolhas do mesmo grupo. */
export function semRepeticao(def: EscolhaDeClasse, atuais: Record<string, string[]>, todas: EscolhaDeClasse[]): EscolhaDeClasse {
  if (!def.grupo || !def.opcoes || (def.tipo !== "opcao" && def.tipo !== "especializacao")) return def;
  const usadas = new Set(todas.filter((d) => d.grupo === def.grupo && d.id !== def.id).flatMap((d) => atuais[d.id] ?? []));
  return { ...def, opcoes: def.opcoes.filter((o) => !usadas.has(typeof o === "string" ? o : o.id)) };
}

export function escolhasDoNivel(classeId: string, nivel: number, subclasseId?: string, primeira = true): EscolhaDeClasse[] {
  return escolhasDaClasse(classeId, nivel, subclasseId, primeira).filter((e) => e.nivel === nivel);
}

/** O texto do livro das opções escolhidas, para a aba Traços. */
export function tracosDeEscolhas(defs: EscolhaDef[], sel: Record<string, string[]> | undefined): { id: string; nome: string; texto: string }[] {
  const out: { id: string; nome: string; texto: string }[] = [];
  for (const d of defs) {
    if (d.tipo !== "opcao") continue;
    for (const v of (sel?.[d.id] ?? []).slice(0, d.qtd)) {
      const o = (d.opcoes ?? []).find((x): x is EscolhaOpcao => typeof x !== "string" && x.id === v);
      if (o) out.push({ id: `${d.id}-${o.id}`, nome: `${d.rotulo}: ${o.nome}`, texto: o.descricao ?? "" });
    }
  }
  return out;
}

/** Perícias com especialização escolhidas pela classe (Ladino, Bardo e o Domínio do Conhecimento). */
export function especializacoesDaClasse(classe: { id: string; subclasse?: string; escolhas?: Record<string, string[]> }): string[] {
  const e = classe.escolhas ?? {};
  const ids = Object.entries(e).filter(([k]) => k.startsWith("especializacao")).flatMap(([, v]) => v);
  if (classe.subclasse === "dominio-do-conhecimento") ids.push(...(e["dominio-pericias"] ?? []));
  return ids;
}

/** Linhagem Dracônica: PV +1 por nível e CA 13 + Des sem armadura. */
export const temLinhagemDraconica = (classes: { id: string; subclasse?: string }[]) => classes.some((c) => c.id === "feiticeiro" && c.subclasse === "linhagem-draconica");

/** Estilos de Luta escolhidos (ids). */
export const estilosDeLuta = (classes: { escolhas?: Record<string, string[]> }[]): string[] => classes.flatMap((c) => c.escolhas?.["estilo-de-luta"] ?? []);
