// Catálogo de magias (pacote "phb"): tipos, busca, escala de dano/cura e conversão para a ficha.
// Os dados vêm de src/data/dnd5e/phb/magias.json (gerado por scripts/gerar-catalogo-dnd5e.mjs) e são carregados
// sob demanda (`carregarMagias`), para não pesar no bundle das telas que não usam magias.

import type { Atributo, Magia } from "../../dnd5e.ts";

export type DanoMagia = { dado: string; tipo: string; /** soma o modificador de conjuração */ somaMod?: boolean; porDardo?: boolean };
export type MecanicaMagia = {
  ataque?: "corpo" | "distancia";
  salvaguarda?: Atributo;
  danos?: DanoMagia[];
  cura?: { dado: string; somaMod?: boolean };
  /**
   * Acréscimo a cada `porNivel` círculos acima do da magia (ex.: 8d6 → +1d6). `fixo` soma um valor fixo
   * (Vitalidade Falsa: +5 PV temporários). Magias por dardo/raio usam `dardosExtras`.
   */
  escalaNivel?: { dado?: string; fixo?: number; dardosExtras?: number; porNivel: number };
  /** Truques: dado total (ou quantidade de raios) a partir de cada nível do personagem. */
  escalaPersonagem?: { nivel: number; dado?: string; dardos?: number }[];
  area?: { forma: string; metros: number };
  /** Dardos/raios do círculo da magia (truques: do nível 1 do personagem). */
  dardos?: number;
  /** Outras rolagens da magia que não são dano nem cura de PV (PV afetados, PV temporários...). A 1ª escala por `escalaNivel` se a magia não tiver dano nem cura. */
  extras?: { rotulo: string; dado: string }[];
};

export type ComponentesMagia = { v: boolean; s: boolean; m: boolean; material?: string };

export type MagiaCat = {
  id: string;
  nome: string;
  pacote: string;
  nivel: number;
  escola: string;
  ritual: boolean;
  tempo: string;
  alcance: string;
  componentes: ComponentesMagia;
  duracao: string;
  concentracao: boolean;
  descricao: string;
  nivelSuperior?: string;
  classes: string[];
  mecanica?: MecanicaMagia;
};

let cache: Promise<MagiaCat[]> | undefined;
/** Carrega o JSON só na primeira chamada (import dinâmico; o navegador guarda em cache). */
export function carregarMagias(): Promise<MagiaCat[]> {
  cache ??= import("../../../data/dnd5e/phb/magias.json").then((m) => (m.default ?? m) as unknown as MagiaCat[]);
  return cache;
}

// ---------- busca ----------
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type FiltroMagias = {
  texto?: string;
  nivel?: number; // 0 = truques
  escola?: string;
  classe?: string;
  ritual?: boolean;
  concentracao?: boolean;
};

export function buscarMagias(lista: readonly MagiaCat[], f: FiltroMagias): MagiaCat[] {
  const q = semAcento(f.texto ?? "").trim();
  return lista.filter((m) =>
    (f.nivel === undefined || m.nivel === f.nivel) &&
    (!f.escola || m.escola === f.escola) &&
    (!f.classe || m.classes.includes(f.classe)) &&
    (!f.ritual || m.ritual) &&
    (!f.concentracao || m.concentracao) &&
    (!q || semAcento(m.nome).includes(q)),
  );
}

// ---------- dados e escala ----------
type Dado = { qtd: number; faces: number; fixo: number };
const lerDado = (s: string): Dado | null => {
  const m = s.replace(/\s+/g, "").match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  return m ? { qtd: Number(m[1]), faces: Number(m[2]), fixo: Number(m[3] ?? 0) } : null;
};
const textoDado = (d: Dado) => `${d.qtd}d${d.faces}${d.fixo ? `+${d.fixo}` : ""}`;

/** "8d6" + 2 × "1d6" = "10d6". Dados de faces diferentes viram uma soma ("1d8+2d4"). */
export function somarDados(base: string, extra: string, vezes: number): string {
  if (vezes <= 0) return base;
  const b = lerDado(base), e = lerDado(extra);
  if (!b || !e) return base;
  if (b.faces === e.faces) return textoDado({ qtd: b.qtd + e.qtd * vezes, faces: b.faces, fixo: b.fixo + e.fixo * vezes });
  return `${textoDado(b)}+${e.qtd * vezes}d${e.faces}`;
}

/** Dado de dano/cura da magia conjurada num círculo (ampliar). Truques não escalam por círculo. */
export function dadoNoCirculo(m: MagiaCat, dadoBase: string, circulo: number): string {
  const esc = m.mecanica?.escalaNivel;
  if (!esc || (!esc.dado && !esc.fixo) || m.nivel === 0) return dadoBase;
  const passos = Math.floor((circulo - m.nivel) / esc.porNivel);
  if (passos <= 0) return dadoBase;
  let dado = esc.dado ? somarDados(dadoBase, esc.dado, passos) : dadoBase;
  const d = esc.fixo ? lerDado(dado) : null;
  if (d && esc.fixo) dado = textoDado({ ...d, fixo: d.fixo + esc.fixo * passos });
  return dado;
}

/** Dado de um truque no nível do personagem (5°, 11°, 17°). `dadoBase` é o do nível 1. */
export function dadoDoTruque(m: MagiaCat, dadoBase: string, nivelPersonagem: number): string {
  let dado = dadoBase;
  for (const e of m.mecanica?.escalaPersonagem ?? []) if (e.dado && nivelPersonagem >= e.nivel) dado = e.dado;
  return dado;
}

/** Quantos raios o truque lança no nível do personagem (Rajada Mística: 1, 2 no 5º, 3 no 11º, 4 no 17º). */
export function dardosDoTruque(m: MagiaCat, nivelPersonagem: number): number | undefined {
  let n = m.mecanica?.dardos;
  for (const e of m.mecanica?.escalaPersonagem ?? []) if (e.dardos && nivelPersonagem >= e.nivel) n = e.dardos;
  return n;
}

// ---------- ficha ----------
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function componentesTexto(c: ComponentesMagia): string {
  const letras = [c.v && "V", c.s && "S", c.m && "M"].filter(Boolean).join(", ");
  return c.material ? `${letras} (${c.material})` : letras;
}

/** Converte uma magia do catálogo na magia da ficha (campos já preenchidos). `id` é o id novo na ficha. */
export function magiaParaFicha(m: MagiaCat, id: string, ativa: boolean): Magia {
  const mec = m.mecanica;
  const dano = mec?.danos?.[0];
  const tipo: Magia["tipo"] = mec?.ataque ? "ataque" : mec?.salvaguarda ? "salvaguarda" : "nenhum";
  const descricao = m.nivelSuperior ? `${m.descricao}\n\n**Em Níveis Superiores.** ${m.nivelSuperior}` : m.descricao;
  return {
    id,
    catalogoId: m.id,
    nome: m.nome,
    nivel: m.nivel,
    ativa,
    escola: capitalizar(m.escola),
    tempo: m.tempo,
    alcance: m.alcance,
    componentes: componentesTexto(m.componentes),
    duracao: m.duracao,
    descricao,
    ...(m.concentracao ? { concentracao: true } : {}),
    ...(m.ritual ? { ritual: true } : {}),
    tipo,
    dano: dano?.dado ?? mec?.cura?.dado ?? "",
    salvaguarda: mec?.salvaguarda ?? "des",
  };
}
