// Conjuração completa: o que a ficha rola ao conjurar (com dado escalado e CD), concentração, rituais e
// quais magias a classe pode aprender. Puro e testável; a ficha só guarda `catalogoId` e as escolhas.

import {
  ATRIBUTO_NOME, atrDaMagia, classesDaFicha, cdMagia, conjurar, ehConjuradora, magiaPronta, modDe, testeAtaqueMagia, testeSalvaguarda,
  type Atributo, type ClasseId, type FichaDnd, type Magia, type Teste,
} from "../../dnd5e.ts";
import { dadoDoTruque, dadoNoCirculo, dardosDoTruque, type MagiaCat } from "./magias.ts";
import { motivoSemConjurar } from "./formaSelvagem.ts";
import { magiasExpandidas } from "./listaExpandida.ts";
import { efeitosNaRajada } from "./invocacoes.ts";

// ---------- rolagens da conjuração ----------
export type PlanoConjuracao = {
  /** Jogada de ataque de magia, se a magia pede. */
  ataque?: Teste;
  /** Um teste por tipo de dano (já com o dado escalado). */
  danos: Teste[];
  cura?: Teste;
  /** Outras rolagens da magia (PV afetados, PV temporários...), com o dado escalado. */
  extras: Teste[];
  /** CD e atributo da salvaguarda que os alvos fazem. */
  salvaguarda?: { cd: number; atributo: Atributo };
  /** Quantos dardos/raios (Mísseis Mágicos...), quando a magia é por dardo. */
  dardos?: number;
  /** Lembretes de características que mexem na magia (invocações do bruxo na Rajada Mística). */
  notas?: string[];
};

/** "1d4+1" × 3 = "3d4+3". */
function multiplicar(dado: string, n: number): string {
  const m = dado.replace(/\s+/g, "").match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!m) return dado;
  return `${Number(m[1]) * n}d${m[2]}${m[3] ? `+${Number(m[3]) * n}` : ""}`;
}

/**
 * O que rolar ao conjurar `m` no `circulo`. Truques escalam pelo nível do personagem; magias, pelo círculo gasto.
 * Sem dados no catálogo (magia cadastrada à mão) devolve só o que a ficha já sabe: ataque e CD.
 */
export function planoDeConjuracao(f: FichaDnd, m: Magia, cat: MagiaCat | undefined, circulo: number): PlanoConjuracao {
  const mec = cat?.mecanica;
  const atr = atrDaMagia(f, m);
  const modConj = atr ? modDe(f, atr) : 0;
  const rotuloMod = atr ? ATRIBUTO_NOME[atr] : "Atributo de conjuração";
  const plano: PlanoConjuracao = { danos: [], extras: [] };

  if (m.tipo === "ataque" || mec?.ataque) plano.ataque = testeAtaqueMagia(f, m);
  if (mec?.salvaguarda && atr) plano.salvaguarda = { cd: cdMagia(f, m), atributo: mec.salvaguarda };

  // dardos/raios: truques crescem com o nível do personagem; magias, com o círculo (a cada `porNivel` círculos)
  const esc = mec?.escalaNivel;
  const dardos = !mec?.dardos ? undefined
    : cat && m.nivel === 0 ? dardosDoTruque(cat, f.nivel)
    : mec.dardos + (esc?.dardosExtras ?? 0) * Math.floor(Math.max(0, circulo - m.nivel) / (esc?.porNivel ?? 1));
  if (dardos) plano.dardos = dardos;

  // Rajada Mística: as invocações do bruxo somam dano por raio e mudam alcance/empurrão
  const rajada = cat?.id === "rajada-mistica" ? efeitosNaRajada(f) : undefined;
  if (rajada?.notas.length) plano.notas = rajada.notas;

  (mec?.danos ?? []).forEach((d, i) => {
    let dado = d.dado;
    if (cat && i === 0 && !d.porDardo) dado = m.nivel === 0 ? dadoDoTruque(cat, dado, f.nivel) : dadoNoCirculo(cat, dado, circulo);
    if (d.porDardo && dardos) dado = multiplicar(dado, dardos);
    plano.danos.push({
      // a CD no título aparece no histórico da mesa ("Aria — Dano (fogo): Bola de Fogo — CD 14 Des")
      titulo: `Dano (${d.tipo}): ${m.nome}${plano.salvaguarda ? ` — CD ${plano.salvaguarda.cd} ${ATRIBUTO_NOME[plano.salvaguarda.atributo].slice(0, 3)}` : ""}`, dado, d20: false, dano: true,
      partes: [
        ...(d.somaMod ? [{ rotulo: rotuloMod, valor: modConj }] : []),
        ...(rajada?.danoPorRaio && i === 0 ? [{ rotulo: "Explosão Agonizante (Carisma)", valor: rajada.danoPorRaio }] : []),
      ],
    });
  });

  if (mec?.cura && cat) {
    plano.cura = {
      titulo: `Cura: ${m.nome}`, dado: dadoNoCirculo(cat, mec.cura.dado, circulo), d20: false, cura: true,
      partes: mec.cura.somaMod ? [{ rotulo: rotuloMod, valor: modConj }] : [],
    };
  }
  // só a 1ª rolagem extra escala, e só quando a magia não tem dano/cura (senão a escala é deles)
  const escalaNoExtra = !mec?.danos?.length && !mec?.cura;
  (mec?.extras ?? []).forEach((e, i) => {
    const dado = cat && i === 0 && escalaNoExtra ? dadoNoCirculo(cat, e.dado, circulo) : e.dado;
    plano.extras.push({ titulo: `${e.rotulo}: ${m.nome}`, dado, d20: false, partes: [] });
  });
  return plano;
}

// ---------- concentração ----------
export const cdConcentracao = (danoSofrido: number) => Math.max(10, Math.floor(Math.max(0, danoSofrido) / 2));

/** Teste de Constituição para manter a concentração depois de sofrer dano (CD = maior entre 10 e metade do dano). */
export function testeConcentracao(f: FichaDnd, danoSofrido: number): Teste {
  const base = testeSalvaguarda(f, "con");
  return { ...base, titulo: `Concentração${f.concentracao ? ` (${f.concentracao.nome})` : ""}: CD ${cdConcentracao(danoSofrido)}` };
}

export const encerrarConcentracao = (f: FichaDnd): FichaDnd => (f.concentracao ? { ...f, concentracao: undefined } : f);

// ---------- conjurar ----------
export type ResultadoConjuracao =
  | { ok: true; ficha: FichaDnd; /** nome da magia cuja concentração acabou por causa desta */ encerrou?: string }
  | { ok: false; motivo: string };

/** Classes que podem conjurar rituais sem preparar a magia (livro: bardo, clérigo, druida, mago). */
const RITUAL_CLASSES = new Set(["bardo", "clerigo", "druida", "mago"]);
export const classeFazRitual = (f: FichaDnd) => classesDaFicha(f).some((c) => RITUAL_CLASSES.has(c.id));

/**
 * Conjura: gasta o espaço do círculo (truque e ritual não gastam) e registra a concentração.
 * Ritual: precisa de classe que o permita e a magia marcada como ritual; usa o círculo original.
 */
export function conjurarMagia(f: FichaDnd, m: Magia, circulo: number, opcoes: { ritual?: boolean } = {}): ResultadoConjuracao {
  const semConjurar = motivoSemConjurar(f);
  if (semConjurar) return { ok: false, motivo: semConjurar };
  let ficha = f;
  if (opcoes.ritual) {
    if (!m.ritual) return { ok: false, motivo: "Esta magia não pode ser conjurada como ritual." };
    if (!classeFazRitual(f)) return { ok: false, motivo: "Sua classe não conjura rituais." };
  } else {
    if (!magiaPronta(f, m)) return { ok: false, motivo: "Ative a magia para conjurá-la." };
    if (m.nivel > 0) {
      ficha = conjurar(f, m, circulo);
      if (ficha === f) return { ok: false, motivo: "Sem espaço de magia disponível nesse círculo." };
    }
  }
  if (m.concentracao) {
    const anterior = f.concentracao && f.concentracao.magiaId !== m.id ? f.concentracao.nome : undefined;
    ficha = { ...ficha, concentracao: { magiaId: m.id, nome: m.nome } };
    return { ok: true, ficha, encerrou: anterior };
  }
  return { ok: true, ficha };
}

// ---------- o que a classe pode aprender ----------
/** Maior círculo com espaços na ficha (0 = nenhum configurado). */
export const maiorCirculo = (f: FichaDnd) => f.espacos.reduce((a, e, i) => (e.total > 0 ? i + 1 : a), 0);

/**
 * A magia do catálogo serve para esta ficha? Classe conjuradora só aprende da própria lista e até o círculo que já
 * tem espaços. Sem classe conjuradora (ou classes sem lista, como o guerreiro) não restringe.
 */
export function podeAprender(f: FichaDnd, cat: MagiaCat): { ok: boolean; motivo?: string } {
  const conj = classesDaFicha(f).map((c) => c.id).filter((id) => ehConjuradora(id as ClasseId));
  if (!conj.length) return { ok: true };
  if (!conj.some((id) => cat.classes.includes(id)) && !magiasExpandidas(f).includes(cat.id)) {
    const nomes = conj.map((id) => (id === "clerigo" ? "clérigo" : id)).join(" ou ");
    return { ok: false, motivo: `Não está na lista de magias de ${nomes}.` };
  }
  const max = maiorCirculo(f);
  if (cat.nivel > 0 && max > 0 && cat.nivel > max) return { ok: false, motivo: `Você ainda não tem espaços de ${cat.nivel}º círculo.` };
  return { ok: true };
}
