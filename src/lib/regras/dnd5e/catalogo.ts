// Catálogo de conteúdo de D&D 5e atrás de uma interface única. O resto do código nunca importa os JSON direto:
// pede ao `Catalogo`. O conteúdo vem em PACOTES (`PacoteConteudo`): o Livro do Jogador (`phb`) agora; Xanathar,
// Tasha, homebrew do mestre etc. entram depois como novos pacotes, sem tocar no motor.

import type { Efeito } from "../efeitos.ts";

/** Todo item de catálogo diz de qual pacote veio (`phb`, `xge`, `mesa:<id>`...). */
export type Conteudo = { id: string; nome: string; pacote: string };

/** O que uma fonte concede além de números: proficiências, idiomas, resistências. Texto livre em português. */
export type Concessoes = {
  /** ids de perícia (`PericiaId`) */
  pericias?: string[];
  idiomas?: string[];
  armas?: string[];
  armaduras?: string[];
  ferramentas?: string[];
  resistencias?: string[];
};

export type EscolhaOpcao = { id: string; nome: string; descricao?: string; concede?: Concessoes };

/** Decisão do jogador oferecida por uma fonte (ex.: "dois atributos +1", "uma perícia", "ancestral dracônico"). */
export type EscolhaDef = {
  id: string;
  rotulo: string;
  tipo: "atributo" | "pericia" | "idioma" | "ferramenta" | "talento" | "truque" | "opcao";
  qtd: number;
  /** Para `atributo`: quanto soma a cada escolhido. */
  valor?: number;
  /** Lista fechada (ids ou opções com efeito). Ausente = qualquer do tipo. */
  opcoes?: (string | EscolhaOpcao)[];
  excluir?: string[];
  /** Para `truque`: lista de classe de onde sai. */
  lista?: string;
};

export type Traco = { id: string; nome: string; texto: string };

/** Raça, sub-raça, antecedente e talento são "fontes": declaram efeitos para o motor. */
export type ConteudoComEfeitos = Conteudo & {
  efeitos: Efeito[];
  concede?: Concessoes;
  escolhas?: EscolhaDef[];
  tracos?: Traco[];
};

export type SubRaca = ConteudoComEfeitos & {
  /** regra opcional da mesa que precisa estar ligada (ex.: "talentos") */
  requer?: string;
  /** Concessões da raça base que esta sub-raça substitui (ex.: Tiefling Ctônico troca a resistência a fogo). */
  retira?: Concessoes;
};
export type Raca = ConteudoComEfeitos & { tamanho?: string; deslocamento?: number; sub?: SubRaca[] };
export type Antecedente = ConteudoComEfeitos & {
  equipamento?: string;
  caracteristica?: { nome: string; texto: string };
  personalidade?: { tracos: string[]; ideais: string[]; vinculos: string[]; defeitos: string[] };
};
export type Talento = ConteudoComEfeitos & { prerequisito?: string; texto?: string };

export type CaracteristicaClasse = { id: string; nome: string; texto: string; nivel?: number };
export type Subclasse = Conteudo & { caracteristicas: { id: string; nome: string; texto: string }[] };
export type ClasseCat = Conteudo & {
  dadoVida: number;
  /** ids de atributo ("for", "con"...) */
  salvaguardas: string[];
  pericias?: { qtd: number; opcoes?: string[] };
  armaduras?: string;
  armas?: string;
  ferramentas?: string;
  subclasseRotulo?: string;
  subclasseNivel?: number;
  tabela?: { nivel: number; proficiencia: number; caracteristicas: { nome: string; ref?: string }[] }[];
  caracteristicas?: CaracteristicaClasse[];
  subclasses?: Subclasse[];
};

// ---------- equipamento ----------
export type Moeda = "pc" | "pp" | "pe" | "po" | "pl";
export type Preco = { valor: number; moeda: Moeda };
export type PropriedadesArma = {
  acuidade?: boolean; leve?: boolean; pesada?: boolean; duasMaos?: boolean; alcance?: boolean; recarga?: boolean; especial?: boolean;
  arremesso?: { normal: number; longo: number };
  versatil?: string;
  municao?: { normal: number; longo: number };
};
export type ArmaCat = Conteudo & {
  tipo: "arma"; categoria: "simples" | "marcial"; distancia: boolean; preco?: Preco;
  dado?: string; tipoDano?: string; peso: number; propriedades: PropriedadesArma;
};
export type ArmaduraCat = Conteudo & {
  tipo: "armadura"; categoria: "leve" | "media" | "pesada"; preco?: Preco; caBase: number; somaDes: boolean;
  maxDes?: number; forca?: number; furtividadeDesv?: boolean; peso: number;
};
export type EscudoCat = Conteudo & { tipo: "escudo"; categoria: "escudo"; preco?: Preco; bonusCa: number; peso: number };
export type ObjetoCat = Conteudo & { tipo: "item" | "ferramenta"; grupo?: string; preco?: Preco; peso: number };
export type PacoteItens = Conteudo & { tipo: "pacote"; preco: Preco; itens: { ref?: string; nome: string; qtd: number }[] };
export type ItemCat = ArmaCat | ArmaduraCat | EscudoCat | ObjetoCat | PacoteItens;

/** Dados de multiclasse do livro: pré-requisitos por classe e espaços de magia por nível de conjurador combinado. */
export type MulticlasseDados = { prerequisitos: { classe: string; requisito: string }[]; espacosConjurador: { nivel: number; espacos: number[] }[] };
const SEM_MULTICLASSE: MulticlasseDados = { prerequisitos: [], espacosConjurador: [] };

export type PacoteConteudo = {
  id: string;
  nome: string;
  racas?: Raca[];
  antecedentes?: Antecedente[];
  talentos?: Talento[];
  classes?: ClasseCat[];
  equipamento?: ItemCat[];
  multiclasse?: MulticlasseDados;
  // magias (carregadas à parte, ver magias.ts), equipamento etc. entram nas fases seguintes
};

export type Catalogo = {
  pacotes: readonly { id: string; nome: string }[];
  raca(id: string): Raca | undefined;
  antecedente(id: string): Antecedente | undefined;
  talento(id: string): Talento | undefined;
  classe(id: string): ClasseCat | undefined;
  item(id: string): ItemCat | undefined;
  equipamento(): ItemCat[];
  multiclasse(): MulticlasseDados;
  racas(): Raca[];
  antecedentes(): Antecedente[];
  talentos(): Talento[];
  classes(): ClasseCat[];
};

const CHAVES = ["racas", "antecedentes", "talentos", "classes", "equipamento"] as const;

/** Junta pacotes num catálogo. Id repetido no mesmo tipo é erro (evita um pacote sobrescrever o outro em silêncio). */
export function criarCatalogo(pacotes: readonly PacoteConteudo[]): Catalogo {
  const mapas = { racas: new Map<string, Raca>(), antecedentes: new Map<string, Antecedente>(), talentos: new Map<string, Talento>(), classes: new Map<string, ClasseCat>(), equipamento: new Map<string, ItemCat>() };
  for (const p of pacotes) {
    for (const k of CHAVES) {
      for (const c of (p[k] ?? []) as Conteudo[]) {
        const mapa = mapas[k] as Map<string, Conteudo>;
        if (mapa.has(c.id)) throw new Error(`Catálogo: id "${c.id}" (${k}) repetido no pacote "${p.id}"`);
        mapa.set(c.id, { ...c, pacote: c.pacote || p.id });
      }
    }
  }
  return {
    pacotes: pacotes.map((p) => ({ id: p.id, nome: p.nome })),
    raca: (id) => mapas.racas.get(id),
    antecedente: (id) => mapas.antecedentes.get(id),
    talento: (id) => mapas.talentos.get(id),
    classe: (id) => mapas.classes.get(id),
    item: (id) => mapas.equipamento.get(id),
    equipamento: () => [...mapas.equipamento.values()],
    multiclasse: () => pacotes.find((p) => p.multiclasse)?.multiclasse ?? SEM_MULTICLASSE,
    racas: () => [...mapas.racas.values()],
    antecedentes: () => [...mapas.antecedentes.values()],
    talentos: () => [...mapas.talentos.values()],
    classes: () => [...mapas.classes.values()],
  };
}

export const CATALOGO_VAZIO: Catalogo = criarCatalogo([]);

let phb: Promise<Catalogo> | undefined;
/** Catálogo do Livro do Jogador, carregado sob demanda (import dinâmico) e guardado em cache. */
export function carregarCatalogoPhb(): Promise<Catalogo> {
  phb ??= Promise.all([
    import("../../../data/dnd5e/phb/racas.json"),
    import("../../../data/dnd5e/phb/antecedentes.json"),
    import("../../../data/dnd5e/phb/talentos.json"),
    import("../../../data/dnd5e/phb/classes.json"),
    import("../../../data/dnd5e/phb/equipamento.json"),
    import("../../../data/dnd5e/phb/multiclasse.json"),
  ]).then(([r, a, t, c, e, m]) => criarCatalogo([{
    id: "phb", nome: "Livro do Jogador",
    racas: (r.default ?? r) as unknown as Raca[],
    antecedentes: (a.default ?? a) as unknown as Antecedente[],
    talentos: (t.default ?? t) as unknown as Talento[],
    classes: (c.default ?? c) as unknown as ClasseCat[],
    equipamento: (e.default ?? e) as unknown as ItemCat[],
    multiclasse: (m.default ?? m) as unknown as MulticlasseDados,
  }]));
  return phb;
}
