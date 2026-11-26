// Ações das opções que o personagem escolheu e que gastam recursos: Metamagia (pontos de feitiçaria), Manobras (dados de
// superioridade), Disciplinas Elementais (pontos de ki), Arma de Sopro do draconato e os Estilos de Luta que pedem reação ou
// um novo dado. O motor só calcula o custo, a CD e a rolagem; a mesa decide o efeito no alvo.

import { bonusProficiencia, modDe, type Atributo, type FichaDnd, type Teste } from "../../dnd5e.ts";
import { DISCIPLINAS_ELEMENTAIS, MANOBRAS, METAMAGIAS } from "./opcoesClasse.ts";
import { estilosDeLuta } from "./escolhasClasse.ts";

export type AcaoDeOpcao = {
  id: string;
  grupo: "Metamagia" | "Manobras" | "Disciplinas Elementais" | "Arma de Sopro" | "Estilo de Luta";
  nome: string;
  texto: string;
  /** Recurso gasto ao usar (`recursos[id]`). */
  custo?: { recurso: string; rotulo: string; qtd: number };
  /** Custo que depende da magia (Duplicada: nível da magia, 1 para truque): o painel pergunta. */
  custoVariavel?: "nivel-da-magia";
  /** Usa a reação do turno (Proteção). */
  reacao?: boolean;
  teste?: Teste;
  /** Linha de apoio: CD, forma e tipo do sopro. */
  info?: string;
  /** Pergunta quantas faces tem o dado (Armas Grandes) e rola um d{faces}. */
  pedeFaces?: boolean;
};

/** Custo em pontos de feitiçaria de cada metamágica do livro. */
export const CUSTO_METAMAGIA: Record<string, number | "nivel-da-magia"> = {
  "magia-acelerada": 2, "magia-aumentada": 3, "magia-cuidadosa": 1, "magia-distante": 1, "magia-duplicada": "nivel-da-magia",
  "magia-estendida": 1, "magia-potencializada": 1, "magia-sutil": 1,
};

/** Ancestral dracônico: tipo de dano, forma e salvaguarda da Arma de Sopro (tabela do livro). */
export const SOPRO: Record<string, { dano: string; forma: string; salv: Atributo }> = {
  azul: { dano: "elétrico", forma: "linha de 1,5 m por 9 m", salv: "des" }, branco: { dano: "frio", forma: "cone de 4,5 m", salv: "con" },
  bronze: { dano: "elétrico", forma: "linha de 1,5 m por 9 m", salv: "des" }, cobre: { dano: "ácido", forma: "linha de 1,5 m por 9 m", salv: "des" },
  latao: { dano: "fogo", forma: "linha de 1,5 m por 9 m", salv: "des" }, negro: { dano: "ácido", forma: "linha de 1,5 m por 9 m", salv: "des" },
  ouro: { dano: "fogo", forma: "cone de 4,5 m", salv: "des" }, prata: { dano: "frio", forma: "cone de 4,5 m", salv: "con" },
  verde: { dano: "veneno", forma: "cone de 4,5 m", salv: "con" }, vermelho: { dano: "fogo", forma: "cone de 4,5 m", salv: "des" },
};
/** Dados de dano da Arma de Sopro: 2d6, 3d6 (6º), 4d6 (11º) e 5d6 (16º). */
export const dadosDoSopro = (nivel: number) => (nivel >= 16 ? 5 : nivel >= 11 ? 4 : nivel >= 6 ? 3 : 2);
export const ID_REACAO_GASTA = "reacao-gasta";

const NOME_ATR: Record<Atributo, string> = { for: "Força", des: "Destreza", con: "Constituição", int: "Inteligência", sab: "Sabedoria", car: "Carisma" };

/** Pontos de chi de uma disciplina, lidos do texto do livro ("Você pode gastar 2 pontos de chi..."). */
export const custoDeChi = (texto: string) => Number(/gastar (\d+) pontos? de chi/i.exec(texto)?.[1] ?? 1);

/** Todas as ações que as escolhas do personagem liberam. Precisa da ficha efetiva (com `build`). */
export function acoesDeOpcoes(f: FichaDnd): AcaoDeOpcao[] {
  const b = f.build;
  if (!b) return [];
  const out: AcaoDeOpcao[] = [];
  const prof = bonusProficiencia(f.nivel);
  for (const c of b.classes) {
    const esc = c.escolhas ?? {};
    const ids = (prefixo: string) => Object.entries(esc).filter(([k]) => k === prefixo || k.startsWith(`${prefixo}-`)).flatMap(([, v]) => v);
    if (c.id === "feiticeiro") {
      const cd = 8 + prof + modDe(f, "car");
      for (const id of ids("metamagia")) {
        const m = METAMAGIAS.find((x) => x.id === id);
        if (!m) continue;
        const custo = CUSTO_METAMAGIA[id] ?? 1;
        out.push({
          id: `metamagia-${id}`, grupo: "Metamagia", nome: m.nome, texto: m.texto, info: `CD das suas magias ${cd}`,
          ...(custo === "nivel-da-magia" ? { custoVariavel: custo, custo: { recurso: "pontos-de-feiticaria", rotulo: "pontos de feitiçaria", qtd: 1 } } : { custo: { recurso: "pontos-de-feiticaria", rotulo: "pontos de feitiçaria", qtd: custo } }),
        });
      }
    }
    if (c.id === "guerreiro" && c.subclasse === "mestre-de-batalha") {
      const dado = c.nivel >= 18 ? 12 : c.nivel >= 10 ? 10 : 8;
      const atr: Atributo = modDe(f, "des") > modDe(f, "for") ? "des" : "for";
      const cd = 8 + prof + modDe(f, atr);
      for (const id of ids("manobras")) {
        const m = MANOBRAS.find((x) => x.id === id);
        if (!m) continue;
        out.push({
          id: `manobra-${id}`, grupo: "Manobras", nome: m.nome, texto: m.texto,
          custo: { recurso: "superioridade-em-combate", rotulo: "dado de superioridade", qtd: 1 },
          teste: { titulo: `Manobra: ${m.nome}`, dado: `1d${dado}`, partes: [], d20: false, dano: true },
          info: `d${dado} · CD ${cd} (${NOME_ATR[atr]})`,
        });
      }
    }
    if (c.id === "monge" && c.subclasse === "caminho-dos-quatro-elementos") {
      const cd = 8 + prof + modDe(f, "sab");
      const sintonia = DISCIPLINAS_ELEMENTAIS.find((d) => d.id === "sintonia-elemental");
      if (sintonia && c.nivel >= 3) out.push({ id: "disciplina-sintonia-elemental", grupo: "Disciplinas Elementais", nome: sintonia.nome, texto: sintonia.texto, info: "Sem custo: sempre conhecida" });
      for (const id of ids("disciplina")) {
        const d = DISCIPLINAS_ELEMENTAIS.find((x) => x.id === id);
        if (!d) continue;
        out.push({
          id: `disciplina-${id}`, grupo: "Disciplinas Elementais", nome: d.nome, texto: d.texto,
          custo: { recurso: "pontos-de-ki", rotulo: "pontos de ki", qtd: custoDeChi(d.texto) }, info: `CD ${cd} (Sabedoria)`,
        });
      }
    }
  }
  // Arma de Sopro do draconato
  const ancestral = b.raca?.id === "draconato" ? b.raca.escolhas?.ancestral?.[0] : undefined;
  const sopro = ancestral ? SOPRO[ancestral] : undefined;
  if (sopro) {
    const cd = 8 + prof + modDe(f, "con");
    const n = dadosDoSopro(f.nivel);
    out.push({
      id: "arma-de-sopro", grupo: "Arma de Sopro", nome: `Arma de Sopro (${sopro.dano})`,
      texto: `Uma ação: ${sopro.forma}; cada criatura faz uma salvaguarda de ${NOME_ATR[sopro.salv]} (CD ${cd}) e sofre ${n}d6 de dano ${sopro.dano} (metade num sucesso). Recarrega num descanso curto ou longo.`,
      custo: { recurso: "arma-de-sopro", rotulo: "uso", qtd: 1 },
      teste: { titulo: `Arma de Sopro (${sopro.dano})`, dado: `${n}d6`, partes: [], d20: false, dano: true },
      info: `${sopro.forma} · salvaguarda de ${NOME_ATR[sopro.salv]} · CD ${cd}`,
    });
  }
  // Estilos de Luta que pedem reação ou um novo dado
  const estilos = estilosDeLuta(b.classes);
  if (estilos.includes("protecao")) out.push({ id: "estilo-protecao", grupo: "Estilo de Luta", nome: "Proteção", texto: "Com um escudo, use sua reação para impor desvantagem no ataque contra uma criatura a até 1,5 m de você (que não seja você), se você puder ver o atacante.", reacao: true });
  if (estilos.includes("armas-grandes")) out.push({ id: "estilo-armas-grandes", grupo: "Estilo de Luta", nome: "Armas Grandes: jogar de novo", texto: "Com uma arma corpo a corpo de duas mãos, jogue de novo um 1 ou 2 no dado de dano e use o novo resultado. Informe as faces do dado da arma (ex.: 12 para um machado grande).", pedeFaces: true });
  return out;
}
