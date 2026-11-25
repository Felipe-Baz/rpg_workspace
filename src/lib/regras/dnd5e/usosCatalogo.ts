// Características do livro com usos limitados que NÃO estão em `recursosDaFicha` (Fúria, Ki... já estão lá):
// subclasses, traços de raça, talentos e algumas de classe. Tabela CURADA (o texto do catálogo diz "uma vez por descanso"
// em prosa, sem número). Os ids são os do catálogo (`src/data/dnd5e/phb`); `nivel` é o nível na classe (raça: nível total).
// Os usos gastos ficam em `recursos[id]` como os demais; nada é gravado na ficha além disso.

import { modificador, type FichaDnd } from "../../dnd5e.ts";
import type { Recarga } from "./recursos.ts";

export type UsoCatalogo = {
  id: string;
  nome: string;
  fonte: string;
  /** Onde a característica vive: classe (e subclasse), raça (e sub-raça) ou talento. */
  classe?: string;
  subclasse?: string;
  raca?: string;
  subRaca?: string;
  talento?: string;
  nivel: number;
  max: (nivel: number, f: FichaDnd) => number;
  recarga: Recarga;
  descricao: string;
};

const um = () => 1;
const modMin1 = (a: keyof FichaDnd["atributos"]) => (_n: number, f: FichaDnd) => Math.max(1, modificador(f.atributos[a]));

export const USOS_CATALOGO: UsoCatalogo[] = [
  // raça
  { id: "magia-drow-fogo-das-fadas", nome: "Magia Drow: Fogo das Fadas", fonte: "Elfo Negro (Drow)", raca: "elfo", subRaca: "elfo-negro-drow", nivel: 3, max: um, recarga: "longo", descricao: "Conjura fogo das fadas sem gastar espaço de magia." },
  { id: "magia-drow-escuridao", nome: "Magia Drow: Escuridão", fonte: "Elfo Negro (Drow)", raca: "elfo", subRaca: "elfo-negro-drow", nivel: 5, max: um, recarga: "longo", descricao: "Conjura escuridão sem gastar espaço de magia." },
  { id: "magia-ctonico-vitalidade-falsa", nome: "Legado Ctônico: Vitalidade Falsa", fonte: "Tiefling Ctônico", raca: "tiefling", subRaca: "tiefling-chthonic", nivel: 3, max: um, recarga: "longo", descricao: "Conjura vitalidade falsa sem gastar espaço de magia." },
  { id: "magia-ctonico-raio-do-enfraquecimento", nome: "Legado Ctônico: Raio do Enfraquecimento", fonte: "Tiefling Ctônico", raca: "tiefling", subRaca: "tiefling-chthonic", nivel: 5, max: um, recarga: "longo", descricao: "Conjura raio do enfraquecimento sem gastar espaço de magia." },
  // classe
  { id: "canalizar-divindade-paladino", nome: "Canalizar Divindade", fonte: "Paladino", classe: "paladino", nivel: 3, max: um, recarga: "curto", descricao: "Opção do seu juramento sagrado." },
  { id: "intervencao-divina", nome: "Intervenção Divina", fonte: "Clérigo", classe: "clerigo", nivel: 10, max: um, recarga: "longo", descricao: "Pede a ajuda da divindade; se ela intervir, não dá para usar por 7 dias." },
  { id: "arcana-mistica", nome: "Arcana Mística", fonte: "Bruxo", classe: "bruxo", nivel: 11, max: (n) => (n >= 17 ? 4 : n >= 15 ? 3 : n >= 13 ? 2 : 1), recarga: "longo", descricao: "Uma magia por círculo (6º a 9º) sem gastar espaço." },
  { id: "mestre-mistico", nome: "Mestre Místico", fonte: "Bruxo", classe: "bruxo", nivel: 20, max: um, recarga: "longo", descricao: "Recupera todos os espaços de Magia de Pacto (1 minuto)." },
  { id: "golpe-de-sorte", nome: "Golpe de Sorte", fonte: "Ladino", classe: "ladino", nivel: 20, max: um, recarga: "curto", descricao: "Um ataque que erra vira acerto, ou um teste de habilidade vira 20 natural." },
  { id: "assinatura-magica", nome: "Assinatura Mágica", fonte: "Mago", classe: "mago", nivel: 20, max: () => 2, recarga: "curto", descricao: "Duas magias de 3º círculo escolhidas, conjuradas sem espaço." },
  // bruxo
  { id: "presenca-feerica", nome: "Presença Feérica", fonte: "Bruxo: A Arquifada", classe: "bruxo", subclasse: "a-arquifada", nivel: 1, max: um, recarga: "curto", descricao: "Criaturas num cubo de 3 m fazem salvaguarda de Sabedoria ou ficam enfeitiçadas/amedrontadas." },
  { id: "nevoa-de-fuga", nome: "Névoa de Fuga", fonte: "Bruxo: A Arquifada", classe: "bruxo", subclasse: "a-arquifada", nivel: 6, max: um, recarga: "curto", descricao: "Reação ao sofrer dano: some em fumaça e reaparece a até 18 m." },
  { id: "delirio-sombrio", nome: "Delírio Sombrio", fonte: "Bruxo: A Arquifada", classe: "bruxo", subclasse: "a-arquifada", nivel: 14, max: um, recarga: "curto", descricao: "Enfeitiça ou amedronta uma criatura num reino ilusório." },
  { id: "sorte-do-proprio-obscuro", nome: "Sorte do Próprio Obscuro", fonte: "Bruxo: O Corruptor", classe: "bruxo", subclasse: "o-corruptor", nivel: 6, max: um, recarga: "curto", descricao: "Soma 1d10 a um teste de habilidade ou salvaguarda." },
  { id: "lancar-no-inferno", nome: "Lançar no Inferno", fonte: "Bruxo: O Corruptor", classe: "bruxo", subclasse: "o-corruptor", nivel: 14, max: um, recarga: "curto", descricao: "Ao acertar, a criatura é lançada ao Inferno e sofre dano psíquico." },
  { id: "protecao-entropica", nome: "Proteção Entrópica", fonte: "Bruxo: O Grande Antigo", classe: "bruxo", subclasse: "o-grande-antigo", nivel: 6, max: um, recarga: "curto", descricao: "Reação: impõe desvantagem a um ataque contra você." },
  // clérigo
  { id: "visoes-do-passado", nome: "Visões do Passado", fonte: "Clérigo: Conhecimento", classe: "clerigo", subclasse: "dominio-do-conhecimento", nivel: 17, max: um, recarga: "curto", descricao: "Medita para ver o passado de um objeto ou do local." },
  { id: "sacerdote-da-guerra", nome: "Sacerdote da Guerra", fonte: "Clérigo: Guerra", classe: "clerigo", subclasse: "dominio-da-guerra", nivel: 1, max: modMin1("sab"), recarga: "longo", descricao: "Ataque com arma como ação bônus (usos = mod. de Sabedoria, mín. 1)." },
  { id: "labareda-protetora", nome: "Labareda Protetora", fonte: "Clérigo: Luz", classe: "clerigo", subclasse: "dominio-da-luz", nivel: 1, max: modMin1("sab"), recarga: "longo", descricao: "Reação: impõe desvantagem a um ataque contra você ou aliado (usos = mod. de Sabedoria, mín. 1)." },
  { id: "ira-da-tormenta", nome: "Ira da Tormenta", fonte: "Clérigo: Tempestade", classe: "clerigo", subclasse: "dominio-da-tempestade", nivel: 1, max: modMin1("sab"), recarga: "longo", descricao: "Reação: dano elétrico/trovão a quem te atingir (usos = mod. de Sabedoria, mín. 1)." },
  // druida, feiticeiro, guerreiro, ladino
  { id: "recuperacao-natural", nome: "Recuperação Natural", fonte: "Druida: Círculo da Terra", classe: "druida", subclasse: "circulo-da-terra", nivel: 2, max: um, recarga: "longo", descricao: "Num descanso curto, recupera espaços de magia (uma vez por dia)." },
  { id: "mares-de-caos", nome: "Marés de Caos", fonte: "Feiticeiro: Magia Selvagem", classe: "feiticeiro", subclasse: "magia-selvagem", nivel: 1, max: um, recarga: "longo", descricao: "Vantagem numa jogada; o mestre pode forçar um surto depois." },
  { id: "superioridade-em-combate", nome: "Dados de Superioridade", fonte: "Guerreiro: Mestre de Batalha", classe: "guerreiro", subclasse: "mestre-de-batalha", nivel: 3, max: (n) => (n >= 15 ? 6 : n >= 7 ? 5 : 4), recarga: "curto", descricao: "Gaste um dado para uma manobra." },
  { id: "ladrao-de-magia", nome: "Ladrão de Magia", fonte: "Ladino: Trapaceiro Arcano", classe: "ladino", subclasse: "trapaceiro-arcano", nivel: 17, max: um, recarga: "longo", descricao: "Rouba o conhecimento de uma magia que te teve como alvo." },
  // mago
  { id: "protecao-arcana", nome: "Proteção Arcana", fonte: "Mago: Abjuração", classe: "mago", subclasse: "escola-de-abjuracao", nivel: 2, max: um, recarga: "longo", descricao: "Proteção com PV (2 × nível + Int) ao conjurar abjuração." },
  { id: "prodigio", nome: "Prodígio (dados guardados)", fonte: "Mago: Adivinhação", classe: "mago", subclasse: "escola-de-adivinhacao", nivel: 2, max: (n) => (n >= 14 ? 3 : 2), recarga: "longo", descricao: "Role os d20 no descanso longo e anote; troque jogadas por eles." },
  { id: "o-terceiro-olho", nome: "O Terceiro Olho", fonte: "Mago: Adivinhação", classe: "mago", subclasse: "escola-de-adivinhacao", nivel: 10, max: um, recarga: "longo", descricao: "Um benefício de percepção até o próximo descanso." },
  { id: "transposicao-benigna", nome: "Transposição Benigna", fonte: "Mago: Conjuração", classe: "mago", subclasse: "escola-de-conjuracao", nivel: 6, max: um, recarga: "longo", descricao: "Teletransporta-se até 9 m (volta ao conjurar magia de conjuração)." },
  { id: "eu-ilusorio", nome: "Eu Ilusório", fonte: "Mago: Ilusão", classe: "mago", subclasse: "escola-de-ilusao", nivel: 10, max: um, recarga: "longo", descricao: "Reação: o ataque erra você automaticamente." },
  { id: "metamorfo", nome: "Metamorfo", fonte: "Mago: Transmutação", classe: "mago", subclasse: "escola-de-transmutacao", nivel: 10, max: um, recarga: "curto", descricao: "Conjura metamorfose em si mesmo sem espaço." },
  { id: "mestre-transmutador", nome: "Mestre Transmutador", fonte: "Mago: Transmutação", classe: "mago", subclasse: "escola-de-transmutacao", nivel: 14, max: um, recarga: "longo", descricao: "Consome a pedra de transmutador para um efeito maior." },
  // monge, paladino
  { id: "integridade-corporal", nome: "Integridade Corporal", fonte: "Monge: Mão Aberta", classe: "monge", subclasse: "caminho-da-mao-aberta", nivel: 6, max: um, recarga: "longo", descricao: "Recupera 3 × nível de monge em PV." },
  { id: "toque-purificador", nome: "Toque Purificador", fonte: "Paladino", classe: "paladino", nivel: 14, max: modMin1("car"), recarga: "longo", descricao: "Encerra uma magia em você ou em quem tocar (usos = mod. de Carisma, mín. 1)." },
  { id: "halo-sagrado", nome: "Halo Sagrado", fonte: "Paladino: Devoção", classe: "paladino", subclasse: "juramento-de-devocao", nivel: 20, max: um, recarga: "longo", descricao: "Aura de luz do sol por 1 minuto." },
  { id: "sentinela-imortal", nome: "Sentinela Imortal", fonte: "Paladino: Anciões", classe: "paladino", subclasse: "juramento-dos-ancioes", nivel: 15, max: um, recarga: "longo", descricao: "Ao cair a 0 PV, fica com 1 PV." },
  { id: "campeao-dos-ancioes", nome: "Campeão dos Anciões", fonte: "Paladino: Anciões", classe: "paladino", subclasse: "juramento-dos-ancioes", nivel: 20, max: um, recarga: "longo", descricao: "Transformação em força elemental por 1 minuto." },
  { id: "anjo-vingador", nome: "Anjo Vingador", fonte: "Paladino: Vingança", classe: "paladino", subclasse: "juramento-de-vinganca", nivel: 20, max: um, recarga: "longo", descricao: "Asas e aura de medo por 1 hora." },
  // talentos
  { id: "talento-adepto-marcial", nome: "Dado de Superioridade (Adepto Marcial)", fonte: "Talento: Adepto Marcial", talento: "adepto-marcial", nivel: 1, max: um, recarga: "curto", descricao: "Um dado d6 para manobras." },
  { id: "talento-lider-inspirador", nome: "Líder Inspirador", fonte: "Talento: Líder Inspirador", talento: "lider-inspirador", nivel: 1, max: um, recarga: "curto", descricao: "PV temporários a aliados após 10 minutos de discurso." },
  { id: "talento-iniciado-em-magia", nome: "Iniciado em Magia: magia de 1º círculo", fonte: "Talento: Iniciado em Magia", talento: "iniciado-em-magia", nivel: 1, max: um, recarga: "longo", descricao: "A magia de 1º círculo do talento, sem gastar espaço." },
];

/** Contexto do personagem para escolher o que se aplica. */
export type ContextoUsos = {
  racaId?: string;
  subRacaId?: string;
  talentos?: string[];
  /** classe → subclasse escolhida */
  subclasses?: Record<string, string | undefined>;
  /** classe → nível na classe */
  niveis: Record<string, number>;
  nivelTotal: number;
};

/** Os usos do catálogo que o personagem já tem. */
export function usosDoCatalogo(f: FichaDnd, ctx: ContextoUsos): { def: UsoCatalogo; max: number }[] {
  const out: { def: UsoCatalogo; max: number }[] = [];
  for (const u of USOS_CATALOGO) {
    let n: number;
    if (u.classe) {
      n = ctx.niveis[u.classe] ?? 0;
      if (u.subclasse && ctx.subclasses?.[u.classe] !== u.subclasse) continue;
    } else if (u.raca) {
      if (ctx.racaId !== u.raca || (u.subRaca && ctx.subRacaId !== u.subRaca)) continue;
      n = ctx.nivelTotal;
    } else if (u.talento) {
      if (!ctx.talentos?.includes(u.talento)) continue;
      n = ctx.nivelTotal;
    } else continue;
    if (n < u.nivel) continue;
    out.push({ def: u, max: Math.min(99, Math.max(1, u.max(n, f))) });
  }
  return out;
}
