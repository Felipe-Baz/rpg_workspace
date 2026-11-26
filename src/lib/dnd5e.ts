// Ficha de personagem de D&D 5e: modelo, regras derivadas (modificadores, bônus de proficiência, perícias,
// espaços de magia) e montagem de rolagens "1d20 + 5 (Carisma) + 2 (Proficiência)". Puro e testável.
// As rolagens não são automáticas: o jogador pode rolar no site ou usar os dados da mesa e só conferir a conta.

import type { Build } from "./regras/dnd5e/build.ts";

export const ATRIBUTOS =["for", "des", "con", "int", "sab", "car"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export const ATRIBUTO_NOME: Record<Atributo, string> = {
  for: "Força", des: "Destreza", con: "Constituição", int: "Inteligência", sab: "Sabedoria", car: "Carisma",
};

export const PERICIAS = [
  { id: "acrobacia", nome: "Acrobacia", atr: "des" },
  { id: "adestrar", nome: "Adestrar Animais", atr: "sab" },
  { id: "arcanismo", nome: "Arcanismo", atr: "int" },
  { id: "atletismo", nome: "Atletismo", atr: "for" },
  { id: "atuacao", nome: "Atuação", atr: "car" },
  { id: "enganacao", nome: "Enganação", atr: "car" },
  { id: "furtividade", nome: "Furtividade", atr: "des" },
  { id: "historia", nome: "História", atr: "int" },
  { id: "intimidacao", nome: "Intimidação", atr: "car" },
  { id: "intuicao", nome: "Intuição", atr: "sab" },
  { id: "investigacao", nome: "Investigação", atr: "int" },
  { id: "medicina", nome: "Medicina", atr: "sab" },
  { id: "natureza", nome: "Natureza", atr: "int" },
  { id: "percepcao", nome: "Percepção", atr: "sab" },
  { id: "persuasao", nome: "Persuasão", atr: "car" },
  { id: "prestidigitacao", nome: "Prestidigitação", atr: "des" },
  { id: "religiao", nome: "Religião", atr: "int" },
  { id: "sobrevivencia", nome: "Sobrevivência", atr: "sab" },
] as const satisfies readonly { id: string; nome: string; atr: Atributo }[];
export type PericiaId = (typeof PERICIAS)[number]["id"];

/** 0 = sem proficiência, 1 = proficiente, 2 = especialista (bônus dobrado). */
export type NivelProf = 0 | 1 | 2;

export type Ataque = {
  id: string;
  nome: string;
  atr: Atributo; // atributo usado no ataque e no dano
  proficiente: boolean;
  bonusAtaque: number; // bônus mágico/extra no acerto
  dano: string; // ex.: "1d8"
  bonusDano: number; // extra no dano (além do modificador)
  tipoDano: string;
  notas: string;
  /** Linha calculada a partir de uma arma equipada (não é gravada; editar a arma no inventário). */
  derivado?: boolean;
};

export type TipoAtaqueMagia = "nenhum" | "ataque" | "salvaguarda";
export type Magia = {
  id: string;
  /** Id da magia no catálogo (`regras/dnd5e/magias`), quando veio de lá. Cadastro manual não tem. */
  catalogoId?: string;
  /** Classe pela qual a magia é conjurada (multiclasse): define o atributo de conjuração dela. */
  classeOrigem?: string;
  nome: string;
  nivel: number; // 0 = truque
  /** Ativa = conta nos limites da classe e pode ser conjurada. Inativas ficam só no "pool" da ficha. */
  ativa: boolean;
  escola: string;
  tempo: string;
  alcance: string;
  componentes: string;
  duracao: string;
  descricao: string;
  /** Vindos do catálogo: exige concentração / pode ser conjurada como ritual. */
  concentracao?: boolean;
  ritual?: boolean;
  /** Sempre preparada (domínio, juramento...): não conta nos limites e está sempre pronta. */
  sempre?: boolean;
  tipo: TipoAtaqueMagia;
  dano: string; // ex.: "8d6" (vazio = sem rolagem de dano)
  salvaguarda: Atributo; // usada quando tipo = "salvaguarda"
};

/** Habilidade com usos limitados cadastrada à mão (ex.: um traço de raça ou subclasse que o motor não conhece). */
export type Habilidade = {
  id: string;
  nome: string;
  /** Usos por recarga (1 a 99). */
  max: number;
  /** `manual`: nenhum descanso devolve; o jogador repõe. */
  recarga: "curto" | "longo" | "manual";
  /** Origem (ex.: "Halfling", "Sortudo") e texto de consulta. */
  fonte: string;
  descricao: string;
};

export type Item = {
  id: string;
  nome: string;
  quantidade: number;
  peso: number; // por unidade, em kg (0 = sem peso)
  equipado: boolean;
  descricao: string;
  /** Id no catálogo de equipamento (`regras/dnd5e`), quando veio de lá. */
  catalogoId?: string;
  /** Bônus mágico de arma (ataque e dano) ou armadura/escudo (CA). */
  bonusMagico?: number;
  /** Bônus à CA de um item que não é armadura (anel de proteção, manto...) enquanto equipado. */
  bonusCa?: number;
  exigeSintonia?: boolean;
  sintonizado?: boolean;
};

export type Espaco = { total: number; usados: number };

export const ALINHAMENTOS = ["Leal e Bom", "Neutro e Bom", "Caótico e Bom", "Leal e Neutro", "Neutro", "Caótico e Neutro", "Leal e Mau", "Neutro e Mau", "Caótico e Mau"];

export type FichaDnd = {
  nome: string;
  /** Classe do personagem (uma das classes do livro). "" = não escolhida. */
  classe: ClasseId | "";
  subclasse: string;
  nivel: number;
  antecedente: string;
  raca: string;
  alinhamento: string;
  xp: number;
  inspiracao: boolean;

  atributos: Record<Atributo, number>;
  salvaguardas: Record<Atributo, boolean>;
  pericias: Partial<Record<PericiaId, NivelProf>>;
  bonusPericias: Partial<Record<PericiaId, number>>; // extras (itens, talentos)

  ca: number;
  bonusIniciativa: number;
  deslocamento: string;
  pvMax: number;
  pv: number;
  pvTemp: number;
  dadoVida: string; // ex.: "d8"
  dadosVidaTotal: number;
  dadosVidaUsados: number;
  morteSucessos: number;
  morteFalhas: number;
  descansosCurtos: number; // usados desde o último descanso longo (máx. MAX_DESCANSOS_CURTOS)

  ataques: Ataque[];

  atrConjuracao: Atributo | "";
  espacos: Espaco[]; // índice 0 = 1º círculo ... 8 = 9º
  magias: Magia[];
  /** Ajustes raros somados aos limites de magias ativas da classe (itens mágicos, talentos). Negativos reduzem. */
  ajusteLimites: { truques: number; magias: number };

  moedas: { pc: number; pp: number; pe: number; po: number; pl: number };
  itens: Item[];
  equipamento: string; // anotações livres sobre o equipamento (e itens do formato antigo)
  tracos: string; // características de classe, raça e talentos
  proficienciasIdiomas: string;
  personalidade: string;
  ideais: string;
  vinculos: string;
  defeitos: string;
  aparencia: string;
  tituloLivro: string; // vazio = "A Crônica de {nome}"
  livro: string[]; // história do personagem, uma página por item
  notas: string;
  /** Escolhas do jogador para a ficha automatizada (opcional: fichas antigas não têm). Ver `regras/dnd5e`. */
  build?: Build;
  /** `rascunho` (padrão, tudo editável) ou `publicada` (identidade, atributos e proficiências travados para o jogador). */
  status?: "rascunho" | "publicada";
  /** Só na ficha efetiva e só com multiclasse: o nível em cada classe (nunca gravado). */
  classes?: { id: string; nivel: number }[];
  /** Magia mantida em concentração (id da magia na ficha). Só uma por vez. */
  concentracao?: { magiaId: string; nome: string };
  /** Usos gastos de cada recurso (Fúria, Ki...), por id; o máximo é calculado pela classe e nível. */
  recursos?: Record<string, number>;
  /** Habilidades com usos cadastradas pelo jogador (raça, subclasse, talento, item). Os usos gastos vão em `recursos["hab-{id}"]`. */
  habilidades?: Habilidade[];
  /** Forma Selvagem do druida: a fera assumida (id em `feras.json`) e os PV dela. Enquanto existe, a ficha efetiva usa os números da fera. */
  forma?: { feraId: string; pv: number };
  /** Características ligadas agora (furia, ataque-descuidado...). Encerram no descanso. */
  ativos?: string[];
  /** Condições do Apêndice A aplicadas (ids); "inconsciente" a 0 PV é implícita. */
  condicoes?: string[];
  /** Nível de exaustão (0 a 6). */
  exaustao?: number;
  /** Resistências, vulnerabilidades e imunidades manuais (tipos de dano), além das calculadas. */
  defesas?: { resistencias: string[]; vulnerabilidades: string[]; imunidades: string[] };
};

export const FICHA_VAZIA: FichaDnd = {
  nome: "", classe: "", subclasse: "", nivel: 1, antecedente: "", raca: "", alinhamento: "", xp: 0, inspiracao: false,
  atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
  salvaguardas: { for: false, des: false, con: false, int: false, sab: false, car: false },
  pericias: {}, bonusPericias: {},
  ca: 10, bonusIniciativa: 0, deslocamento: "9 m", pvMax: 10, pv: 10, pvTemp: 0,
  dadoVida: "d8", dadosVidaTotal: 1, dadosVidaUsados: 0, morteSucessos: 0, morteFalhas: 0, descansosCurtos: 0,
  ataques: [],
  atrConjuracao: "",
  espacos: Array.from({ length: 9 }, () => ({ total: 0, usados: 0 })),
  magias: [],
  ajusteLimites: { truques: 0, magias: 0 },
  moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
  itens: [], equipamento: "", tracos: "", proficienciasIdiomas: "", personalidade: "", ideais: "", vinculos: "", defeitos: "",
  aparencia: "", tituloLivro: "", livro: [""], notas: "",
};

/** Completa campos que faltam (fichas antigas ou parciais) sem perder nada do que já existe. */
export function normalizar(parcial: Partial<FichaDnd> | undefined): FichaDnd {
  const p = parcial ?? {};
  const espacos = Array.from({ length: 9 }, (_, i) => ({ ...FICHA_VAZIA.espacos[i], ...(p.espacos?.[i] ?? {}) }));
  // fichas antigas: `classe` era texto livre e a classe conjuradora ficava em `classeConj`
  const antigo = p as { classeConj?: string; ajusteLimites?: { truques?: number; magias?: number } };
  const textoClasse = typeof p.classe === "string" ? p.classe : "";
  const classe: ClasseId | "" = ehClasseId(textoClasse) ? textoClasse
    : ehClasseId(antigo.classeConj ?? "") ? (antigo.classeConj as ClasseId) : classeDeTexto(textoClasse);
  const textoSobra = textoClasse && !ehClasseId(textoClasse) && !p.subclasse ? textoClasse : "";
  return {
    ...FICHA_VAZIA,
    ...p,
    classe,
    subclasse: p.subclasse || textoSobra,
    ajusteLimites: { truques: antigo.ajusteLimites?.truques ?? 0, magias: antigo.ajusteLimites?.magias ?? 0 },
    magias: (p.magias ?? []).map((m) => {
      const { preparada, ...resto } = m as Magia & { preparada?: boolean };
      const preparaMagias = !!classe && (modoDe(classe) === "preparadas" || modoDe(classe) === "grimorio");
      return { ...resto, ativa: m.ativa ?? (m.nivel === 0 || !preparaMagias ? true : (preparada ?? true)) };
    }),
    atributos: { ...FICHA_VAZIA.atributos, ...p.atributos },
    salvaguardas: { ...FICHA_VAZIA.salvaguardas, ...p.salvaguardas },
    moedas: { ...FICHA_VAZIA.moedas, ...p.moedas },
    pericias: p.pericias ?? {},
    bonusPericias: p.bonusPericias ?? {},
    ataques: p.ataques ?? [],
    itens: p.itens ?? [],
    // fichas antigas guardavam a história num texto único (`historia`)
    livro: p.livro ?? ((p as { historia?: string }).historia ? [(p as { historia?: string }).historia!] : [""]),
    espacos,
  };
}

// ---------- regras derivadas ----------
export const modificador = (valor: number) => Math.floor((valor - 10) / 2);
export const bonusProficiencia = (nivel: number) => 2 + Math.floor((Math.min(Math.max(nivel, 1), 20) - 1) / 4);
export const modDe = (f: FichaDnd, a: Atributo) => modificador(f.atributos[a]);
export const comSinal = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export function bonusPericia(f: FichaDnd, id: PericiaId): number {
  const def = PERICIAS.find((p) => p.id === id)!;
  const nivel = f.pericias[id] ?? 0;
  return modDe(f, def.atr) + nivel * bonusProficiencia(f.nivel) + (f.bonusPericias[id] ?? 0);
}
export const bonusSalvaguarda = (f: FichaDnd, a: Atributo) => modDe(f, a) + (f.salvaguardas[a] ? bonusProficiencia(f.nivel) : 0);
export const bonusIniciativa = (f: FichaDnd) => modDe(f, "des") + f.bonusIniciativa;
export const percepcaoPassiva = (f: FichaDnd) => 10 + bonusPericia(f, "percepcao");
/** Classes e níveis da ficha: o que o `build` diz (multiclasse) ou, sem ele, a classe única com o nível total. */
export const classesDaFicha = (f: Pick<FichaDnd, "classe" | "nivel" | "classes">): { id: string; nivel: number }[] =>
  f.classes && f.classes.length ? f.classes : f.classe ? [{ id: f.classe, nivel: f.nivel }] : [];
/** Nível do personagem numa classe (0 se não tem). */
export const nivelNaClasse = (f: Pick<FichaDnd, "classe" | "nivel" | "classes">, id: string) => classesDaFicha(f).find((c) => c.id === id)?.nivel ?? 0;

/** Atributo de conjuração de uma magia: o da classe pela qual ela é conjurada (multiclasse) ou o da ficha. */
export const atrDaMagia = (f: FichaDnd, m?: Pick<Magia, "classeOrigem">): Atributo | "" =>
  m?.classeOrigem && ehConjuradora(m.classeOrigem as ClasseId) ? CLASSES_CONJ[m.classeOrigem as ClasseConjId].atr : f.atrConjuracao;
export const cdMagia = (f: FichaDnd, m?: Pick<Magia, "classeOrigem">) => { const a = atrDaMagia(f, m); return a ? 8 + bonusProficiencia(f.nivel) + modDe(f, a) : 0; };
export const bonusAtaqueMagia = (f: FichaDnd, m?: Pick<Magia, "classeOrigem">) => { const a = atrDaMagia(f, m); return a ? bonusProficiencia(f.nivel) + modDe(f, a) : 0; };

// ---------- espaços de magia ----------
// Índice = nível de conjurador - 1; cada linha = espaços do 1º ao 9º círculo.
const TABELA_COMPLETO: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Totais de espaços por círculo para conjurador completo ou meio-conjurador (paladino, patrulheiro). */
export function espacosPorNivel(tipo: "completo" | "meio", nivel: number): number[] {
  const n = Math.min(Math.max(Math.floor(nivel), 1), 20);
  const idx = tipo === "completo" ? n : n < 2 ? 0 : Math.ceil(n / 2);
  const linha = idx === 0 ? [] : TABELA_COMPLETO[idx - 1];
  return Array.from({ length: 9 }, (_, i) => linha[i] ?? 0);
}

// ---------- classes ----------
export const CLASSES = [
  { id: "barbaro", nome: "Bárbaro" }, { id: "bardo", nome: "Bardo" }, { id: "bruxo", nome: "Bruxo" }, { id: "clerigo", nome: "Clérigo" },
  { id: "druida", nome: "Druida" }, { id: "feiticeiro", nome: "Feiticeiro" }, { id: "guerreiro", nome: "Guerreiro" }, { id: "ladino", nome: "Ladino" },
  { id: "mago", nome: "Mago" }, { id: "monge", nome: "Monge" }, { id: "paladino", nome: "Paladino" }, { id: "patrulheiro", nome: "Patrulheiro" },
] as const;
export type ClasseId = (typeof CLASSES)[number]["id"];
export const ehClasseId = (s: string): s is ClasseId => CLASSES.some((c) => c.id === s);
export const nomeClasse = (id: ClasseId | "") => CLASSES.find((c) => c.id === id)?.nome ?? "";

const semAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Reconhece uma classe num texto livre ("Mago 5", "Guerreiro 3 / Ladino 2" → a que aparece primeiro). "" se nenhuma. */
export function classeDeTexto(texto: string): ClasseId | "" {
  const t = semAcentos(texto);
  let achada: ClasseId | "" = "", pos = Infinity;
  for (const c of CLASSES) {
    const i = t.search(new RegExp(`\\b${semAcentos(c.nome)}`));
    if (i >= 0 && i < pos) { pos = i; achada = c.id; }
  }
  return achada;
}

// ---------- classes conjuradoras (limites de magias ativas) ----------
// Todas as magias ficam cadastradas na ficha; o limite vale só para as ATIVAS (as demais ficam de reserva).
// preparadas: prepara parte da lista da classe a cada descanso longo (clérigo, druida, paladino).
// grimorio:   anota magias num grimório e prepara parte delas (mago).
// conhecidas: conhece um número fixo de magias (bardo, feiticeiro, bruxo, patrulheiro).
export type ClasseConjId = "bardo" | "bruxo" | "clerigo" | "druida" | "feiticeiro" | "mago" | "paladino" | "patrulheiro";
type ModoConj = "preparadas" | "grimorio" | "conhecidas";
type ClasseConj = {
  nome: string; atr: Atributo; modo: ModoConj; espacos: "completo" | "meio" | "pacto";
  /** Truques por nível (índice = nível - 1). */
  truques: (n: number) => number;
  /** conhecidas: tabela por nível (índice = nível - 1). */
  conhecidas?: number[];
};
const faixa = (a: number, b: number, c: number) => (n: number) => (n >= 10 ? c : n >= 4 ? b : a);
const nenhum = () => 0;

export const CLASSES_CONJ: Record<ClasseConjId, ClasseConj> = {
  bardo: { nome: "Bardo", atr: "car", modo: "conhecidas", espacos: "completo", truques: faixa(2, 3, 4), conhecidas: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22] },
  bruxo: { nome: "Bruxo", atr: "car", modo: "conhecidas", espacos: "pacto", truques: faixa(2, 3, 4), conhecidas: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
  clerigo: { nome: "Clérigo", atr: "sab", modo: "preparadas", espacos: "completo", truques: faixa(3, 4, 5) },
  druida: { nome: "Druida", atr: "sab", modo: "preparadas", espacos: "completo", truques: faixa(2, 3, 4) },
  feiticeiro: { nome: "Feiticeiro", atr: "car", modo: "conhecidas", espacos: "completo", truques: faixa(4, 5, 6), conhecidas: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15] },
  mago: { nome: "Mago", atr: "int", modo: "grimorio", espacos: "completo", truques: faixa(3, 4, 5) },
  paladino: { nome: "Paladino", atr: "car", modo: "preparadas", espacos: "meio", truques: nenhum },
  patrulheiro: { nome: "Patrulheiro", atr: "sab", modo: "conhecidas", espacos: "meio", truques: nenhum, conhecidas: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] },
};

const nivelValido = (n: number) => Math.min(Math.max(Math.floor(n), 1), 20);

/** Espaços de magia da classe no nível. Bruxo: espaços de pacto (todos no mesmo círculo). */
export function espacosDaClasse(id: ClasseConjId, nivel: number): number[] {
  const c = CLASSES_CONJ[id];
  const n = nivelValido(nivel);
  if (c.espacos !== "pacto") return espacosPorNivel(c.espacos, n);
  const circulo = Math.min(5, Math.ceil(n / 2));
  const total = n >= 17 ? 4 : n >= 11 ? 3 : n >= 2 ? 2 : 1;
  return Array.from({ length: 9 }, (_, i) => (i + 1 === circulo ? total : 0));
}

export const ehConjuradora = (id: ClasseId | ""): id is ClasseConjId => id in CLASSES_CONJ;
export const modoDe = (id: ClasseId | ""): ModoConj | undefined => (ehConjuradora(id) ? CLASSES_CONJ[id].modo : undefined);

export type LimitesMagia = {
  /** Máximo de truques ativos. */
  truques: number;
  /** Máximo de magias ativas de 1º círculo em diante (preparadas ou conhecidas, conforme a classe). */
  magias: number;
};

/** Limites de magias ATIVAS (classe + nível + ajustes). null = classe sem conjuração ou não escolhida (sem limites). */
export function limitesMagia(f: FichaDnd): LimitesMagia | null {
  if (f.classes && f.classes.length > 1) return null; // multiclasse: limites por classe ainda não são calculados (ver pendências)
  if (!ehConjuradora(f.classe)) return null;
  const c = CLASSES_CONJ[f.classe];
  const n = nivelValido(f.nivel);
  const aj = f.ajusteLimites;
  const truques = Math.max(0, c.truques(n) + aj.truques);
  const base = c.modo === "conhecidas"
    ? c.conhecidas![n - 1]
    : Math.max(1, (f.classe === "paladino" ? Math.floor(n / 2) : n) + modDe(f, c.atr));
  return { truques, magias: Math.max(0, base + aj.magias) };
}

/** Contagens de magias ativas contra os limites. `cheio*` só é verdadeiro quando há limite. */
export function contagemMagias(f: FichaDnd) {
  const lim = limitesMagia(f);
  const truques = f.magias.filter((m) => m.nivel === 0 && m.ativa && !m.sempre).length;
  const magias = f.magias.filter((m) => m.nivel > 0 && m.ativa && !m.sempre).length;
  return {
    lim, truques, magias,
    totalTruques: f.magias.filter((m) => m.nivel === 0).length,
    totalMagias: f.magias.filter((m) => m.nivel > 0).length,
    truquesCheio: !!lim && truques >= lim.truques,
    magiasCheio: !!lim && magias >= lim.magias,
  };
}

/** A magia pode ser ativada agora? (inativa e ainda há vaga no limite do seu tipo; sem limites, sempre.) */
export function podeAtivar(f: FichaDnd, m: Magia): boolean {
  if (m.ativa) return false;
  const c = contagemMagias(f);
  return !(m.nivel === 0 ? c.truquesCheio : c.magiasCheio);
}

/** Liga/desliga uma magia. Ativar além do limite não acontece: devolve a ficha igual. Desativar é sempre permitido. */
export function alternarMagia(f: FichaDnd, id: string): FichaDnd {
  const m = f.magias.find((x) => x.id === id);
  if (!m || m.sempre || (!m.ativa && !podeAtivar(f, m))) return f;
  return { ...f, magias: f.magias.map((x) => (x.id === id ? { ...x, ativa: !x.ativa } : x)) };
}

/** Escolhe a classe. Classes conjuradoras ajustam o atributo de conjuração e os espaços ao nível (mantém os já gastos). */
export function definirClasse(f: FichaDnd, id: ClasseId | ""): FichaDnd {
  if (!ehConjuradora(id)) return { ...f, classe: id };
  const t = espacosDaClasse(id, f.nivel);
  return {
    ...f, classe: id, atrConjuracao: CLASSES_CONJ[id].atr,
    espacos: f.espacos.map((e, i) => ({ total: t[i], usados: Math.min(e.usados, t[i]) })),
  };
}

/** Círculos (1–9) com espaço livre que servem para uma magia de `nivelMagia` (conjurar em círculo maior é permitido). */
export function circulosDisponiveis(f: FichaDnd, nivelMagia: number): number[] {
  const out: number[] = [];
  for (let c = Math.max(1, nivelMagia); c <= 9; c++) if (f.espacos[c - 1].total - f.espacos[c - 1].usados > 0) out.push(c);
  return out;
}

/** Magia que pode ser conjurada agora: com limites de classe, precisa estar ativa; sem limites, qualquer uma. */
export function magiaPronta(f: FichaDnd, m: Magia): boolean {
  return !limitesMagia(f) || m.ativa || !!m.sempre;
}

/** Gasta um espaço do círculo escolhido. Devolve a ficha igual se não houver espaço (ou truque: não gasta). */
export function conjurar(f: FichaDnd, m: Magia, circulo: number): FichaDnd {
  if (m.nivel === 0 || !magiaPronta(f, m) || !circulosDisponiveis(f, m.nivel).includes(circulo)) return f;
  return { ...f, espacos: f.espacos.map((e, i) => (i + 1 === circulo ? { ...e, usados: e.usados + 1 } : e)) };
}

// ---------- rolagens ----------
export type ParteRolagem = { rotulo: string; valor: number };
export type Teste = {
  titulo: string;
  dado: string; // "1d20" ou o dado de dano, ex.: "1d8"
  partes: ParteRolagem[]; // somados ao dado
  d20: boolean; // permite vantagem/desvantagem
  dano?: boolean; // permite dobrar os dados num crítico
  cura?: boolean; // o resultado pode ser aplicado aos PV
  /** Vantagem/desvantagem sugeridas pelas condições e características ativas (o jogador pode mudar). */
  sugestao?: { modo: "v" | "d" | null; vantagens: string[]; desvantagens: string[]; falhaAutomatica?: string };
  /** Salvaguarda de morte: o resultado do d20 é aplicado à ficha, não aos PV. */
  morte?: boolean;
};

/** "1d20 + 5 (Carisma) + 2 (Proficiência)": mostra de onde vem cada número. Partes zeradas ficam de fora. */
export function formatarExpressao(dado: string, partes: ParteRolagem[]): string {
  return [dado, ...partes.filter((p) => p.valor !== 0).map((p) => `${p.valor < 0 ? "−" : "+"} ${Math.abs(p.valor)} (${p.rotulo})`)].join(" ");
}

/** Dobra a quantidade de dados ("1d8" → "2d8"), como num acerto crítico. */
export const dobrarDados = (dado: string) => dado.replace(/(\d*)d(\d+)/gi, (_, q: string, f: string) => `${(q === "" ? 1 : Number(q)) * 2}d${f}`);

/** Expressão que o rolador (`rolar`) entende: "2d20kh1+5+2". */
export function expressaoParaRolar(dado: string, partes: ParteRolagem[], opcoes: { vantagem?: "v" | "d" | null; critico?: boolean } = {}): string {
  let d = dado.trim();
  if (opcoes.critico) d = dobrarDados(d);
  if (opcoes.vantagem && /^1d20$/i.test(d)) d = opcoes.vantagem === "v" ? "2d20kh1" : "2d20kl1";
  const soma = partes.reduce((a, p) => a + p.valor, 0);
  return soma === 0 ? d : `${d}${soma > 0 ? "+" : "-"}${Math.abs(soma)}`;
}

export const totalFixo = (partes: ParteRolagem[]) => partes.reduce((a, p) => a + p.valor, 0);

export function testeAtributo(f: FichaDnd, a: Atributo): Teste {
  return { titulo: `Teste de ${ATRIBUTO_NOME[a]}`, dado: "1d20", d20: true, partes: [{ rotulo: ATRIBUTO_NOME[a], valor: modDe(f, a) }] };
}

export function testeSalvaguarda(f: FichaDnd, a: Atributo): Teste {
  return {
    titulo: `Salvaguarda de ${ATRIBUTO_NOME[a]}`, dado: "1d20", d20: true,
    partes: [{ rotulo: ATRIBUTO_NOME[a], valor: modDe(f, a) }, { rotulo: "Proficiência", valor: f.salvaguardas[a] ? bonusProficiencia(f.nivel) : 0 }],
  };
}

export function testePericia(f: FichaDnd, id: PericiaId): Teste {
  const def = PERICIAS.find((p) => p.id === id)!;
  const nivel = f.pericias[id] ?? 0;
  return {
    titulo: def.nome, dado: "1d20", d20: true,
    partes: [
      { rotulo: ATRIBUTO_NOME[def.atr], valor: modDe(f, def.atr) },
      { rotulo: nivel === 2 ? "Especialização" : "Proficiência", valor: nivel * bonusProficiencia(f.nivel) },
      { rotulo: "Bônus extra", valor: f.bonusPericias[id] ?? 0 },
    ],
  };
}

export function testeIniciativa(f: FichaDnd): Teste {
  return { titulo: "Iniciativa", dado: "1d20", d20: true, partes: [{ rotulo: "Destreza", valor: modDe(f, "des") }, { rotulo: "Bônus extra", valor: f.bonusIniciativa }] };
}

export function testeAtaque(f: FichaDnd, a: Ataque): Teste {
  return {
    titulo: `Ataque: ${a.nome || "sem nome"}`, dado: "1d20", d20: true,
    partes: [
      { rotulo: ATRIBUTO_NOME[a.atr], valor: modDe(f, a.atr) },
      { rotulo: "Proficiência", valor: a.proficiente ? bonusProficiencia(f.nivel) : 0 },
      { rotulo: "Bônus", valor: a.bonusAtaque },
    ],
  };
}

export function testeDano(f: FichaDnd, a: Ataque): Teste {
  return {
    titulo: `Dano: ${a.nome || "sem nome"}${a.tipoDano ? ` (${a.tipoDano})` : ""}`, dado: a.dano.trim() || "1d4", d20: false, dano: true,
    partes: [{ rotulo: ATRIBUTO_NOME[a.atr], valor: modDe(f, a.atr) }, { rotulo: "Bônus", valor: a.bonusDano }],
  };
}

export function testeAtaqueMagia(f: FichaDnd, m: Magia): Teste {
  const a = atrDaMagia(f, m);
  return {
    titulo: `Ataque de magia: ${m.nome || "sem nome"}`, dado: "1d20", d20: true,
    partes: [
      { rotulo: a ? ATRIBUTO_NOME[a] : "Atributo de conjuração", valor: a ? modDe(f, a) : 0 },
      { rotulo: "Proficiência", valor: a ? bonusProficiencia(f.nivel) : 0 },
    ],
  };
}

export function testeDanoMagia(m: Magia): Teste {
  return { titulo: `Dano: ${m.nome || "sem nome"}`, dado: m.dano.trim() || "1d4", d20: false, dano: true, partes: [] };
}

/** Descanso longo: recupera tudo (PV, espaços de magia, todos os dados de vida, descansos curtos, salvaguardas de morte). */
export function descansoLongo(f: FichaDnd): FichaDnd {
  return {
    ...f,
    pv: f.pvMax, pvTemp: 0, morteSucessos: 0, morteFalhas: 0, descansosCurtos: 0,
    dadosVidaUsados: 0, concentracao: undefined,
    espacos: f.espacos.map((e) => ({ ...e, usados: 0 })),
  };
}

/** O sistema escolhido na mesa é D&D 5e? (só ele ganha a ficha automatizada.) */
export const ehDnd5e = (sistema: string) => /d\s*&\s*d|dnd/i.test(sistema);

/** Peso total carregado (quantidade × peso de cada item), em kg. */
export const pesoTotal = (itens: Item[]) => Math.round(itens.reduce((a, i) => a + Math.max(0, i.quantidade) * Math.max(0, i.peso), 0) * 100) / 100;

export const MAX_DESCANSOS_CURTOS = 2;
export const podeDescansoCurto = (f: FichaDnd) => f.descansosCurtos < MAX_DESCANSOS_CURTOS;

export const temDadoVida = (f: FichaDnd) => f.dadosVidaUsados < f.dadosVidaTotal;

/**
 * Descanso curto (máx. 2 por descanso longo): restaura todos os espaços de magia e gasta 1 dado de vida, se houver.
 * A cura em si é a rolagem de `testeDadoVida`, aplicada por quem rola (os dados podem ser físicos).
 */
export const descansoCurto = (f: FichaDnd): FichaDnd =>
  podeDescansoCurto(f)
    ? { ...f, descansosCurtos: f.descansosCurtos + 1, dadosVidaUsados: f.dadosVidaUsados + (temDadoVida(f) ? 1 : 0), espacos: f.espacos.map((e) => ({ ...e, usados: 0 })) }
    : f;

/** Soma `n` PV (sem passar do máximo); quem é curado sai das salvaguardas de morte. */
export const curar = (f: FichaDnd, n: number): FichaDnd => ({ ...f, pv: Math.min(f.pvMax, f.pv + Math.max(0, n)), morteSucessos: 0, morteFalhas: 0 });

/** Gasta um dado de vida: "1d8 + 2 (Constituição)". Só rola se ainda houver dados disponíveis. */
export function testeDadoVida(f: FichaDnd): Teste {
  const faces = f.dadoVida.trim().toLowerCase().replace(/^1?d/, "");
  return { titulo: "Dado de vida", dado: `1d${/^\d+$/.test(faces) ? faces : "8"}`, d20: false, cura: true, partes: [{ rotulo: "Constituição", valor: modDe(f, "con") }] };
}
