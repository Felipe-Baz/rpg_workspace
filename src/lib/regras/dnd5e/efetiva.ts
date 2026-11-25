// Ponte entre o motor (`derivar`) e a ficha "clássica" que a tela já lê: `fichaEfetiva` devolve uma cópia com os
// campos controlados pelo livro substituídos pelos valores derivados; `gravavel` faz o caminho inverso antes de salvar
// (os campos derivados nunca são gravados, ver planejamento §5). Sem `build`, tudo passa direto.
// Também reconhece texto livre de fichas antigas ("Alto Elfo", "Mago 5") e monta o primeiro `build`.

import { ATRIBUTOS, CLASSES_CONJ, PERICIAS, ehConjuradora, type Atributo, type FichaDnd, type ClasseId } from "../../dnd5e.ts";
import { derivar, type FichaCalculada } from "./derivar.ts";
import type { Build } from "./build.ts";
import type { Catalogo } from "./catalogo.ts";
import type { OpcoesMesa } from "../sistema.ts";

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Campos da ficha clássica que passam a ser calculados quando há `build`. */
const DERIVADOS = ["atributos", "salvaguardas", "pericias", "nivel", "pvMax", "dadoVida", "dadosVidaTotal", "deslocamento", "classe", "subclasse", "raca", "antecedente", "ca", "bonusIniciativa"] as const;

export function fichaEfetiva(ficha: FichaDnd, calc: FichaCalculada, cat: Catalogo): FichaDnd {
  const b = ficha.build;
  if (!b || !calc.automatica) return ficha;
  const atributos = {} as Record<Atributo, number>;
  for (const a of ATRIBUTOS) atributos[a] = calc.atributos[a].total;
  const pericias: FichaDnd["pericias"] = {};
  for (const p of PERICIAS) {
    const n = calc.pericias[p.id]?.nivel ?? 0;
    if (n) pericias[p.id] = n;
  }
  const c0 = b.classes[0];
  const cl = c0 && cat.classe(c0.id);
  const sub = cl?.subclasses?.find((s) => s.id === c0?.subclasse);
  // multiclasse: o nível em cada classe e as subclasses de todas (texto)
  const multi = b.classes.length > 1;
  const subclasses = b.classes.map((k) => cat.classe(k.id)?.subclasses?.find((s) => s.id === k.subclasse)?.nome).filter(Boolean).join(" / ");
  const raca = b.raca && cat.raca(b.raca.id);
  const subRaca = raca?.sub?.find((s) => s.id === b.raca?.sub);
  return {
    ...ficha,
    atributos, salvaguardas: calc.salvaguardasProf, pericias,
    nivel: calc.nivel, pvMax: calc.pvMax.total, pv: Math.min(ficha.pv, calc.pvMax.total),
    dadoVida: calc.dadoVida, dadosVidaTotal: calc.nivel,
    ca: calc.ca.total,
    // efeitos de iniciativa (talento Alerta etc.) entram como bônus; o campo gravado continua sendo só o bônus manual
    bonusIniciativa: ficha.bonusIniciativa + (calc.iniciativa.total - calc.mods.des),
    ataques: [...calc.ataques, ...ficha.ataques.filter((a) => !a.derivado)],
    deslocamento: `${fmt(calc.deslocamento.total)} m`,
    classe: (c0?.id as ClasseId | undefined) ?? ficha.classe,
    // classe única conjuradora: o atributo de conjuração é o da classe (multiclasse e subclasses conjuradoras seguem o valor da ficha)
    atrConjuracao: !multi && c0 && ehConjuradora(c0.id as ClasseId) ? CLASSES_CONJ[c0.id as keyof typeof CLASSES_CONJ].atr : ficha.atrConjuracao,
    subclasse: multi ? subclasses : sub?.nome ?? "",
    ...(multi ? { classes: b.classes.map((k) => ({ id: k.id, nivel: k.nivel })) } : { classes: undefined }),
    raca: subRaca && raca && subRaca.id !== `${raca.id}-padrao` ? subRaca.nome : raca?.nome ?? ficha.raca,
    antecedente: (b.antecedente && cat.antecedente(b.antecedente.id)?.nome) || ficha.antecedente,
  };
}

/** Prepara a ficha editada (efetiva) para gravar: devolve os campos derivados aos valores gravados. */
export function gravavel(bruta: FichaDnd, editada: FichaDnd): FichaDnd {
  if (!bruta.build) return editada;
  const out = { ...editada, build: editada.build ?? bruta.build } as FichaDnd & Record<string, unknown>;
  for (const k of DERIVADOS) (out as Record<string, unknown>)[k] = bruta[k];
  out.pv = Math.max(0, editada.pv);
  out.classes = undefined; // derivado do build
  out.ataques = editada.ataques.filter((a) => !a.derivado); // linhas das armas são recalculadas, nunca gravadas
  return out;
}

// ---------- reconhecer texto livre ----------
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function reconhecerRaca(texto: string, cat: Catalogo): { id: string; sub?: string } | undefined {
  const t = norm(texto);
  if (!t) return undefined;
  let melhor: { id: string; sub?: string; peso: number } | undefined;
  for (const r of cat.racas()) {
    for (const s of r.sub ?? []) {
      const n = norm(s.nome.replace(/\(.*\)/, ""));
      if (n && t.includes(n) && (!melhor || n.length > melhor.peso)) melhor = { id: r.id, sub: s.id, peso: n.length };
    }
    const n = norm(r.nome);
    if (t.includes(n) && (!melhor || n.length > melhor.peso)) melhor = { id: r.id, sub: r.sub?.find((s) => s.id === `${r.id}-padrao`)?.id, peso: n.length };
  }
  return melhor && { id: melhor.id, ...(melhor.sub ? { sub: melhor.sub } : {}) };
}

export function reconhecerAntecedente(texto: string, cat: Catalogo): string | undefined {
  const t = norm(texto);
  return t ? cat.antecedentes().find((a) => t.includes(norm(a.nome)))?.id : undefined;
}

/**
 * Monta o primeiro `build` de uma ficha antiga, sem mudar nenhum número visível: tira da base os bônus fixos da raça
 * reconhecida, guarda como "extra" as proficiências que o livro não explica e compensa a diferença de PV com um ajuste.
 * O que não for reconhecido continua como texto livre nos campos antigos.
 */
export function construirBuildDeFicha(f: FichaDnd, cat: Catalogo, opcoes?: OpcoesMesa): Build {
  const classeId = f.classe && cat.classe(f.classe) ? f.classe : undefined;
  const cl = classeId ? cat.classe(classeId) : undefined;
  const raca = reconhecerRaca(f.raca, cat);
  const antecedente = reconhecerAntecedente(f.antecedente, cat);
  const sub = cl?.subclasses?.find((s) => norm(`${f.subclasse}`).includes(norm(s.nome.replace(/^(Escola|Caminho|Colégio|Círculo|Domínio|Juramento|Arquétipo|Tradição|Conclave|Origem|Patrono)( d[aeo]s?)?/i, ""))) && norm(s.nome).length > 3);

  const base = { ...f.atributos };
  const rascunho: Build = {
    raca, antecedente: antecedente ? { id: antecedente } : undefined,
    classes: classeId ? [{ id: classeId, nivel: f.nivel, ...(sub ? { subclasse: sub.id } : {}) }] : [],
    atributosBase: base, metodoAtributos: "manual",
  };
  // tira os bônus fixos da raça (as escolhas ficam pendentes para o jogador completar)
  const semEscolhas = derivar({ ...f, build: { ...rascunho, atributosBase: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 } } }, cat, opcoes);
  for (const a of ATRIBUTOS) base[a] = f.atributos[a] - (semEscolhas.atributos[a].total - 0);

  // perícias: as da classe escolhidas entre as que a ficha já tinha; o resto, se não explicado pelo livro, vira extra
  if (cl && rascunho.classes[0]) {
    const opcoesCl = cl.pericias?.opcoes;
    const tem = PERICIAS.map((p) => p.id).filter((id) => (f.pericias[id] ?? 0) > 0);
    const jaExplicadas = new Set(Object.keys(derivar({ ...f, build: rascunho }, cat, opcoes).pericias));
    const escolhidas = tem.filter((id) => !jaExplicadas.has(id) && (!opcoesCl || opcoesCl.includes(id))).slice(0, cl.pericias?.qtd ?? 0);
    rascunho.classes[0].escolhas = { pericias: escolhidas };
  }
  const calc = derivar({ ...f, build: rascunho }, cat, opcoes);
  const extras = PERICIAS.map((p) => p.id as string).filter((id) => (f.pericias[id as keyof typeof f.pericias] ?? 0) > 0 && !calc.pericias[id]);
  if (extras.length) rascunho.periciasExtras = extras;
  const esp = PERICIAS.map((p) => p.id as string).filter((id) => f.pericias[id as keyof typeof f.pericias] === 2);
  if (esp.length) rascunho.especialistas = esp;
  const final = derivar({ ...f, build: rascunho }, cat, opcoes);
  const dif = f.pvMax - final.pvMax.total;
  if (dif !== 0) rascunho.ajustes = { ...(rascunho.ajustes ?? {}), "pv.max": { somar: dif, rotulo: "Ficha anterior" } };
  const difCa = f.ca - final.ca.total;
  if (difCa !== 0) rascunho.ajustes = { ...(rascunho.ajustes ?? {}), ca: { somar: difCa, rotulo: "Ficha anterior" } };
  return rascunho;
}

