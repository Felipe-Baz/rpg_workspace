// Parte pura do broker: dados de exemplo (modo ensaio), reduções de dados e limites. Sem Firebase.
import { rolar } from "../dados.ts";
import { autorizar, type AlvoLeitura, type Pedido, type Permissao } from "./capacidades.ts";

export const MAX_RESPOSTA = 200_000; // caracteres de JSON por resposta
const MAX_ITENS = 300;

/** Mesa fictícia para a prévia no criador ("dados de exemplo"): sempre os mesmos, em qualquer mesa. */
export const DADOS_EXEMPLO: Record<AlvoLeitura, unknown> = {
  mesa: { nome: "A Coroa de Cinzas", sistema: "D&D 5e", status: "ativa", descricao: "Uma campanha de exemplo.", totalJogadores: 4, totalSessoes: 3 },
  jogadores: {
    total: 4,
    itens: [
      { id: "j1", jogador: "Ana", personagem: "Lia, a Arqueira" },
      { id: "j2", jogador: "Bruno", personagem: "Torin Martelo-de-Ferro" },
      { id: "j3", jogador: "Carla", personagem: "Mirella das Sombras" },
      { id: "j4", jogador: "Diego", personagem: "Frei Ambrósio" },
    ],
  },
  sessoes: {
    total: 2,
    itens: [
      { id: "s1", titulo: "A estalagem", data: "2026-10-04", resumo: "O grupo se conheceu e aceitou o primeiro contrato." },
      { id: "s2", titulo: "A cripta esquecida", data: "2026-10-18", resumo: "Exploraram a cripta e fugiram de um espectro." },
    ],
  },
  missoes: {
    total: 2,
    itens: [
      { id: "m1", titulo: "A Cripta Esquecida", descricao: "Recuperar o relicário do abade.", status: "em_andamento", categoria: "Principal", dificuldade: "Média", etapas: [{ texto: "Entrar na cripta", status: "concluida" }, { texto: "Achar o relicário", status: "atual" }] },
      { id: "m2", titulo: "O Mercador Sumido", descricao: "Descobrir o paradeiro de Osric.", status: "em_andamento", categoria: "Secundária", dificuldade: "Fácil", etapas: [{ texto: "Falar com a esposa", status: "atual" }] },
    ],
  },
  fichas: {
    total: 3,
    itens: [
      { id: "f1", categoria: "npc", nome: "Osric, o mercador", texto: "Dono da loja do mercado. Deve dinheiro a alguém perigoso." },
      { id: "f2", categoria: "inimigo", nome: "Espectro da cripta", texto: "ND 3. Drena força." },
      { id: "f3", categoria: "item", nome: "Relicário do abade", texto: "Prata antiga com runas." },
    ],
  },
  mundo: {
    titulo: "Reinos de Valgreth",
    subtitulo: "Exemplo",
    secoes: [
      { id: "geografia", titulo: "Geografia", resumo: "Montanhas ao norte e pântanos ao sul." },
      { id: "religiao", titulo: "Religião", resumo: "O culto da Chama Cinzenta." },
    ],
  },
};

/** Limita listas grandes e o tamanho final da resposta. */
export function limitar<T>(valor: T): T {
  const reduzido = JSON.parse(JSON.stringify(valor, (_, v) => (Array.isArray(v) && v.length > MAX_ITENS ? v.slice(0, MAX_ITENS) : v))) as T;
  if (JSON.stringify(reduzido).length > MAX_RESPOSTA) throw new Error("A resposta ficou grande demais para uma única chamada.");
  return reduzido;
}

export type Leitor = (alvo: AlvoLeitura, args: Record<string, unknown> | null) => Promise<unknown>;

/** Executa um pedido já validado: confere a permissão aprovada, lê pela fonte e limita a resposta. */
export async function atender(pedido: Pedido, aprovadas: readonly Permissao[], ler: Leitor): Promise<unknown> {
  const aut = autorizar(aprovadas, pedido);
  if (!aut.ok) throw new Error(aut.erro);
  if (pedido.op === "rolar") {
    const r = rolar(pedido.args.expressao);
    if (!r) throw new Error("Expressão de dados inválida. Exemplos: d20, 2d6+3, 4d6kh3.");
    return r;
  }
  return limitar(await ler(pedido.alvo, pedido.args));
}

/** Leitor do modo ensaio. `{ secao }` em "mundo" devolve um bloco simples de exemplo. */
export const leitorExemplo: Leitor = async (alvo, args) => {
  if (alvo === "mundo" && typeof args?.secao === "string") {
    const sec = (DADOS_EXEMPLO.mundo as { secoes: { id: string; titulo: string; resumo: string }[] }).secoes.find((s) => s.id === args.secao);
    if (!sec) throw new Error(`Seção não encontrada: ${args.secao}`);
    return { ...sec, blocos: [{ tipo: "texto", texto: "Conteúdo de exemplo da seção." }] };
  }
  return DADOS_EXEMPLO[alvo];
};
