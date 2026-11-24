// Visão do mestre sobre o grupo: uma linha por personagem (já com os valores calculados), o resumo do grupo para planejar
// encontros e as operações de dano/cura/condição que viram atualização por campo. Puro; a leitura das fichas é da interface.

import { PERICIAS, cdMagia, contagemMagias, percepcaoPassiva, type FichaDnd } from "../../dnd5e.ts";
import { aplicarCura, aplicarDano, condicaoDe, condicoesEfetivas, defesasDe, estadoVital, pvMaxEfetivo, type EstadoVital } from "./combate.ts";
import type { Catalogo } from "./catalogo.ts";
import { validar, type FichaCalculada } from "./derivar.ts";
import { podeSubirDeNivel } from "./progressao.ts";
import type { OpcoesMesa } from "../sistema.ts";

export type PatchEstado = Partial<Pick<FichaDnd, "pv" | "pvTemp" | "morteSucessos" | "morteFalhas" | "condicoes" | "exaustao" | "concentracao" | "ativos">>;

export type LinhaGrupo = {
  uid: string;
  nome: string;
  classe: string;
  nivel: number;
  pv: number;
  pvMax: number;
  pvTemp: number;
  ca: number;
  /** CD de magia, ou `null` sem atributo de conjuração. */
  cd: number | null;
  percepcao: number;
  deslocamento: string;
  condicoes: string[];
  concentracao?: string;
  vital: EstadoVital;
  /** O XP já dá direito a um nível acima do atual. */
  podeSubir: boolean;
  /** Ids das perícias em que o personagem tem proficiência. */
  pericias: string[];
  idiomas: string[];
  automatica: boolean;
  /** Motivos para o mestre conferir esta ficha (valor fora do livro, ficha manual, alertas). */
  conferir: string[];
};

const sinal = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/** Resumo de uma ficha. `efetiva` é a ficha com os valores calculados; `bruta` é a gravada (de onde vem o `build`). */
export function linhaDoGrupo(uid: string, nomePadrao: string, bruta: FichaDnd, efetiva: FichaDnd, calc: FichaCalculada | null, cat: Catalogo | null, opcoes?: OpcoesMesa): LinhaGrupo {
  const conferir: string[] = [];
  const b = bruta.build;
  if (!b) conferir.push("Ficha manual: os números não são conferidos pelo livro.");
  else if (cat) {
    for (const v of validar(bruta, cat, opcoes)) {
      if (v.gravidade === "aviso") { if (v.id.startsWith("escolha.pendente") || v.id.endsWith("pendente")) conferir.push(v.mensagem); }
      else conferir.push(v.mensagem);
    }
    for (const [alvo, a] of Object.entries(b.ajustes ?? {})) conferir.push(`Ajuste fora do livro em ${alvo}: ${a.substituir !== undefined ? `= ${a.substituir}` : sinal(a.somar ?? 0)}${a.rotulo ? ` (${a.rotulo})` : ""}.`);
    if (b.periciasExtras?.length) conferir.push(`${b.periciasExtras.length} proficiência(s) em perícia que o livro não explica.`);
    for (const a of calc?.avisos ?? []) conferir.push(a);
  }
  if (efetiva.pv > efetiva.pvMax) conferir.push("PV atuais acima do máximo.");
  const cont = contagemMagias(efetiva);
  if (cont.lim && (cont.truques > cont.lim.truques || cont.magias > cont.lim.magias)) conferir.push("Magias ativas acima do limite da classe.");

  return {
    uid, nome: efetiva.nome || nomePadrao || "Sem nome", nivel: efetiva.nivel,
    // multiclasse: "Mago 3 / Guerreiro 1"
    classe: efetiva.classes && efetiva.classes.length > 1 ? efetiva.classes.map((c) => `${cat?.classe(c.id)?.nome ?? c.id} ${c.nivel}`).join(" / ") : efetiva.classe,
    pv: efetiva.pv, pvMax: pvMaxEfetivo(efetiva.pvMax, efetiva), pvTemp: efetiva.pvTemp, ca: efetiva.ca,
    cd: efetiva.atrConjuracao ? cdMagia(efetiva) : null, percepcao: percepcaoPassiva(efetiva), deslocamento: efetiva.deslocamento,
    condicoes: condicoesEfetivas(efetiva), concentracao: efetiva.concentracao?.nome, vital: estadoVital(efetiva),
    podeSubir: podeSubirDeNivel(efetiva.xp, efetiva.nivel),
    pericias: PERICIAS.filter((p) => (efetiva.pericias[p.id] ?? 0) > 0).map((p) => p.id),
    idiomas: (calc?.idiomas ?? []).map((i) => i.nome),
    automatica: !!b, conferir,
  };
}

export type ResumoGrupo = {
  jogadores: number;
  pvAtual: number;
  pvMax: number;
  ca: { min: number; max: number; media: number };
  percepcao: { min: number; max: number };
  cds: { nome: string; cd: number }[];
  periciasCobertas: { id: string; nome: string; quem: string[] }[];
  periciasSemCobertura: string[];
  idiomas: { nome: string; quem: string[] }[];
  condicoes: { nome: string; quem: string[] }[];
  aConferir: number;
  podemSubir: string[];
};

export function resumoDoGrupo(linhas: readonly LinhaGrupo[]): ResumoGrupo {
  const cas = linhas.map((l) => l.ca);
  const per = linhas.map((l) => l.percepcao);
  const mapa = <T extends string>(pegar: (l: LinhaGrupo) => T[]) => {
    const m = new Map<string, string[]>();
    for (const l of linhas) for (const k of pegar(l)) m.set(k, [...(m.get(k) ?? []), l.nome]);
    return m;
  };
  const porPericia = mapa((l) => l.pericias);
  const porIdioma = mapa((l) => l.idiomas);
  const porCond = mapa((l) => l.condicoes.map((c) => condicaoDe(c)?.nome ?? c));
  return {
    jogadores: linhas.length,
    pvAtual: linhas.reduce((s, l) => s + l.pv, 0),
    pvMax: linhas.reduce((s, l) => s + l.pvMax, 0),
    ca: { min: cas.length ? Math.min(...cas) : 0, max: cas.length ? Math.max(...cas) : 0, media: cas.length ? Math.round((cas.reduce((s, x) => s + x, 0) / cas.length) * 10) / 10 : 0 },
    percepcao: { min: per.length ? Math.min(...per) : 0, max: per.length ? Math.max(...per) : 0 },
    cds: linhas.filter((l) => l.cd !== null).map((l) => ({ nome: l.nome, cd: l.cd! })),
    periciasCobertas: PERICIAS.filter((p) => porPericia.has(p.id)).map((p) => ({ id: p.id, nome: p.nome, quem: porPericia.get(p.id)! })),
    periciasSemCobertura: linhas.length ? PERICIAS.filter((p) => !porPericia.has(p.id)).map((p) => p.nome) : [],
    idiomas: [...porIdioma.entries()].map(([nome, quem]) => ({ nome, quem })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    condicoes: [...porCond.entries()].map(([nome, quem]) => ({ nome, quem })),
    aConferir: linhas.filter((l) => l.conferir.length > 0).length,
    podemSubir: linhas.filter((l) => l.podeSubir).map((l) => l.nome),
  };
}

// ---------- operações do mestre (viram atualização por campo) ----------
const CAMPOS_ESTADO = ["pv", "pvTemp", "morteSucessos", "morteFalhas", "condicoes", "exaustao", "concentracao", "ativos"] as const;

/** Só o que mudou entre duas versões da ficha, nos campos de estado de combate. Campo removido vira `undefined`. */
export function diferencaDeEstado(antes: FichaDnd, depois: FichaDnd): PatchEstado {
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS_ESTADO) if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) out[k] = depois[k];
  return out as PatchEstado;
}

/** Dano aplicado pelo mestre à ficha efetiva: devolve o que gravar e o texto do que aconteceu. Cair a 0 PV encerra a concentração. */
export function danoDoMestre(ef: FichaDnd, calc: FichaCalculada | null, dano: { valor: number; tipo?: string; critico?: boolean }): { patch: PatchEstado; texto: string[] } {
  const r = aplicarDano(ef, { ...dano, defesas: defesasDe(ef, calc?.resistencias.map((x) => x.nome)) });
  const depois = r.caiu || r.morreu ? { ...r.ficha, concentracao: undefined } : r.ficha;
  const texto = [`${ef.nome || "Personagem"} sofreu ${r.final} de dano${dano.tipo ? ` (${dano.tipo})` : ""}.`, ...r.texto];
  return { patch: diferencaDeEstado(ef, depois), texto };
}

export function curaDoMestre(ef: FichaDnd, valor: number): { patch: PatchEstado; texto: string[] } {
  const depois = aplicarCura(ef, valor, pvMaxEfetivo(ef.pvMax, ef));
  return { patch: diferencaDeEstado(ef, depois), texto: [`${ef.nome || "Personagem"} recebeu ${valor} de cura.`] };
}

/** Liga ou desliga uma condição (id do Apêndice A) numa ficha. */
export function alternarCondicaoDoMestre(ef: FichaDnd, id: string): PatchEstado {
  const atuais = ef.condicoes ?? [];
  return { condicoes: atuais.includes(id) ? atuais.filter((c) => c !== id) : [...atuais, id] };
}

