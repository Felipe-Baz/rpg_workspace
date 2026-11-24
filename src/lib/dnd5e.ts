// Ficha de personagem de D&D 5e: modelo, regras derivadas (modificadores, bônus de proficiência, perícias,
// espaços de magia) e montagem de rolagens "1d20 + 5 (Carisma) + 2 (Proficiência)". Puro e testável.
// As rolagens não são automáticas: o jogador pode rolar no site ou usar os dados da mesa e só conferir a conta.

export const ATRIBUTOS = ["for", "des", "con", "int", "sab", "car"] as const;
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
};

export type TipoAtaqueMagia = "nenhum" | "ataque" | "salvaguarda";
export type Magia = {
  id: string;
  nome: string;
  nivel: number; // 0 = truque
  preparada: boolean;
  escola: string;
  tempo: string;
  alcance: string;
  componentes: string;
  duracao: string;
  descricao: string; // ainda sem tela de leitura dedicada; fica guardada para a próxima etapa
  tipo: TipoAtaqueMagia;
  dano: string; // ex.: "8d6" (vazio = sem rolagem de dano)
  salvaguarda: Atributo; // usada quando tipo = "salvaguarda"
};

export type Item = {
  id: string;
  nome: string;
  quantidade: number;
  peso: number; // por unidade, em kg (0 = sem peso)
  equipado: boolean;
  descricao: string;
};

export type Espaco = { total: number; usados: number };

export type FichaDnd = {
  nome: string;
  classe: string;
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
  moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
  itens: [], equipamento: "", tracos: "", proficienciasIdiomas: "", personalidade: "", ideais: "", vinculos: "", defeitos: "",
  aparencia: "", tituloLivro: "", livro: [""], notas: "",
};

/** Completa campos que faltam (fichas antigas ou parciais) sem perder nada do que já existe. */
export function normalizar(parcial: Partial<FichaDnd> | undefined): FichaDnd {
  const p = parcial ?? {};
  const espacos = Array.from({ length: 9 }, (_, i) => ({ ...FICHA_VAZIA.espacos[i], ...(p.espacos?.[i] ?? {}) }));
  return {
    ...FICHA_VAZIA,
    ...p,
    atributos: { ...FICHA_VAZIA.atributos, ...p.atributos },
    salvaguardas: { ...FICHA_VAZIA.salvaguardas, ...p.salvaguardas },
    moedas: { ...FICHA_VAZIA.moedas, ...p.moedas },
    pericias: p.pericias ?? {},
    bonusPericias: p.bonusPericias ?? {},
    ataques: p.ataques ?? [],
    magias: p.magias ?? [],
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
export const cdMagia = (f: FichaDnd) => (f.atrConjuracao ? 8 + bonusProficiencia(f.nivel) + modDe(f, f.atrConjuracao) : 0);
export const bonusAtaqueMagia = (f: FichaDnd) => (f.atrConjuracao ? bonusProficiencia(f.nivel) + modDe(f, f.atrConjuracao) : 0);

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

// ---------- rolagens ----------
export type ParteRolagem = { rotulo: string; valor: number };
export type Teste = {
  titulo: string;
  dado: string; // "1d20" ou o dado de dano, ex.: "1d8"
  partes: ParteRolagem[]; // somados ao dado
  d20: boolean; // permite vantagem/desvantagem
  dano?: boolean; // permite dobrar os dados num crítico
  cura?: boolean; // o resultado pode ser aplicado aos PV
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
  return {
    titulo: `Ataque de magia: ${m.nome || "sem nome"}`, dado: "1d20", d20: true,
    partes: [
      { rotulo: f.atrConjuracao ? ATRIBUTO_NOME[f.atrConjuracao] : "Atributo de conjuração", valor: f.atrConjuracao ? modDe(f, f.atrConjuracao) : 0 },
      { rotulo: "Proficiência", valor: f.atrConjuracao ? bonusProficiencia(f.nivel) : 0 },
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
    dadosVidaUsados: 0,
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
