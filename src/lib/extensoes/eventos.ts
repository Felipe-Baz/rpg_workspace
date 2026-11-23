// Eventos da mesa que uma extensão pode "ouvir" (automação). Puro e sem dependências.
// A detecção é feita por DIFERENÇA entre dois instantâneos dos dados (não importa onde a mudança foi feita),
// e só roda enquanto o mestre está com a mesa aberta (nada acontece com o app fechado).
import type { Permissao } from "./capacidades.ts";

export const EVENTOS = {
  "missao.concluida": { rotulo: "Missão concluída", descricao: "Quando uma missão passa para o status concluída.", permissao: "ler:missoes" },
  "ficha.criada": { rotulo: "Ficha criada", descricao: "Quando uma ficha do mestre (NPC, inimigo, item…) é criada.", permissao: "ler:fichas" },
  "jogador.entrou": { rotulo: "Jogador entrou na mesa", descricao: "Quando um jogador assume ou cria um personagem na mesa.", permissao: "ler:jogadores" },
  "sessao.registrada": { rotulo: "Sessão registrada", descricao: "Quando uma nova sessão é adicionada à mesa.", permissao: "ler:sessoes" },
  "dados.rolados": { rotulo: "Dados rolados", descricao: "Quando você rola dados no rolador da mesa.", permissao: null },
} as const satisfies Record<string, { rotulo: string; descricao: string; permissao: Permissao | null }>;

export type EventoId = keyof typeof EVENTOS;
export const EVENTO_IDS = Object.keys(EVENTOS) as EventoId[];
export const ehEvento = (e: unknown): e is EventoId => typeof e === "string" && Object.hasOwn(EVENTOS, e);

/** Mantém só eventos conhecidos, sem repetir, na ordem do catálogo. */
export const normalizarEventos = (bruto: unknown): EventoId[] => (Array.isArray(bruto) ? EVENTO_IDS.filter((id) => bruto.includes(id)) : []);

/** Permissão que o mestre precisa ter aprovado para a extensão receber o evento (os dados do evento espelham `ler:*`). */
export const permissaoDoEvento = (e: EventoId): Permissao | null => EVENTOS[e].permissao;

export type EventoEmitido = { evento: EventoId; dados: Record<string, unknown>; origemExtensao?: string };

/** Dados de exemplo para "simular evento" no criador. */
export const EXEMPLO_EVENTO: Record<EventoId, Record<string, unknown>> = {
  "missao.concluida": { id: "m1", titulo: "A Cripta Esquecida", categoria: "Principal", dificuldade: "Média" },
  "ficha.criada": { id: "f9", categoria: "item", nome: "Anel de prata" },
  "jogador.entrou": { id: "j5", jogador: "Elisa", personagem: "Nyx, a Ladina" },
  "sessao.registrada": { id: "s3", titulo: "O ritual", data: "2026-11-01" },
  "dados.rolados": { expressao: "d20+5", total: 17, critico: null },
};

// ---------- detecção por diferença ----------
type MissaoMin = { id: string; titulo: string; status: string; categoria?: string; dificuldade?: string };
type FichaMin = { id: string; categoria: string; nome: string; origem?: { extensao?: string } };
type JogadorMin = { id: string; nome: string; personagem: string; uid?: string };
type SessaoMin = { id: string; titulo: string; data: string };
type RolagemMin = { id: number; expressao: string; total: number; critico?: string };

export function diffMissoes(antes: readonly MissaoMin[], depois: readonly MissaoMin[]): EventoEmitido[] {
  const ant = new Map(antes.map((m) => [m.id, m.status]));
  return depois
    .filter((m) => m.status === "concluida" && ant.has(m.id) && ant.get(m.id) !== "concluida")
    .map((m) => ({ evento: "missao.concluida" as const, dados: { id: m.id, titulo: m.titulo, categoria: m.categoria ?? "", dificuldade: m.dificuldade ?? "" } }));
}

export function diffFichas(antes: readonly FichaMin[], depois: readonly FichaMin[]): EventoEmitido[] {
  const ant = new Set(antes.map((f) => f.id));
  return depois
    .filter((f) => !ant.has(f.id))
    .map((f) => ({ evento: "ficha.criada" as const, dados: { id: f.id, categoria: f.categoria, nome: f.nome }, origemExtensao: f.origem?.extensao }));
}

/** "Entrou" = personagem que passou a ter conta (uid) ou que acabou de ser criado já com conta. */
export function diffJogadores(antes: readonly JogadorMin[], depois: readonly JogadorMin[]): EventoEmitido[] {
  const comConta = new Set(antes.filter((j) => j.uid).map((j) => j.id));
  return depois
    .filter((j) => j.uid && !comConta.has(j.id))
    .map((j) => ({ evento: "jogador.entrou" as const, dados: { id: j.id, jogador: j.nome, personagem: j.personagem } }));
}

export function diffSessoes(antes: readonly SessaoMin[], depois: readonly SessaoMin[]): EventoEmitido[] {
  const ant = new Set(antes.map((s) => s.id));
  return depois.filter((s) => !ant.has(s.id)).map((s) => ({ evento: "sessao.registrada" as const, dados: { id: s.id, titulo: s.titulo, data: s.data } }));
}

/** O histórico do rolador é "mais recente primeiro": novas rolagens = as que vêm antes do último id já visto. */
export function diffRolagens(idsVistos: ReadonlySet<number>, atuais: readonly RolagemMin[]): EventoEmitido[] {
  return atuais
    .filter((r) => !idsVistos.has(r.id))
    .reverse()
    .map((r) => ({ evento: "dados.rolados" as const, dados: { expressao: r.expressao, total: r.total, critico: r.critico ?? null } }));
}

// ---------- proteção contra laços ----------
export const MAX_EVENTOS_POR_MINUTO = 10;

/** Limitador de taxa por extensão (janela deslizante). `agora` injetado para teste. */
export function criarLimitador(maximo = MAX_EVENTOS_POR_MINUTO, janelaMs = 60_000) {
  const marcas = new Map<string, number[]>();
  return (chave: string, agora: number): boolean => {
    const recentes = (marcas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= maximo) {
      marcas.set(chave, recentes);
      return false;
    }
    marcas.set(chave, [...recentes, agora]);
    return true;
  };
}

/** Referência dos eventos para o prompt da IA (gerada do catálogo). */
export const descricaoEventos = (): string =>
  EVENTO_IDS.map((e) => `- "${e}": ${EVENTOS[e].descricao} Dados: ${JSON.stringify(EXEMPLO_EVENTO[e])}.${EVENTOS[e].permissao ? ` Exige a permissão "${EVENTOS[e].permissao}".` : ""}`).join("\n");
