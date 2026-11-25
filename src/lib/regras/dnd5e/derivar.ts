// `derivar`: função pura ficha + catálogo → números finais, cada um com a origem das partes.
// Fase 3: atributos finais (raça, sub-raça, talentos, escolhas), proficiência, salvaguardas, perícias com a fonte,
// PV, deslocamento, idiomas/armas/armaduras/ferramentas/resistências e as características por fonte. A CA por
// armadura vem na Fase 4 (por ora: 10 + Des). Sem `ficha.build` (fichas antigas / importadas do PDF) nada é
// recalculado: vale o que está na ficha.

import { caracteristicasSubAteNivel } from "./niveisSubclasse.ts";
import { ATRIBUTOS, bonusProficiencia, modificador, pesoTotal, type Ataque, type Atributo, type FichaDnd } from "../../dnd5e.ts";
import { MAX_SINTONIZADOS, ataquesDeArmas, capacidadeDeCarga, itensDeTexto, partesDeCa, proficienteEmArmadura, sintonizados } from "./equipamento.ts";
import { resolver, type Efeito, type Valor } from "../efeitos.ts";
import { nivelTotal, type Ajuste, type Build, type Escolhas } from "./build.ts";
import type { ArmaCat, ArmaduraCat, Catalogo, Concessoes, EscolhaDef, EscolhaOpcao, EscudoCat, Traco } from "./catalogo.ts";
import { opcaoAtiva, type OpcoesMesa, type Violacao } from "../sistema.ts";
import { dnd5e } from "./sistema.ts";
import { PROF_MULTICLASSE, conferirRequisitos, textoRequisito, lerRequisito } from "./multiclasse.ts";

export type TipoFonte = "raca" | "subraca" | "antecedente" | "classe" | "subclasse" | "talento";

/** Uma fonte ativa do build, já com as escolhas aplicadas. */
export type FonteAtiva = {
  id: string;
  nome: string;
  tipo: TipoFonte;
  efeitos: Efeito[];
  concede: Required<Concessoes>;
  tracos: Traco[];
  /** Escolhas ainda não feitas (ou incompletas). */
  pendentes: { escolha: EscolhaDef; faltam: number }[];
  /** Talentos e truques escolhidos por esta fonte (ex.: humano variante). */
  talentos: string[];
  truques: string[];
};

export type ItemComFonte = { nome: string; fonte: string };

export type FichaCalculada = {
  /** `false` = ficha sem build: números copiados da ficha, sem recálculo. */
  automatica: boolean;
  nivel: number;
  proficiencia: number;
  atributos: Record<Atributo, Valor>;
  mods: Record<Atributo, number>;
  salvaguardas: Record<Atributo, Valor>;
  /** Atributos com proficiência na salvaguarda (da primeira classe). */
  salvaguardasProf: Record<Atributo, boolean>;
  iniciativa: Valor;
  ca: Valor;
  deslocamento: Valor;
  pvMax: Valor;
  dadoVida: string;
  pericias: Record<string, { nivel: 0 | 1 | 2; fontes: string[] }>;
  armas: ItemComFonte[];
  armaduras: ItemComFonte[];
  ferramentas: ItemComFonte[];
  idiomas: ItemComFonte[];
  resistencias: ItemComFonte[];
  fontes: FonteAtiva[];
  /** Linhas de ataque das armas equipadas (e desarmado), calculadas do inventário. */
  ataques: Ataque[];
  /** Pesos em kg e capacidade pela Força. */
  carga: { peso: number; capacidade: number };
  /** Itens sintonizados (máximo 3). */
  sintonizados: number;
  /** Usa armadura ou escudo sem proficiência (desvantagem em jogadas de For/Des). */
  armaduraSemProf: boolean;
  /** Alertas de regra (armadura sem proficiência, Força insuficiente, sobrecarga...). */
  avisos: string[];
  /** Alvos com ajuste manual aplicado (para sinalizar "fora do livro"). */
  ajustados: string[];
};

const alvoAtr = (a: Atributo) => `atr.${a}`;
const vazio = (): Required<Concessoes> => ({ pericias: [], idiomas: [], armas: [], armaduras: [], ferramentas: [], resistencias: [] });
const juntar = (a: Required<Concessoes>, b: Concessoes | undefined) => {
  for (const k of Object.keys(a) as (keyof Concessoes)[]) a[k].push(...(b?.[k] ?? []));
};
const opcaoId = (o: string | EscolhaOpcao) => (typeof o === "string" ? o : o.id);

/** Aplica as escolhas feitas a uma fonte: gera efeitos e concessões, e lista o que falta decidir. */
function aplicarEscolhas(defs: EscolhaDef[] | undefined, sel: Escolhas | undefined, origem: string) {
  const efeitos: Efeito[] = [];
  const concede = vazio();
  const pendentes: FonteAtiva["pendentes"] = [];
  const talentos: string[] = [];
  const truques: string[] = [];
  for (const def of defs ?? []) {
    const feitas = (sel?.[def.id] ?? []).slice(0, def.qtd);
    if (feitas.length < def.qtd) pendentes.push({ escolha: def, faltam: def.qtd - feitas.length });
    for (const v of feitas) {
      switch (def.tipo) {
        case "atributo": efeitos.push({ alvo: `atr.${v}`, op: "somar", valor: def.valor ?? 1, origem }); break;
        case "pericia": concede.pericias.push(v); break;
        case "idioma": concede.idiomas.push(v); break;
        case "ferramenta": concede.ferramentas.push(v); break;
        case "talento": talentos.push(v); break;
        case "truque": truques.push(v); break;
        case "opcao": juntar(concede, (def.opcoes?.find((o) => opcaoId(o) === v) as EscolhaOpcao | undefined)?.concede); break;
      }
    }
  }
  return { efeitos, concede, pendentes, talentos, truques };
}

function fonteDe(tipo: TipoFonte, c: { id: string; nome: string; efeitos?: Efeito[]; concede?: Concessoes; escolhas?: EscolhaDef[]; tracos?: Traco[] }, sel: Escolhas | undefined): FonteAtiva {
  const e = aplicarEscolhas(c.escolhas, sel, c.nome);
  const concede = vazio();
  juntar(concede, c.concede);
  juntar(concede, e.concede);
  return {
    id: c.id, nome: c.nome, tipo,
    efeitos: [...(c.efeitos ?? []).map((x) => ({ ...x, origem: x.origem ?? c.nome })), ...e.efeitos],
    concede, tracos: c.tracos ?? [], pendentes: e.pendentes, talentos: e.talentos, truques: e.truques,
  };
}

/** Fontes ativas do build: raça (+ sub-raça), antecedente, classe(s) e talentos (se a mesa os permite). */
export function fontesDoBuild(b: Build, cat: Catalogo, opcoes?: OpcoesMesa): FonteAtiva[] {
  const fontes: FonteAtiva[] = [];
  const raca = b.raca && cat.raca(b.raca.id);
  if (raca) {
    fontes.push(fonteDe("raca", raca, b.raca?.escolhas));
    const sub = raca.sub?.find((s) => s.id === b.raca?.sub);
    if (sub) fontes.push(fonteDe("subraca", sub, b.raca?.escolhas));
  }
  const ant = b.antecedente && cat.antecedente(b.antecedente.id);
  if (ant) {
    const f = fonteDe("antecedente", ant, b.antecedente?.escolhas);
    if (ant.caracteristica) f.tracos = [{ id: "caracteristica", nome: ant.caracteristica.nome, texto: ant.caracteristica.texto }, ...f.tracos];
    fontes.push(f);
  }
  b.classes.forEach((c, i) => {
    const cl = cat.classe(c.id);
    if (!cl) return;
    const concede = vazio();
    // a primeira classe dá as proficiências iniciais completas; as demais, só as da tabela de multiclasse
    if (i === 0) concede.pericias.push(...(c.escolhas?.pericias ?? []).slice(0, cl.pericias?.qtd ?? 0));
    else {
      const pm = PROF_MULTICLASSE[c.id];
      if (pm) {
        concede.armaduras.push(...(pm.armaduras ?? []));
        concede.armas.push(...(pm.armas ?? []));
        concede.ferramentas.push(...(pm.ferramentas ?? []), ...(pm.instrumento ? (c.escolhas?.ferramentas ?? []).slice(0, 1) : []));
        if (pm.pericia) concede.pericias.push(...(c.escolhas?.pericias ?? []).slice(0, 1));
      }
    }
    const tracos: Traco[] = (cl.caracteristicas ?? []).filter((x) => (x.nivel ?? 1) <= c.nivel).map((x) => ({ id: x.id, nome: x.nome, texto: x.texto }));
    fontes.push({ id: cl.id, nome: b.classes.length > 1 ? `${cl.nome} ${c.nivel}${i > 0 ? " (multiclasse)" : ""}` : `${cl.nome} ${c.nivel}`, tipo: "classe", efeitos: [], concede, tracos, pendentes: [], talentos: [], truques: [] });
    const sub = c.subclasse ? cl.subclasses?.find((s) => s.id === c.subclasse) : undefined;
    if (sub && c.nivel >= (cl.subclasseNivel ?? 1)) {
      fontes.push({ id: sub.id, nome: sub.nome, tipo: "subclasse", efeitos: [], concede: vazio(), tracos: caracteristicasSubAteNivel(sub, c.nivel, cl.subclasseNivel ?? 1), pendentes: [], talentos: [], truques: [] });
    }
  });
  if (opcaoAtiva(dnd5e, opcoes, "talentos")) {
    const ids = new Set([...(b.talentos ?? []), ...fontes.flatMap((f) => f.talentos), ...(b.historicoNiveis ?? []).flatMap((p) => (p.incremento?.talento ? [p.incremento.talento] : []))]);
    for (const id of ids) {
      const t = cat.talento(id);
      if (t) fontes.push(fonteDe("talento", t, b.escolhasTalentos?.[id]));
    }
  }
  return fontes;
}

/** Aumentos de atributo ganhos por nível (histórico) viram efeitos, com o nível de origem. */
function efeitosDeIncrementos(b: Build): Efeito[] {
  const out: Efeito[] = [];
  (b.historicoNiveis ?? []).forEach((p, i) => {
    for (const [a, v] of Object.entries(p.incremento?.atributos ?? {})) if (v) out.push({ alvo: `atr.${a}`, op: "somar", valor: v, origem: `Aumento de atributo (${i + 2}º nível)` });
  });
  return out;
}

/** Ajustes manuais viram efeitos comuns, com rótulo claro. */
function efeitosDeAjustes(ajustes: Record<string, Ajuste> | undefined): Efeito[] {
  const out: Efeito[] = [];
  for (const [alvo, a] of Object.entries(ajustes ?? {})) {
    const rotulo = a.rotulo ?? "Ajuste manual";
    if (a.substituir !== undefined) out.push({ alvo, op: "definir", valor: a.substituir, origem: rotulo, prioridade: 1000 });
    if (a.somar) out.push({ alvo, op: "somar", valor: a.somar, origem: rotulo });
  }
  return out;
}

/** Com classes de dados de vida diferentes a ficha mostra um só tipo: o da classe com mais níveis (empate: o maior). */
function dadoDeVidaPrincipal(b: Build | undefined, cat: Catalogo): string | undefined {
  if (!b || b.classes.length < 2) return undefined;
  const lista = b.classes.map((c) => ({ nivel: c.nivel, dado: cat.classe(c.id)?.dadoVida ?? 0 })).filter((x) => x.dado);
  lista.sort((a, c) => c.nivel - a.nivel || c.dado - a.dado);
  return lista[0] ? `d${lista[0].dado}` : undefined;
}

const fixo = (valor: number, rotulo: string): Valor => ({ total: valor, partes: [{ rotulo, valor }] });
const media = (dado: number) => Math.floor(dado / 2) + 1;

/** Classe de cada nível, em ordem (primeira classe primeiro). */
function sequenciaDeClasses(b: Build): string[] {
  return b.classes.flatMap((c) => Array.from({ length: Math.max(0, c.nivel) }, () => c.id));
}

function calcularPv(b: Build, cat: Catalogo, nivel: number, modCon: number, efeitos: Efeito[]): Valor {
  const seq = sequenciaDeClasses(b);
  const dado = (id: string | undefined) => cat.classe(id ?? "")?.dadoVida ?? 8;
  const dv1 = dado(seq[0]);
  const v1 = b.pvNivel1 !== undefined ? Math.min(dv1, Math.max(1, b.pvNivel1)) : dv1;
  const partes = [{ rotulo: b.pvNivel1 !== undefined ? `Nível 1 (d${dv1}: ${v1})` : `Nível 1 (dado máximo d${dv1})`, valor: v1 }];
  let niveis2 = 0;
  for (let i = 1; i < nivel; i++) {
    const passo = b.historicoNiveis?.[i - 1];
    const d = dado(passo?.classe ?? seq[i]);
    niveis2 += passo && passo.pv !== "medio" ? Math.max(1, passo.pv) : media(d);
  }
  if (nivel > 1) partes.push({ rotulo: `Níveis 2 a ${nivel} (média/rolados)`, valor: niveis2 });
  partes.push({ rotulo: `Constituição (${modCon >= 0 ? "+" : "−"}${Math.abs(modCon)}) × ${nivel}`, valor: modCon * nivel });
  const porNivel: Efeito[] = efeitos.filter((e) => e.alvo === "pv.porNivel" && e.op === "somar").map((e) => ({ alvo: "pv.max", op: "somar" as const, valor: e.valor * nivel, origem: `${e.origem} (×${nivel} níveis)` }));
  const base = { rotulo: partes[0].rotulo, valor: partes[0].valor };
  const r = resolver("pv.max", base, [...efeitos, ...porNivel, ...partes.slice(1).map((p) => ({ alvo: "pv.max", op: "somar" as const, valor: p.valor, origem: p.rotulo }))]);
  const total = Math.max(1, r.total);
  return total === r.total ? r : { total, partes: [...r.partes, { rotulo: "Mínimo de 1", valor: total - r.total }] };
}

export function derivar(ficha: FichaDnd, cat: Catalogo, opcoes?: OpcoesMesa): FichaCalculada {
  const b = ficha.build;
  const automatica = !!b;
  const nivel = b ? Math.max(1, nivelTotal(b)) : ficha.nivel;
  const proficiencia = bonusProficiencia(nivel);

  const fontes = b ? fontesDoBuild(b, cat, opcoes) : [];
  const efeitos: Efeito[] = b ? [...fontes.flatMap((f) => f.efeitos), ...efeitosDeIncrementos(b), ...efeitosDeAjustes(b.ajustes)] : [];
  const baseAtr = (a: Atributo) => (b ? b.atributosBase[a] : ficha.atributos[a]);

  const atributos = {} as Record<Atributo, Valor>;
  const mods = {} as Record<Atributo, number>;
  for (const a of ATRIBUTOS) {
    atributos[a] = resolver(alvoAtr(a), { rotulo: "Base", valor: baseAtr(a) }, efeitos);
    mods[a] = modificador(atributos[a].total);
  }

  const classe1 = b ? cat.classe(b.classes[0]?.id ?? "") : undefined;
  const salvaguardasProf = {} as Record<Atributo, boolean>;
  const salvaguardas = {} as Record<Atributo, Valor>;
  for (const a of ATRIBUTOS) {
    const prof = b ? !!classe1?.salvaguardas.includes(a) : ficha.salvaguardas[a];
    salvaguardasProf[a] = prof;
    const extra = resolver(`salv.${a}`, { rotulo: "", valor: 0 }, efeitos);
    const partes = [{ rotulo: "Modificador", valor: mods[a] }, ...(prof ? [{ rotulo: "Proficiência", valor: proficiencia }] : []), ...extra.partes.slice(1)];
    salvaguardas[a] = { total: partes.reduce((s, p) => s + p.valor, 0), partes };
  }

  const ini = resolver("iniciativa", { rotulo: "Destreza", valor: mods.des }, efeitos);
  const iniciativa: Valor = b ? ini : { total: mods.des + ficha.bonusIniciativa, partes: [{ rotulo: "Destreza", valor: mods.des }, ...(ficha.bonusIniciativa ? [{ rotulo: "Bônus", valor: ficha.bonusIniciativa }] : [])] };

  // proficiências e idiomas, cada um com a fonte
  const pericias: FichaCalculada["pericias"] = {};
  const acumular = (lista: ItemComFonte[], itens: string[], fonte: string) => {
    for (const nome of itens) if (!lista.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) lista.push({ nome, fonte });
  };
  const armas: ItemComFonte[] = [], armaduras: ItemComFonte[] = [], ferramentas: ItemComFonte[] = [], idiomas: ItemComFonte[] = [], resistencias: ItemComFonte[] = [];
  for (const f of fontes) {
    for (const id of f.concede.pericias) {
      const p = (pericias[id] ??= { nivel: 0, fontes: [] });
      p.nivel = 1;
      if (!p.fontes.includes(f.nome)) p.fontes.push(f.nome);
    }
    acumular(armas, f.concede.armas, f.nome);
    acumular(armaduras, f.concede.armaduras, f.nome);
    acumular(ferramentas, f.concede.ferramentas, f.nome);
    acumular(idiomas, f.concede.idiomas, f.nome);
    acumular(resistencias, f.concede.resistencias, f.nome);
  }
  for (const id of b?.periciasExtras ?? []) {
    const p = (pericias[id] ??= { nivel: 0, fontes: [] });
    p.nivel = 1;
    p.fontes.push("Manual");
  }
  for (const id of b?.especialistas ?? []) if (pericias[id]) { pericias[id].nivel = 2; pericias[id].fontes.push("Especialização"); }

  // proficiências de armas, armaduras e ferramentas da primeira classe (só ela dá as iniciais)
  const cl0 = b && cat.classe(b.classes[0]?.id ?? "");
  if (cl0) {
    acumular(armas, itensDeTexto(cl0.armas ?? ""), cl0.nome);
    acumular(armaduras, itensDeTexto(cl0.armaduras ?? ""), cl0.nome);
    acumular(ferramentas, itensDeTexto(cl0.ferramentas ?? ""), cl0.nome);
  }

  // equipamento: CA pela armadura, Força mínima, ataques das armas, carga e sintonização
  const avisos: string[] = [];
  let armaduraSemProf = false;
  const equipados = ficha.itens.filter((i) => i.equipado && i.catalogoId);
  const achar = <T extends { tipo: string }>(tipo: T["tipo"]) => equipados.map((i) => ({ i, c: cat.item(i.catalogoId!) })).find((x) => x.c?.tipo === tipo) as { i: (typeof equipados)[number]; c: T } | undefined;
  const armadura = achar<ArmaduraCat>("armadura");
  const escudo = achar<EscudoCat>("escudo");
  const efeitosEquip: Efeito[] = [];
  if (b) {
    const profA = armaduras.map((x) => x.nome);
    if (armadura) {
      if (!proficienteEmArmadura(armadura.c.categoria, profA)) armaduraSemProf = true;
      if (!proficienteEmArmadura(armadura.c.categoria, profA)) avisos.push(`Sem proficiência em armadura ${armadura.c.categoria === "media" ? "média" : armadura.c.categoria}: desvantagem em testes de Força e Destreza e não conjura magias.`);
      if (armadura.c.forca && atributos.for.total < armadura.c.forca) {
        avisos.push(`Força ${atributos.for.total} é menor que a exigida por ${armadura.c.nome} (${armadura.c.forca}): deslocamento −3 m.`);
        efeitosEquip.push({ alvo: "deslocamento", op: "somar", valor: -3, origem: `Força insuficiente (${armadura.c.nome})` });
      }
      if (armadura.c.furtividadeDesv) avisos.push(`${armadura.c.nome} impõe desvantagem em Furtividade.`);
    }
    if (escudo && !proficienteEmArmadura("escudo", profA)) armaduraSemProf = true;
    if (escudo && !proficienteEmArmadura("escudo", profA)) avisos.push("Sem proficiência em escudos: desvantagem em testes de Força e Destreza e não conjura magias.");
  }
  const bonusCaItens: Efeito[] = ficha.itens.filter((i) => i.equipado && i.bonusCa && !(i.catalogoId && ["armadura", "escudo"].includes(cat.item(i.catalogoId)?.tipo ?? ""))).map((i) => ({ alvo: "ca", op: "somar", valor: i.bonusCa!, origem: i.nome || "Item" }));
  let ca: Valor;
  if (b) {
    const pc = partesDeCa({
      mods, classeIds: b.classes.map((c) => c.id), armaduraArcana: (ficha.ativos ?? []).includes("armadura-arcana"),
      armadura: armadura ? { cat: armadura.c, bonusMagico: armadura.i.bonusMagico ?? 0, nome: armadura.i.nome || armadura.c.nome } : undefined,
      escudo: escudo ? { cat: escudo.c, bonusMagico: escudo.i.bonusMagico ?? 0 } : undefined,
    });
    ca = resolver("ca", pc.base, [...efeitos, ...bonusCaItens, ...pc.extras.map((p) => ({ alvo: "ca", op: "somar" as const, valor: p.valor, origem: p.rotulo }))]);
  } else ca = fixo(ficha.ca, "Ficha");

  const deslocamento = b ? resolver("deslocamento", { rotulo: "Base", valor: 9 }, [...efeitos, ...efeitosEquip]) : fixo(parseFloat(ficha.deslocamento.replace(",", ".")) || 9, "Ficha");
  const pvMax = b ? calcularPv(b, cat, nivel, mods.con, efeitos) : fixo(ficha.pvMax, "Ficha");

  const ataques = b ? ataquesDeArmas({ itens: ficha.itens, arma: (id) => { const x = cat.item(id); return x?.tipo === "arma" ? (x as ArmaCat) : undefined; }, mods, proficiencias: armas.map((x) => x.nome) }) : [];
  const peso = pesoTotal(ficha.itens);
  const capacidade = capacidadeDeCarga(atributos.for.total);
  if (peso > capacidade) avisos.push(`Carga de ${peso} kg acima da capacidade (${capacidade} kg).`);
  const sint = sintonizados(ficha.itens);
  if (sint > MAX_SINTONIZADOS) avisos.push(`${sint} itens sintonizados (máximo ${MAX_SINTONIZADOS}).`);

  return {
    automatica, nivel, proficiencia, atributos, mods, salvaguardas, salvaguardasProf, iniciativa, ca, deslocamento, pvMax,
    dadoVida: dadoDeVidaPrincipal(b, cat) ?? (classe1 ? `d${classe1.dadoVida}` : ficha.dadoVida),
    pericias, armas, armaduras, ferramentas, idiomas, resistencias, fontes, ataques, avisos, armaduraSemProf, sintonizados: sint, carga: { peso, capacidade },
    ajustados: Object.keys(b?.ajustes ?? {}),
  };
}

/**
 * Equipamento de uma ficha SEM `build` (manual ou importada do PDF): a CA e as linhas de ataque vêm do que está
 * equipado no inventário (itens do catálogo), sem mexer no resto da ficha. Sem armadura/escudo do catálogo
 * equipados, a CA gravada vale (somando só `bonusCa` de itens equipados). Proficiência de arma é presumida
 * (quem equipou, sabe usar): a ficha manual não tem lista de proficiências.
 */
export function equipamentoManual(ficha: FichaDnd, cat: Catalogo): { ca?: Valor; ataques: Ataque[]; avisos: string[]; armaduraSemProf: boolean } {
  // proficiências: o texto livre "Outras proficiências e idiomas" (Traços), ex.: "Armaduras leves e médias, escudos, armas simples"
  const texto = ficha.proficienciasIdiomas ?? "";
  const profs = [...texto.split(/[\n,;]+|\s+e\s+/).map((x) => x.trim().replace(/\.$/, "")).filter(Boolean),
    ...(/simples/i.test(texto) ? ["Armas simples"] : []), ...(/marciais/i.test(texto) ? ["Armas marciais"] : [])];
  const mods = {} as Record<Atributo, number>;
  for (const a of ATRIBUTOS) mods[a] = modificador(ficha.atributos[a]);
  const equipados = ficha.itens.filter((i) => i.equipado && i.catalogoId);
  const achar = <T extends { tipo: string }>(tipo: T["tipo"]) => equipados.map((i) => ({ i, c: cat.item(i.catalogoId!) })).find((x) => x.c?.tipo === tipo) as { i: (typeof equipados)[number]; c: T } | undefined;
  const armadura = achar<ArmaduraCat>("armadura");
  const escudo = achar<EscudoCat>("escudo");
  const bonusCaItens: Efeito[] = ficha.itens.filter((i) => i.equipado && i.bonusCa && !(i.catalogoId && ["armadura", "escudo"].includes(cat.item(i.catalogoId)?.tipo ?? ""))).map((i) => ({ alvo: "ca", op: "somar", valor: i.bonusCa!, origem: i.nome || "Item" }));
  let ca: Valor | undefined;
  if (armadura || escudo) {
    const classeIds = [ficha.classe, ...(ficha.classes ?? []).map((c) => c.id)].filter((x): x is string => !!x);
    const pc = partesDeCa({
      mods, classeIds, armaduraArcana: (ficha.ativos ?? []).includes("armadura-arcana"),
      armadura: armadura ? { cat: armadura.c, bonusMagico: armadura.i.bonusMagico ?? 0, nome: armadura.i.nome || armadura.c.nome } : undefined,
      escudo: escudo ? { cat: escudo.c, bonusMagico: escudo.i.bonusMagico ?? 0 } : undefined,
    });
    ca = resolver("ca", pc.base, [...bonusCaItens, ...pc.extras.map((p) => ({ alvo: "ca", op: "somar" as const, valor: p.valor, origem: p.rotulo }))]);
  } else if (bonusCaItens.length) {
    ca = resolver("ca", { rotulo: "Ficha", valor: ficha.ca }, bonusCaItens);
  }
  const ataques = ataquesDeArmas({
    itens: ficha.itens, mods, proficiencias: profs,
    arma: (id) => { const x = cat.item(id); return x?.tipo === "arma" ? (x as ArmaCat) : undefined; },
  });
  const avisos: string[] = [];
  let armaduraSemProf = false;
  if (armadura && !proficienteEmArmadura(armadura.c.categoria, profs)) { armaduraSemProf = true; avisos.push(`Sem proficiência em armadura ${armadura.c.categoria === "media" ? "média" : armadura.c.categoria} (confira "Outras proficiências e idiomas" na aba Traços): desvantagem em testes de Força e Destreza e não conjura magias.`); }
  if (escudo && !proficienteEmArmadura("escudo", profs)) { armaduraSemProf = true; avisos.push(`Sem proficiência em escudos (confira "Outras proficiências e idiomas" na aba Traços): desvantagem em testes de Força e Destreza e não conjura magias.`); }
  if (armadura?.c.forca && ficha.atributos.for < armadura.c.forca) avisos.push(`Força ${ficha.atributos.for} é menor que a exigida por ${armadura.c.nome} (${armadura.c.forca}): deslocamento −3 m.`);
  if (armadura?.c.furtividadeDesv) avisos.push(`${armadura.c.nome} impõe desvantagem em Furtividade.`);
  return { ca, ataques, avisos, armaduraSemProf };
}

/** Confere o build contra as regras da mesa. O jogador é bloqueado por isto; o mestre só vê o aviso. */
export function validar(ficha: FichaDnd, cat: Catalogo, opcoes?: OpcoesMesa): Violacao[] {
  const b = ficha.build;
  if (!b) return [];
  const v: Violacao[] = [];
  const talentosOk = opcaoAtiva(dnd5e, opcoes, "talentos");
  if (b.classes.length > 1 && !opcaoAtiva(dnd5e, opcoes, "multiclasse"))
    v.push({ id: "multiclasse.desligada", mensagem: "A mesa não permite multiclasse.", campo: "build.classes" });
  if ((b.talentos?.length || b.historicoNiveis?.some((p) => p.incremento?.talento)) && !talentosOk)
    v.push({ id: "talentos.desligado", mensagem: "A mesa não permite talentos.", campo: "build.talentos" });
  const nivel = nivelTotal(b);
  if (nivel < 1 || nivel > 20) v.push({ id: "nivel.faixa", mensagem: "O nível total deve ficar entre 1 e 20.", campo: "build.classes" });
  if (b.raca && !cat.raca(b.raca.id)) v.push({ id: "raca.desconhecida", mensagem: `Raça "${b.raca.id}" não existe no catálogo.`, campo: "build.raca" });
  const raca = b.raca && cat.raca(b.raca.id);
  if (raca && b.raca?.sub) {
    const sub = raca.sub?.find((s) => s.id === b.raca?.sub);
    if (!sub) v.push({ id: "subraca.desconhecida", mensagem: `Sub-raça "${b.raca.sub}" não existe para ${raca.nome}.`, campo: "build.raca" });
    else if (sub.requer && !opcaoAtiva(dnd5e, opcoes, sub.requer)) v.push({ id: "subraca.requer", mensagem: `${sub.nome} exige a regra opcional "${sub.requer}" na mesa.`, campo: "build.raca" });
  }
  if (b.antecedente && !cat.antecedente(b.antecedente.id)) v.push({ id: "antecedente.desconhecido", mensagem: `Antecedente "${b.antecedente.id}" não existe no catálogo.`, campo: "build.antecedente" });
  for (const c of b.classes) {
    const cl = cat.classe(c.id);
    if (!cl) { v.push({ id: "classe.desconhecida", mensagem: `Classe "${c.id}" não existe no catálogo.`, campo: "build.classes" }); continue; }
    if (c.subclasse && !cl.subclasses?.some((s) => s.id === c.subclasse)) v.push({ id: "subclasse.desconhecida", mensagem: `Subclasse "${c.subclasse}" não existe para ${cl.nome}.`, campo: "build.classes" });
    if (cl.subclasseNivel && c.nivel >= cl.subclasseNivel && !c.subclasse) v.push({ id: "subclasse.pendente", gravidade: "aviso", mensagem: `${cl.nome}: escolha ${cl.subclasseRotulo ?? "a subclasse"} (a partir do ${cl.subclasseNivel}º nível).`, campo: "build.classes" });
    const escolhidas = c.escolhas?.pericias ?? [];
    const q = cl.pericias?.qtd ?? 0;
    const primeira = b.classes[0] === c;
    const pm = PROF_MULTICLASSE[c.id];
    const qEfetiva = primeira ? q : pm?.pericia ? 1 : 0;
    if (primeira && escolhidas.length < q) v.push({ id: "classe.pericias.pendente", gravidade: "aviso", mensagem: `Escolha ${q - escolhidas.length} perícia(s) de ${cl.nome}.`, campo: "build.classes" });
    if (!primeira && pm?.pericia && escolhidas.length < 1) v.push({ id: `classe.pericias.pendente.${c.id}`, gravidade: "aviso", mensagem: `${cl.nome} (multiclasse): escolha 1 perícia.`, campo: "build.classes" });
    if (!primeira && pm?.instrumento && !(c.escolhas?.ferramentas ?? []).length) v.push({ id: `classe.instrumento.pendente.${c.id}`, gravidade: "aviso", mensagem: `${cl.nome} (multiclasse): escolha 1 instrumento musical.`, campo: "build.classes" });
    if (escolhidas.length > qEfetiva) v.push({ id: "classe.pericias.excesso", mensagem: `${cl.nome} permite só ${qEfetiva} perícias.`, campo: "build.classes" });
    if (!primeira && pm?.pericia === "classe" && cl.pericias?.opcoes && escolhidas.some((p) => !cl.pericias!.opcoes!.includes(p))) v.push({ id: "classe.pericias.invalida", mensagem: `Há perícia fora da lista de ${cl.nome}.`, campo: "build.classes" });
    if (primeira && cl.pericias?.opcoes && escolhidas.some((p) => !cl.pericias!.opcoes!.includes(p))) v.push({ id: "classe.pericias.invalida", mensagem: `Há perícia fora da lista de ${cl.nome}.`, campo: "build.classes" });
  }
  if (b.classes.length > 1) {
    const totais = Object.fromEntries(ATRIBUTOS.map((a) => [a, derivar(ficha, cat, opcoes).atributos[a].total])) as Record<Atributo, number>;
    for (const r of conferirRequisitos(b.classes.map((c) => c.id), cat, totais).filter((x) => !x.ok))
      v.push({ id: `multiclasse.requisito.${r.classe}`, gravidade: "aviso", mensagem: `Multiclasse: ${r.nome} pede ${textoRequisito(lerRequisito(r.requisito))}.`, campo: "build.classes" });
  }
  const usados = (b.historicoNiveis ?? []).filter((p) => p.incremento && (p.incremento.talento || Object.keys(p.incremento.atributos ?? {}).length)).length;
  const direito = b.classes.reduce((s, c) => s + (cat.classe(c.id)?.tabela ?? []).filter((t) => t.nivel <= c.nivel && t.caracteristicas.some((x) => /incremento no valor/i.test(x.nome))).length, 0);
  if (usados > direito) v.push({ id: "incremento.excesso", mensagem: `Há ${usados} aumentos de atributo/talentos, mas o nível dá direito a ${direito}.`, campo: "build.historicoNiveis" });
  const calcAtr = derivar(ficha, cat, opcoes);
  for (const a of ATRIBUTOS) if (calcAtr.atributos[a].total > 20 && !b.ajustes?.[`atr.${a}`]) v.push({ id: `atributo.acima20.${a}`, gravidade: "aviso", mensagem: `${a.toUpperCase()} passou de 20 (${calcAtr.atributos[a].total}).`, campo: "build.atributosBase" });
  for (const id of b.talentos ?? []) if (!cat.talento(id)) v.push({ id: "talento.desconhecido", mensagem: `Talento "${id}" não existe no catálogo.`, campo: "build.talentos" });
  for (const f of fontesDoBuild(b, cat, opcoes))
    for (const p of f.pendentes) v.push({ id: `escolha.pendente.${f.id}.${p.escolha.id}`, gravidade: "aviso", mensagem: `${f.nome}: falta escolher ${p.escolha.rotulo.toLowerCase()} (${p.faltam}).`, campo: "build" });
  return v;
}
