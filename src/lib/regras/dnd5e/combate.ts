// Estado de combate da ficha D&D 5e: condições (Apêndice A do livro) e exaustão, vantagem/desvantagem automáticas,
// características ativáveis (Fúria...), dano com resistência/vulnerabilidade/imunidade, morte e estabilização.
// Funções puras; a ficha só guarda `condicoes`, `exaustao`, `ativos`, `defesas` e os contadores de morte.

import { classesDaFicha, type Atributo, type FichaDnd, type Teste } from "../../dnd5e.ts";

// ============================ CONDIÇÕES ============================
export type EfeitosCondicao = {
  ataqueDesv?: boolean; ataqueVant?: boolean;
  /** Ataques contra a criatura: vantagem; "proximo" = vantagem a 1,5 m e desvantagem de longe (caído). */
  contraVant?: boolean | "proximo"; contraDesv?: boolean;
  testeDesv?: boolean;
  salvDesDesv?: boolean;
  falhaSalv?: Atributo[];
  deslocamentoZero?: boolean;
  incapacitado?: boolean;
  /** Acerto a 1,5 m é crítico. */
  critProximo?: boolean;
  resistenciaTotal?: boolean;
};
export type CondicaoDef = { id: string; nome: string; resumo: string; efeitos: EfeitosCondicao };

/** As 14 condições do Apêndice A (a exaustão tem tabela própria). `resumo` é o que a ficha mostra. */
export const CONDICOES: CondicaoDef[] = [
  { id: "agarrado", nome: "Agarrado", resumo: "Deslocamento 0, sem bônus de deslocamento.", efeitos: { deslocamentoZero: true } },
  { id: "amedrontado", nome: "Amedrontado", resumo: "Desvantagem em testes de habilidade e ataques enquanto a fonte do medo estiver à vista; não se aproxima dela.", efeitos: { ataqueDesv: true, testeDesv: true } },
  { id: "atordoado", nome: "Atordoado", resumo: "Incapacitado, não se move; falha em salvaguardas de For e Des; ataques contra ele têm vantagem.", efeitos: { incapacitado: true, deslocamentoZero: true, falhaSalv: ["for", "des"], contraVant: true } },
  { id: "caido", nome: "Caído", resumo: "Só rasteja; desvantagem nos próprios ataques; ataques a 1,5 m têm vantagem, de longe têm desvantagem.", efeitos: { ataqueDesv: true, contraVant: "proximo" } },
  { id: "cego", nome: "Cego", resumo: "Falha em testes que exigem visão; ataques contra ele têm vantagem e os dele têm desvantagem.", efeitos: { ataqueDesv: true, contraVant: true } },
  { id: "enfeiticado", nome: "Enfeitiçado", resumo: "Não pode atacar quem o enfeitiçou nem o alvejar com efeitos nocivos; o encantador tem vantagem em interações sociais.", efeitos: {} },
  { id: "envenenado", nome: "Envenenado", resumo: "Desvantagem em ataques e testes de habilidade.", efeitos: { ataqueDesv: true, testeDesv: true } },
  { id: "impedido", nome: "Impedido", resumo: "Deslocamento 0; ataques contra ele têm vantagem e os dele desvantagem; desvantagem em salvaguardas de Destreza.", efeitos: { deslocamentoZero: true, ataqueDesv: true, contraVant: true, salvDesDesv: true } },
  { id: "incapacitado", nome: "Incapacitado", resumo: "Não realiza ações nem reações.", efeitos: { incapacitado: true } },
  { id: "inconsciente", nome: "Inconsciente", resumo: "Incapacitado, caído, não se move nem fala; falha em salvaguardas de For e Des; ataques contra ele têm vantagem e acertos a 1,5 m são críticos.", efeitos: { incapacitado: true, deslocamentoZero: true, ataqueDesv: true, falhaSalv: ["for", "des"], contraVant: true, critProximo: true } },
  { id: "invisivel", nome: "Invisível", resumo: "Ataques dele têm vantagem; ataques contra ele têm desvantagem.", efeitos: { ataqueVant: true, contraDesv: true } },
  { id: "paralisado", nome: "Paralisado", resumo: "Incapacitado, não se move nem fala; falha em salvaguardas de For e Des; ataques contra ele têm vantagem e acertos a 1,5 m são críticos.", efeitos: { incapacitado: true, deslocamentoZero: true, falhaSalv: ["for", "des"], contraVant: true, critProximo: true } },
  { id: "petrificado", nome: "Petrificado", resumo: "Incapacitado, não se move; falha em salvaguardas de For e Des; ataques contra ele têm vantagem; resistência a todo dano e imunidade a veneno e doenças.", efeitos: { incapacitado: true, deslocamentoZero: true, falhaSalv: ["for", "des"], contraVant: true, resistenciaTotal: true } },
  { id: "surdo", nome: "Surdo", resumo: "Falha em testes de habilidade que exigem audição.", efeitos: {} },
];
export const condicaoDe = (id: string) => CONDICOES.find((c) => c.id === id);

export const EXAUSTAO: { nivel: number; efeito: string }[] = [
  { nivel: 1, efeito: "Desvantagem em testes de habilidade" },
  { nivel: 2, efeito: "Deslocamento reduzido à metade" },
  { nivel: 3, efeito: "Desvantagem em ataques e salvaguardas" },
  { nivel: 4, efeito: "PV máximos reduzidos à metade" },
  { nivel: 5, efeito: "Deslocamento reduzido a 0" },
  { nivel: 6, efeito: "Morte" },
];

// ============================ ESTADO VITAL ============================
export type EstadoVital = "vivo" | "inconsciente" | "estavel" | "morto";
export function estadoVital(f: Pick<FichaDnd, "pv" | "morteFalhas" | "morteSucessos" | "exaustao">): EstadoVital {
  if ((f.exaustao ?? 0) >= 6 || (f.pv <= 0 && f.morteFalhas >= 3)) return "morto";
  if (f.pv > 0) return "vivo";
  return f.morteSucessos >= 3 ? "estavel" : "inconsciente";
}

/** Condições da ficha mais as que vêm do estado (a 0 PV a criatura está inconsciente). */
export function condicoesEfetivas(f: Pick<FichaDnd, "condicoes" | "pv" | "morteFalhas" | "morteSucessos" | "exaustao">): string[] {
  const ids = new Set(f.condicoes ?? []);
  if (f.pv <= 0) ids.add("inconsciente");
  return [...ids];
}

// ============================ ATIVÁVEIS ============================
export type AtivavelDef = {
  id: string; nome: string; descricao: string; classes: string[]; nivelMin: number;
  /** Recurso gasto ao ligar (ver recursos.ts). */
  usaRecurso?: string;
};
export const ATIVAVEIS: AtivavelDef[] = [
  { id: "furia", nome: "Fúria", classes: ["barbaro"], nivelMin: 1, usaRecurso: "furia", descricao: "Vantagem em testes e salvaguardas de Força, bônus de dano corpo a corpo com Força e resistência a dano contundente, cortante e perfurante. Sem conjurar nem se concentrar." },
  { id: "ataque-descuidado", nome: "Ataque Descuidado", classes: ["barbaro"], nivelMin: 2, descricao: "Vantagem nos ataques corpo a corpo com Força neste turno; ataques contra você têm vantagem até o próximo turno." },
  { id: "armadura-arcana", nome: "Armadura Arcana", classes: ["mago", "feiticeiro"], nivelMin: 1, descricao: "Magia de 1º círculo (gaste o espaço ao conjurar): sem armadura, sua CA vira 13 + Destreza por 8 horas." },
  { id: "forma-selvagem", nome: "Forma Selvagem", classes: ["druida"], nivelMin: 2, usaRecurso: "forma-selvagem", descricao: "Transformado em fera: use as estatísticas dela, mantendo seus atributos mentais e proficiências." },
];
export const ativaveisDisponiveis = (f: Pick<FichaDnd, "classe" | "nivel" | "classes">) =>
  ATIVAVEIS.filter((a) => classesDaFicha(f).some((c) => a.classes.includes(c.id) && c.nivel >= a.nivelMin));

export const danoDeFuria = (nivel: number) => (nivel >= 16 ? 4 : nivel >= 9 ? 3 : 2);
const ativo = (f: Pick<FichaDnd, "ativos">, id: string) => (f.ativos ?? []).includes(id);

// ============================ VANTAGEM / DESVANTAGEM ============================
export type Jogada =
  | { tipo: "ataque"; corpo: boolean; atributo: Atributo }
  | { tipo: "teste"; atributo: Atributo }
  | { tipo: "salvaguarda"; atributo: Atributo }
  | { tipo: "iniciativa" };

export type EstadoJogo = Pick<FichaDnd, "condicoes" | "pv" | "morteFalhas" | "morteSucessos" | "exaustao" | "ativos" | "classe" | "nivel"> & { armaduraSemProf?: boolean };

export type SugestaoModo = { modo: "v" | "d" | null; vantagens: string[]; desvantagens: string[]; falhaAutomatica?: string };

/** Vantagem/desvantagem da jogada pelas condições, exaustão e características ativas. Os dois lados se anulam (regra do livro). */
export function modoDaJogada(f: EstadoJogo, j: Jogada): SugestaoModo {
  const vant: string[] = [];
  const desv: string[] = [];
  let falha: string | undefined;
  const exa = f.exaustao ?? 0;
  for (const id of condicoesEfetivas(f)) {
    const c = condicaoDe(id);
    if (!c) continue;
    const e = c.efeitos;
    if (j.tipo === "ataque") {
      if (e.ataqueDesv) desv.push(c.nome);
      if (e.ataqueVant) vant.push(c.nome);
    } else if (j.tipo === "teste" || j.tipo === "iniciativa") {
      if (e.testeDesv) desv.push(c.nome);
    } else {
      if (e.salvDesDesv && j.atributo === "des") desv.push(c.nome);
      if (e.falhaSalv?.includes(j.atributo)) falha = `Falha automática (${c.nome})`;
    }
  }
  if (j.tipo === "ataque" && exa >= 3) desv.push("Exaustão 3");
  if (j.tipo === "salvaguarda" && exa >= 3) desv.push("Exaustão 3");
  if ((j.tipo === "teste" || j.tipo === "iniciativa") && exa >= 1) desv.push("Exaustão");
  const forcaOuDes = j.tipo !== "iniciativa" && (j.atributo === "for" || j.atributo === "des");
  if (f.armaduraSemProf && forcaOuDes) desv.push("Armadura sem proficiência");
  if (ativo(f, "furia") && j.tipo !== "iniciativa" && j.tipo !== "ataque" && j.atributo === "for") vant.push("Fúria");
  if (ativo(f, "ataque-descuidado") && j.tipo === "ataque" && j.corpo && j.atributo === "for") vant.push("Ataque Descuidado");
  const modo = vant.length && desv.length ? null : vant.length ? "v" : desv.length ? "d" : null;
  return { modo, vantagens: [...new Set(vant)], desvantagens: [...new Set(desv)], ...(falha ? { falhaAutomatica: falha } : {}) };
}

/** Anexa a sugestão ao teste (o painel de rolagem a usa como ponto de partida). */
export const comSugestao = (t: Teste, s: SugestaoModo): Teste => (s.modo || s.vantagens.length || s.desvantagens.length || s.falhaAutomatica ? { ...t, sugestao: s } : t);

/** Como atacam VOCÊ: lista de efeitos que o mestre/atacante deve considerar. */
export function ataquesContraVoce(f: EstadoJogo): string[] {
  const out: string[] = [];
  for (const id of condicoesEfetivas(f)) {
    const e = condicaoDe(id)?.efeitos;
    if (!e) continue;
    const nome = condicaoDe(id)!.nome;
    if (e.contraVant === "proximo") out.push(`${nome}: vantagem a 1,5 m, desvantagem de longe`);
    else if (e.contraVant) out.push(`${nome}: vantagem`);
    if (e.contraDesv) out.push(`${nome}: desvantagem`);
    if (e.critProximo) out.push(`${nome}: acerto a 1,5 m é crítico`);
  }
  if (ativo(f, "ataque-descuidado")) out.push("Ataque Descuidado: vantagem");
  return out;
}

// ============================ DESLOCAMENTO E PV MÁXIMOS ============================
export function deslocamentoEfetivo(base: number, f: EstadoJogo): { valor: number; motivos: string[] } {
  const exa = f.exaustao ?? 0;
  const motivos: string[] = [];
  for (const id of condicoesEfetivas(f)) if (condicaoDe(id)?.efeitos.deslocamentoZero) motivos.push(condicaoDe(id)!.nome);
  if (exa >= 5) motivos.push("Exaustão 5");
  if (motivos.length) return { valor: 0, motivos };
  if (exa >= 2) return { valor: Math.floor(base / 2 * 10) / 10, motivos: ["Exaustão 2: metade"] };
  return { valor: base, motivos: [] };
}
export const pvMaxEfetivo = (pvMax: number, f: Pick<FichaDnd, "exaustao">) => ((f.exaustao ?? 0) >= 4 ? Math.max(1, Math.floor(pvMax / 2)) : pvMax);

// ============================ DANO, CURA, MORTE ============================
export type Defesas = { resistencias: string[]; vulnerabilidades: string[]; imunidades: string[] };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const tem = (lista: readonly string[], tipo: string) => !!tipo && lista.some((x) => norm(x) === norm(tipo));
export const TIPOS_DE_DANO = ["ácido", "concussão", "cortante", "elétrico", "energia", "fogo", "frio", "necrótico", "perfurante", "psíquico", "radiante", "trovejante", "veneno"];

/** Defesas somadas: manuais da ficha, as da raça/itens (calculadas) e as de características ligadas (Fúria). */
export function defesasDe(f: Pick<FichaDnd, "defesas" | "ativos" | "condicoes" | "pv" | "morteFalhas" | "morteSucessos" | "exaustao">, calculadas: readonly string[] = []): Defesas {
  const res = [...(f.defesas?.resistencias ?? []), ...calculadas];
  if (ativo(f, "furia")) res.push("contundente", "concussão", "cortante", "perfurante");
  if (condicoesEfetivas(f).some((id) => condicaoDe(id)?.efeitos.resistenciaTotal)) res.push(...TIPOS_DE_DANO);
  return { resistencias: res, vulnerabilidades: f.defesas?.vulnerabilidades ?? [], imunidades: f.defesas?.imunidades ?? [] };
}

export type EntradaDano = { valor: number; tipo?: string; critico?: boolean; defesas: Defesas };
export type ResultadoDano = { ficha: FichaDnd; texto: string[]; final: number; morreu: boolean; caiu: boolean };

/** Aplica dano: defesas → PV temporários → PV; morte instantânea; a 0 PV cada golpe é uma falha (crítico, duas). */
export function aplicarDano(f: FichaDnd, d: EntradaDano): ResultadoDano {
  const texto: string[] = [];
  let v = Math.max(0, Math.floor(d.valor));
  if (d.tipo) {
    if (tem(d.defesas.imunidades, d.tipo)) { texto.push(`Imune a ${d.tipo}: dano 0.`); v = 0; }
    else {
      if (tem(d.defesas.resistencias, d.tipo)) { v = Math.floor(v / 2); texto.push(`Resistência a ${d.tipo}: dano pela metade (${v}).`); }
      if (tem(d.defesas.vulnerabilidades, d.tipo)) { v *= 2; texto.push(`Vulnerável a ${d.tipo}: dano dobrado (${v}).`); }
    }
  }
  const final = v;
  if (v === 0 || estadoVital(f) === "morto") return { ficha: f, texto, final, morreu: estadoVital(f) === "morto", caiu: false };
  const absorvido = Math.min(f.pvTemp, v);
  let restante = v - absorvido;
  const base: FichaDnd = { ...f, pvTemp: f.pvTemp - absorvido };
  if (absorvido) texto.push(`${absorvido} absorvido pelos PV temporários.`);
  if (restante === 0) return { ficha: base, texto, final, morreu: false, caiu: false };

  if (f.pv <= 0) { // já a 0 PV
    if (restante >= f.pvMax) { texto.push("Dano igual ou maior que os PV máximos: morte instantânea."); return { ficha: { ...base, morteFalhas: 3 }, texto, final, morreu: true, caiu: false }; }
    const falhas = Math.min(3, f.morteFalhas + (d.critico ? 2 : 1));
    texto.push(`Dano a 0 PV: ${d.critico ? "2 falhas (crítico)" : "1 falha"} na salvaguarda de morte.`);
    return { ficha: { ...base, morteFalhas: falhas, morteSucessos: f.morteSucessos >= 3 ? 0 : f.morteSucessos }, texto, final, morreu: falhas >= 3, caiu: false };
  }
  if (restante < f.pv) return { ficha: { ...base, pv: f.pv - restante }, texto, final, morreu: false, caiu: false };
  restante -= f.pv; // dano que passou de 0
  if (restante >= f.pvMax) { texto.push("O dano restante iguala ou passa os PV máximos: morte instantânea."); return { ficha: { ...base, pv: 0, morteFalhas: 3, morteSucessos: 0 }, texto, final, morreu: true, caiu: false }; }
  texto.push("Chegou a 0 PV: inconsciente e fazendo salvaguardas de morte.");
  return { ficha: { ...base, pv: 0, morteFalhas: 0, morteSucessos: 0 }, texto, final, morreu: false, caiu: true };
}

/** Cura: sobe de 0 PV zera as salvaguardas de morte; morto não recebe cura (precisa ser revivido pelo mestre). */
export function aplicarCura(f: FichaDnd, valor: number, pvMax = f.pvMax): FichaDnd {
  if (estadoVital(f) === "morto" || valor <= 0) return f;
  return { ...f, pv: Math.min(pvMax, f.pv + Math.floor(valor)), morteSucessos: 0, morteFalhas: 0 };
}

/** Resultado do d20 da salvaguarda de morte: 20 volta com 1 PV; 1 são duas falhas; 10+ é sucesso. */
export function salvaguardaDeMorte(f: FichaDnd, d20: number): { ficha: FichaDnd; texto: string } {
  if (f.pv > 0 || estadoVital(f) === "morto" || estadoVital(f) === "estavel") return { ficha: f, texto: "Não precisa de salvaguarda de morte." };
  if (d20 === 20) return { ficha: { ...f, pv: 1, morteSucessos: 0, morteFalhas: 0 }, texto: "20 natural: volta com 1 PV." };
  if (d20 === 1) {
    const falhas = Math.min(3, f.morteFalhas + 2);
    return { ficha: { ...f, morteFalhas: falhas }, texto: falhas >= 3 ? "1 natural: duas falhas. Morreu." : "1 natural: duas falhas." };
  }
  if (d20 >= 10) {
    const s = Math.min(3, f.morteSucessos + 1);
    return { ficha: { ...f, morteSucessos: s }, texto: s >= 3 ? "Sucesso: três sucessos, estabilizado." : "Sucesso." };
  }
  const falhas = Math.min(3, f.morteFalhas + 1);
  return { ficha: { ...f, morteFalhas: falhas }, texto: falhas >= 3 ? "Falha: três falhas. Morreu." : "Falha." };
}

/** Estabilizar (Medicina, magia ou cura): três sucessos sem recuperar PV. */
export const estabilizar = (f: FichaDnd): FichaDnd => (f.pv <= 0 && estadoVital(f) !== "morto" ? { ...f, morteSucessos: 3, morteFalhas: 0 } : f);

