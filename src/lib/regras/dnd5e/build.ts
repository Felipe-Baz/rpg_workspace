// "Build" da ficha D&D 5e: só as ESCOLHAS do jogador (ids do catálogo + decisões). Tudo o mais é derivado
// em runtime por `derivar`, nunca gravado. Ver docs/planejamento/ficha-dnd5e-automatizada.md §5.

import type { Atributo } from "../../dnd5e.ts";

/** Decisões por id de escolha do catálogo (`EscolhaDef.id`): `{ atributos: ["car", "des"], pericia: ["furtividade"] }`. */
export type Escolhas = Record<string, string[]>;

export type EscolhaClasse = {
  id: string; // id no catálogo
  nivel: number;
  subclasse?: string;
  /** Decisões da classe (`pericias`: as perícias escolhidas entre as da classe). */
  escolhas?: Escolhas;
};

export type PassoNivel = {
  classe: string;
  /** Rolado ou "medio" (média do dado, arredondada para cima). */
  pv: number | "medio";
  /** Níveis de aumento de atributo: +2/+1+1 ou um talento. */
  incremento?: { atributos?: Partial<Record<Atributo, number>>; talento?: string };
};

export type MetodoAtributos = "padrao" | "compra" | "rolagem" | "manual";

/** Ajuste manual de um valor derivado (regra da casa, item homebrew). Sempre sinalizado na ficha. */
export type Ajuste = { somar?: number; substituir?: number; rotulo?: string };

export type Build = {
  raca?: { id: string; sub?: string; escolhas?: Escolhas };
  antecedente?: { id: string; escolhas?: Escolhas; /** Variação opcional do livro (ex.: pirata, cavaleiro). */ variacao?: string };
  /** Array desde já: multiclasse (regra opcional da mesa) não exige mudar o modelo. */
  classes: EscolhaClasse[];
  atributosBase: Record<Atributo, number>;
  metodoAtributos?: MetodoAtributos;
  /** Valor do dado de vida do 1º nível (rolado ou média). Ausente = dado máximo, como o livro manda. */
  pvNivel1?: number;
  /** Um passo por nível a partir do 2º (índice 0 = 2º nível). Sem passo, vale a média do dado. */
  historicoNiveis?: PassoNivel[];
  /** Talentos (regra opcional da mesa). */
  talentos?: string[];
  /** Escolhas dos talentos (ex.: o atributo de Atleta), por id de talento. */
  escolhasTalentos?: Record<string, Escolhas>;
  /** Proficiências em perícia que o livro não explica (fichas migradas, regra da casa). */
  periciasExtras?: string[];
  /** Perícias com especialização (bônus dobrado), entre as que o personagem já tem. */
  especialistas?: string[];
  /** Ajustes manuais por alvo do motor (ex.: "ca", "atr.for", "pv.max", "iniciativa"). */
  ajustes?: Record<string, Ajuste>;
};

export const nivelTotal = (b: Build) => b.classes.reduce((a, c) => a + Math.max(0, c.nivel), 0);
