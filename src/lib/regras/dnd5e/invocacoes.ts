// Invocações Místicas e Dádiva do Pacto do bruxo. O texto e os pré-requisitos vêm do catálogo (`invocacoes.json`, gerado
// do Livro do Jogador); aqui ficam as ESCOLHAS do personagem (em `build.classes[bruxo].escolhas`), os limites por nível,
// os pré-requisitos conferidos e o que a ficha CALCULA de cada invocação (CA, perícias, usos, bônus na Rajada Mística).
// Tudo o que não está em `EFEITOS` é só texto de consulta (visão no escuro, ler qualquer escrita...).

import { classesDaFicha, modificador, type Ataque, type Atributo, type FichaDnd } from "../../dnd5e.ts";
import { atributoDaArma, notasDaArma } from "./equipamento.ts";
import type { Build, EscolhaClasse } from "./build.ts";
import type { ArmaCat, Catalogo, InvocacaoCat } from "./catalogo.ts";
import type { RecursoDef } from "./recursos.ts";

export const BRUXO = "bruxo";

// ---------- Dádiva do Pacto ----------
export type PactoId = "lamina" | "corrente" | "tomo";
export const PACTOS: { id: PactoId; nome: string; resumo: string }[] = [
  { id: "lamina", nome: "Pacto da Lâmina", resumo: "Cria uma arma do pacto (ação), com a qual você tem proficiência e que conta como mágica." },
  { id: "corrente", nome: "Pacto da Corrente", resumo: "Conjura convocar familiar como ritual, com formas especiais (diabrete, pseudodragão, quasit, sprite)." },
  { id: "tomo", nome: "Pacto do Tomo", resumo: "Livro das Sombras com três truques de qualquer classe, além dos que você já conhece." },
];
export const nomeDoPacto = (id: string | undefined) => PACTOS.find((p) => p.id === id)?.nome;
/** Nível de bruxo em que a Dádiva do Pacto é concedida. */
export const NIVEL_PACTO = 3;

// ---------- quantas invocações ----------
/** "Invocações Conhecidas" da tabela do bruxo, do 1º ao 20º nível (o livro omite a linha do 20º: vale a do 19º). */
const CONHECIDAS = [0, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8];
export const invocacoesConhecidas = (nivelBruxo: number) => CONHECIDAS[Math.min(20, Math.max(0, Math.floor(nivelBruxo))) - 1] ?? 0;

// ---------- o que a ficha guarda ----------
const classeBruxo = (f: Pick<FichaDnd, "build">): EscolhaClasse | undefined => f.build?.classes.find((c) => c.id === BRUXO);

export const nivelDeBruxo = (f: Pick<FichaDnd, "classe" | "nivel" | "classes">) => classesDaFicha(f).find((c) => c.id === BRUXO)?.nivel ?? 0;
/** Ids das invocações escolhidas (só com a construção pelo livro, que guarda as escolhas). */
export const invocacoesDaFicha = (f: Pick<FichaDnd, "build">): string[] => classeBruxo(f)?.escolhas?.invocacoes ?? [];
export const pactoDaFicha = (f: Pick<FichaDnd, "build">): PactoId | undefined => {
  const p = classeBruxo(f)?.escolhas?.pacto?.[0];
  return PACTOS.some((x) => x.id === p) ? (p as PactoId) : undefined;
};

/** Grava as invocações (e, se informado, o pacto) na classe de bruxo do build. */
export function definirInvocacoes(b: Build, ids: string[], pacto?: string): Build {
  return {
    ...b,
    classes: b.classes.map((c) => (c.id !== BRUXO ? c : {
      ...c,
      escolhas: { ...c.escolhas, invocacoes: [...new Set(ids)], ...(pacto !== undefined ? { pacto: pacto ? [pacto] : [] } : {}) },
    })),
  };
}

/** Armas corpo a corpo do catálogo que a arma do pacto pode imitar (o livro: "a forma que essa arma corpo-a-corpo tem"). */
export const armasParaPacto = (cat: Pick<Catalogo, "equipamento">): ArmaCat[] =>
  cat.equipamento().filter((i): i is ArmaCat => i.tipo === "arma" && !i.distancia && !!i.dado);
export const armaDoPactoDaFicha = (f: Pick<FichaDnd, "build">): string | undefined => classeBruxo(f)?.escolhas?.armaPacto?.[0];

/** Guarda a forma da arma do pacto (id de arma do catálogo; vazio limpa). */
export function definirArmaPacto(b: Build, armaId: string): Build {
  return { ...b, classes: b.classes.map((c) => (c.id !== BRUXO ? c : { ...c, escolhas: { ...c.escolhas, armaPacto: armaId ? [armaId] : [] } })) };
}

/**
 * Linha de ataque da arma do pacto (Pacto da Lâmina): proficiente, conta como mágica e usa Força ou Destreza como a arma.
 * Lâmina Sedenta (5º nível) = dois ataques com a ação Ataque; Sorvedor de Vida (12º) soma o mod. de Carisma (mín. 1) em dano necrótico.
 * Sem arma escolhida não há linha (a ficha não inventa a forma).
 */
export function ataqueDaArmaDoPacto(f: Pick<FichaDnd, "build">, cat: Pick<Catalogo, "item">, mods: Record<Atributo, number>): Ataque | null {
  if (pactoDaFicha(f) !== "lamina") return null;
  const id = armaDoPactoDaFicha(f);
  const arma = id ? cat.item(id) : undefined;
  if (!arma || arma.tipo !== "arma" || !arma.dado) return null;
  const invs = invocacoesDaFicha(f);
  const sorvedor = invs.includes("sorvedor-de-vida") ? Math.max(1, mods.car) : 0;
  const notas = [
    notasDaArma(arma), "arma do pacto: proficiente e mágica (vence resistência e imunidade a dano não mágico)",
    ...(invs.includes("lamina-sedenta") ? ["Lâmina Sedenta: 2 ataques com a ação Ataque"] : []),
    ...(sorvedor ? [`Sorvedor de Vida: o bônus de dano inclui +${sorvedor} necrótico (Carisma)`] : []),
  ].filter(Boolean).join("; ");
  return { id: "arma:pacto", nome: `Arma do pacto (${arma.nome})`, atr: atributoDaArma(arma, mods), proficiente: true, bonusAtaque: 0, dano: arma.dado, bonusDano: sorvedor, tipoDano: arma.tipoDano ?? "", notas, derivado: true };
}

// ---------- pré-requisitos ----------
export type ContextoInvocacao = {
  /** Nível de bruxo (no assistente: o nível que o personagem terá depois de subir). */
  nivelBruxo: number;
  pacto?: string;
  /** Ids (slug) dos truques que o personagem conhece. */
  truques: string[];
};

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Truques da ficha (do catálogo ou cadastrados à mão), em slug, para conferir "truque rajada mística". */
export const truquesDaFicha = (f: Pick<FichaDnd, "magias">): string[] =>
  f.magias.filter((m) => m.nivel === 0).flatMap((m) => [m.catalogoId ?? "", slug(m.nome)]).filter(Boolean);

/** O que falta para aprender a invocação (vazio = pode). O livro permite aprender junto com o pré-requisito. */
const NOMES_TRUQUES: Record<string, string> = { "rajada-mistica": "rajada mística" };

export function requisitosFaltando(inv: Pick<InvocacaoCat, "requisitos">, ctx: ContextoInvocacao, nomeTruque: (id: string) => string = (id) => NOMES_TRUQUES[id] ?? id.replace(/-/g, " ")): string[] {
  const r = inv.requisitos ?? {};
  const falta: string[] = [];
  if (r.nivel && ctx.nivelBruxo < r.nivel) falta.push(`${r.nivel}º nível de bruxo`);
  if (r.pacto && ctx.pacto !== r.pacto) falta.push(nomeDoPacto(r.pacto) ?? r.pacto);
  if (r.truque && !ctx.truques.includes(r.truque)) falta.push(`truque ${nomeTruque(r.truque)}`);
  return falta;
}

// ---------- o que cada invocação faz na ficha (curado) ----------
type EfeitoInvocacao = {
  /** "vontade": magia à vontade (sem usos); "longo": uma vez por descanso longo (gasta espaço de pacto). */
  uso?: "vontade" | "longo";
  magia?: string;
  /** Tira o limite de espaço e componentes (à vontade) ou usa um espaço de pacto (longo). */
  armaduraArcana?: boolean;
  pericias?: string[];
  nota?: string;
};
const V = (magia: string, nota?: string): EfeitoInvocacao => ({ uso: "vontade", magia, nota });
const L = (magia: string): EfeitoInvocacao => ({ uso: "longo", magia });

export const EFEITOS: Record<string, EfeitoInvocacao> = {
  "armadura-de-sombras": { ...V("armadura arcana"), armaduraArcana: true },
  "correntes-de-carceri": V("imobilizar monstro", "só em celestial, corruptor ou elemental; a mesma criatura só de novo após um descanso longo"),
  "encharcar-a-mente": L("lentidão"),
  "escultor-de-carne": L("metamorfose"),
  "idioma-bestial": V("falar com animais"),
  "influencia-enganadora": { pericias: ["enganacao", "persuasao"] },
  "lacaios-do-caos": L("conjurar elemental"),
  "larapio-dos-cinco-destinos": L("perdição"),
  "mascara-das-muitas-faces": V("disfarçar-se"),
  "mestre-das-infindaveis-formas": V("alterar-se"),
  "palavra-terrivel": L("confusão"),
  "passo-ascendente": V("levitação", "em si mesmo"),
  "salto-transcendental": V("salto", "em si mesmo"),
  "sinal-de-mau-agouro": L("rogar maldição"),
  "sussurros-da-sepultura": V("falar com os mortos"),
  "sussurros-sedutores": L("compulsão"),
  "vigor-abissal": V("vitalidade falsa", "em si mesmo, como magia de 1º círculo"),
  "visao-mistica": V("detectar magia"),
  "visoes-de-reinos-distantes": V("olho arcano"),
  "visoes-nas-brumas": V("imagem silenciosa"),
};

export const efeitoDaInvocacao = (id: string): EfeitoInvocacao | undefined => EFEITOS[id];
export const rotuloUsoInvocacao = (id: string) => (EFEITOS[id]?.uso === "vontade" ? "à vontade" : EFEITOS[id]?.uso === "longo" ? "1× por descanso longo" : "passiva");
export const idRecursoInvocacao = (id: string) => `invocacao-${id}`;

// ---------- efeitos calculados ----------
/** Armadura de Sombras: sem armadura, a CA é 13 + Des o tempo todo (armadura arcana à vontade). */
export const temArmaduraDeSombras = (f: Pick<FichaDnd, "build">) => invocacoesDaFicha(f).some((id) => EFEITOS[id]?.armaduraArcana);

/** Perícias que as invocações concedem (Influência Enganadora). */
export const periciasDeInvocacoes = (f: Pick<FichaDnd, "build">): string[] => [...new Set(invocacoesDaFicha(f).flatMap((id) => EFEITOS[id]?.pericias ?? []))];

/** Usos das invocações que conjuram magia: à vontade (ilimitado) ou uma vez por descanso longo. */
export function recursosDeInvocacoes(f: Pick<FichaDnd, "build">, cat?: Pick<Catalogo, "invocacao">): RecursoDef[] {
  const out: RecursoDef[] = [];
  for (const id of invocacoesDaFicha(f)) {
    const e = EFEITOS[id];
    if (!e?.uso || !e.magia) continue;
    const nome = cat?.invocacao(id)?.nome ?? id;
    const base = e.uso === "vontade"
      ? `Conjura ${e.magia} à vontade, sem gastar espaço de magia.`
      : `Conjura ${e.magia} uma vez, usando um espaço de magia de bruxo, até o próximo descanso longo.`;
    out.push({ id: idRecursoInvocacao(id), nome, max: 1, ilimitado: e.uso === "vontade", recarga: "longo", fonte: "Invocação Mística", descricao: `${base}${e.nota ? ` (${e.nota})` : ""}` });
  }
  return out;
}

/** Notas que aparecem na Rajada Mística pelas invocações escolhidas (alcance, empurrão) e o bônus de dano por raio. */
export function efeitosNaRajada(f: Pick<FichaDnd, "build" | "atributos">): { danoPorRaio: number; notas: string[] } {
  const ids = invocacoesDaFicha(f);
  const notas: string[] = [];
  const car = Math.max(0, modificador(f.atributos.car));
  const danoPorRaio = ids.includes("explosao-agonizante") ? car : 0;
  if (danoPorRaio) notas.push(`Explosão Agonizante: +${danoPorRaio} de dano por raio que acerta (Carisma)`);
  if (ids.includes("explosao-repulsiva")) notas.push("Explosão Repulsiva: empurra o alvo até 3 m em linha reta");
  if (ids.includes("lanca-mistica")) notas.push("Lança Mística: alcance de 90 m");
  return { danoPorRaio, notas };
}

// ---------- conferência (usada por `validar`) ----------
export type ProblemaInvocacao = { id: string; mensagem: string; grave?: boolean };

/** Conferência do build do bruxo: quantidade, pacto, pré-requisitos e ids do catálogo. Só "excesso" bloqueia o jogador. */
export function conferirInvocacoes(f: FichaDnd, cat: Catalogo): ProblemaInvocacao[] {
  const c = classeBruxo(f);
  if (!c) return [];
  const out: ProblemaInvocacao[] = [];
  const ids = c.escolhas?.invocacoes ?? [];
  const limite = invocacoesConhecidas(c.nivel);
  const pacto = pactoDaFicha(f);
  if (ids.length > limite) out.push({ id: "invocacoes.excesso", grave: true, mensagem: `Bruxo de nível ${c.nivel} conhece ${limite} invocações, mas há ${ids.length}.` });
  else if (ids.length < limite) out.push({ id: "invocacoes.pendentes", mensagem: `Bruxo: escolha ${limite - ids.length} invocação(ões) mística(s).` });
  if (c.nivel >= NIVEL_PACTO && !pacto) out.push({ id: "pacto.pendente", mensagem: "Bruxo: escolha a Dádiva do Pacto (3º nível)." });
  const ctx: ContextoInvocacao = { nivelBruxo: c.nivel, pacto, truques: truquesDaFicha(f) };
  for (const id of ids) {
    const inv = cat.invocacao(id);
    if (!inv) { out.push({ id: `invocacao.desconhecida.${id}`, mensagem: `Invocação "${id}" não existe no catálogo.` }); continue; }
    const falta = requisitosFaltando(inv, ctx);
    if (falta.length) out.push({ id: `invocacao.requisito.${id}`, mensagem: `${inv.nome}: falta ${falta.join(", ")}.` });
  }
  return out;
}
