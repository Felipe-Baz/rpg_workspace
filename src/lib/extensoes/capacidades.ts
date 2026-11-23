// Capacidades: o que uma extensão pode pedir ao app (API `window.RPG`) e as permissões que o mestre aprova.
// Puro. Fonte única: o broker, a validação, a tela de consentimento e o prompt da IA leem daqui.
import { permissaoDaAcao, validarAcoes, type Acao } from "./acoes.ts";
import { EVENTOS, type EventoId } from "./eventos.ts";

export type PapelCap = "mestre" | "jogador";

/** Leituras: `await RPG.ler(alvo)`. */
const LEITURAS = {
  "ler:mesa": {
    alvo: "mesa",
    rotulo: "Dados da mesa",
    descricao: "Nome, sistema, status e descrição da mesa, e o número de jogadores.",
    retorno: "{ nome, sistema, status, descricao, totalJogadores, totalSessoes }",
    sensivel: false,
  },
  "ler:jogadores": {
    alvo: "jogadores",
    rotulo: "Jogadores e personagens",
    descricao: "Quem joga na mesa: nome do jogador e do personagem.",
    retorno: "{ total, itens: [{ id, jogador, personagem }] }",
    sensivel: false,
  },
  "ler:sessoes": {
    alvo: "sessoes",
    rotulo: "Sessões",
    descricao: "Título, data e resumo público das sessões (nunca as notas secretas).",
    retorno: "{ total, itens: [{ id, titulo, data, resumo }] }",
    sensivel: false,
  },
  "ler:missoes": {
    alvo: "missoes",
    rotulo: "Missões",
    descricao: "Missões e etapas. O jogador recebe só o que a mesa já mostra a ele; o mestre também recebe a dificuldade e as etapas ocultas.",
    retorno: "{ total, itens: [{ id, titulo, descricao, status, categoria, dificuldade?, etapas: [{ texto, status }] }] }",
    sensivel: true,
  },
  "ler:fichas": {
    alvo: "fichas",
    rotulo: "Fichas (NPCs, inimigos, itens)",
    descricao: "As fichas que quem está usando a extensão pode ver. Para o mestre, inclui as anotações de cada ficha.",
    retorno: "{ total, itens: [{ id, categoria: 'npc'|'inimigo'|'importante'|'item', nome, texto }] }",
    sensivel: true,
  },
  "ler:mundo": {
    alvo: "mundo",
    rotulo: "Mundo (artigos)",
    descricao: "Os artigos do Mundo. Sem argumentos devolve o sumário; com { secao: id } devolve o conteúdo da seção.",
    retorno: "sumário: { titulo, subtitulo, secoes: [{ id, titulo, resumo }] } · seção: { id, titulo, resumo, blocos }",
    sensivel: false,
  },
} as const satisfies Record<string, { alvo: string; rotulo: string; descricao: string; retorno: string; sensivel: boolean }>;

/** Escritas: `await RPG.criar(tipo, dados)` / `RPG.propor([...])`. Só o mestre; sempre com aprovação dele. */
const ESCRITAS = {
  "criar:fichas": {
    tipo: "ficha",
    rotulo: "Criar fichas (NPCs, inimigos, itens)",
    descricao: "Cria fichas do mestre, por exemplo itens de tesouro, e pode liberá-las a jogadores. Cada criação é mostrada a você antes de gravar.",
    assinatura: 'RPG.criar("ficha", { categoria: "npc"|"inimigo"|"importante"|"item", nome, texto?, liberarPara?: "ninguem"|"todos"|[idDoJogador] })',
  },
  "criar:missoes": {
    tipo: "missao",
    rotulo: "Criar missões",
    descricao: "Cria missões com etapas (a primeira fica visível aos jogadores; as demais, ocultas). Cada criação é mostrada a você antes de gravar.",
    assinatura: "RPG.criar(\"missao\", { titulo, descricao?, categoria?, dificuldade?, etapas?: [texto] })",
  },
} as const satisfies Record<string, { tipo: string; rotulo: string; descricao: string; assinatura: string }>;

/** Usos: recursos do app que a extensão consome (hoje, a IA do mestre). */
const USOS = {
  "usar:ia": {
    rotulo: "Usar a IA do mestre",
    descricao: "Enviar perguntas curtas à IA configurada pelo mestre e receber texto. Consome o limite diário de uso da mesa, também quando um jogador usa a extensão.",
    assinatura: 'RPG.perguntar("texto")',
  },
} as const satisfies Record<string, { rotulo: string; descricao: string; assinatura: string }>;

type Leitura = (typeof LEITURAS)[keyof typeof LEITURAS];

export const PERMISSOES = {
  ...Object.fromEntries(Object.entries(LEITURAS).map(([k, v]) => [k, { ...v, acao: "ler" as const }])),
  ...Object.fromEntries(Object.entries(ESCRITAS).map(([k, v]) => [k, { ...v, acao: "criar" as const, sensivel: false }])),
  ...Object.fromEntries(Object.entries(USOS).map(([k, v]) => [k, { ...v, acao: "usar" as const, sensivel: false }])),
} as {
  [K in keyof typeof LEITURAS]: (typeof LEITURAS)[K] & { acao: "ler" };
} & {
  [K in keyof typeof ESCRITAS]: (typeof ESCRITAS)[K] & { acao: "criar"; sensivel: false };
} & {
  [K in keyof typeof USOS]: (typeof USOS)[K] & { acao: "usar"; sensivel: false };
};

export type Permissao = keyof typeof PERMISSOES;
export const PERMISSAO_IDS = Object.keys(PERMISSOES) as Permissao[];
export type PermissaoLeitura = keyof typeof LEITURAS;
export const PERMISSOES_LEITURA = Object.keys(LEITURAS) as PermissaoLeitura[];
export const PERMISSOES_ESCRITA = Object.keys(ESCRITAS) as (keyof typeof ESCRITAS)[];
export const PERMISSOES_USO = Object.keys(USOS) as (keyof typeof USOS)[];
export type AlvoLeitura = Leitura["alvo"];
export const ALVOS_LEITURA: readonly AlvoLeitura[] = PERMISSOES_LEITURA.map((p) => LEITURAS[p].alvo);

export const ehPermissao = (p: unknown): p is Permissao => typeof p === "string" && Object.hasOwn(PERMISSOES, p);
export const escreve = (p: Permissao): boolean => p === "criar:fichas" || p === "criar:missoes";

/** Remove desconhecidas e repetidas, mantendo a ordem do catálogo. */
export const normalizarPermissoes = (bruto: unknown): Permissao[] => (Array.isArray(bruto) ? PERMISSAO_IDS.filter((id) => bruto.includes(id)) : []);

export type Pedido =
  | { id: number; op: "ler"; alvo: AlvoLeitura; args: Record<string, unknown> | null }
  | { id: number; op: "rolar"; alvo: "dados"; args: { expressao: string } }
  | { id: number; op: "propor"; alvo: "acoes"; args: { acoes: Acao[] } }
  | { id: number; op: "perguntar"; alvo: "ia"; args: { texto: string } };

/** Valida a mensagem vinda do iframe. Qualquer coisa fora do formato esperado vira `null`. */
export function validarPedido(m: unknown): Pedido | null {
  if (!m || typeof m !== "object") return null;
  const { rpg, id, op, alvo, args } = m as Record<string, unknown>;
  if (rpg !== "pedido" || typeof id !== "number" || !Number.isSafeInteger(id)) return null;
  const objeto = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : null;
  if (op === "ler") {
    return typeof alvo === "string" && (ALVOS_LEITURA as readonly string[]).includes(alvo) ? { id, op, alvo: alvo as AlvoLeitura, args: objeto } : null;
  }
  if (op === "rolar" && alvo === "dados" && objeto && typeof objeto.expressao === "string" && objeto.expressao.length <= 60) {
    return { id, op, alvo, args: { expressao: objeto.expressao } };
  }
  if (op === "perguntar" && alvo === "ia" && objeto && typeof objeto.texto === "string" && objeto.texto.trim().length > 0 && objeto.texto.length <= 2000) {
    return { id, op, alvo, args: { texto: objeto.texto } };
  }
  if (op === "propor" && alvo === "acoes" && objeto) {
    const acoes = validarAcoes(objeto.acoes);
    return acoes ? { id, op, alvo, args: { acoes } } : null;
  }
  return null;
}

/** A extensão só pode o que o MESTRE aprovou na instalação (não o que ela declarou no manifesto). */
export function autorizar(aprovadas: readonly Permissao[], pedido: Pedido): { ok: true } | { ok: false; erro: string } {
  if (pedido.op === "rolar") return { ok: true }; // sem acesso a dados da mesa
  if (pedido.op === "perguntar") return aprovadas.includes("usar:ia") ? { ok: true } : { ok: false, erro: "Permissão não concedida: usar:ia. O mestre precisa aprovar esta extensão com essa permissão." };
  if (pedido.op === "propor") {
    const faltando = [...new Set(pedido.args.acoes.map(permissaoDaAcao))].filter((p) => !aprovadas.includes(p));
    return faltando.length ? { ok: false, erro: `Permissão não concedida: ${faltando.join(", ")}. O mestre precisa aprovar esta extensão com essa permissão.` } : { ok: true };
  }
  const permissao = PERMISSOES_LEITURA.find((p) => LEITURAS[p].alvo === pedido.alvo);
  if (!permissao || !aprovadas.includes(permissao)) {
    return { ok: false, erro: `Permissão não concedida: ${permissao ?? pedido.alvo}. O mestre precisa aprovar esta extensão com essa permissão.` };
  }
  return { ok: true };
}

/** Texto da tela de consentimento (uma linha por permissão pedida). */
export function textoConsentimento(permissoes: readonly Permissao[], visivelAJogadores: boolean, eventos: readonly EventoId[] = [], efeitos: readonly string[] = []): string {
  const linhas = permissoes.map((p) => `• ${{ ler: "Ler", criar: "Criar", usar: "Usar" }[PERMISSOES[p].acao]} — ${PERMISSOES[p].rotulo}: ${PERMISSOES[p].descricao}`);
  const sensivel = permissoes.some((p) => PERMISSOES[p].sensivel);
  const cria = permissoes.some(escreve);
  const aviso = sensivel
    ? `\n\nAtenção: esta extensão lê dados que podem ser privados. ${visivelAJogadores ? "Como ela está liberada aos jogadores, cada um verá apenas o que a própria conta pode ver, mas o que a extensão guardar no estado dela é visível a todos que a usam." : "Se você a liberar aos jogadores depois, o que ela guardar no estado dela fica visível a todos que a usam."}`
    : "";
  const usaIa = permissoes.includes("usar:ia");
  const aviso6 = usaIa ? "\n\nCada pergunta à IA usa a chave e o limite diário do mestre (inclusive quando um jogador usa a extensão)." : "";
  const aviso2 = cria ? "\n\nA criação de conteúdo só acontece quando você aprova cada pedido, e dá para desfazer em lote. Jogadores nunca criam conteúdo por esta extensão." : "";
  const aviso3 = eventos.length ? `\n\nEla também quer reagir sozinha a: ${eventos.map((e) => EVENTOS[e].rotulo.toLowerCase()).join(", ")}. Isso só acontece enquanto você está com a mesa aberta; qualquer criação continua pedindo a sua aprovação.` : "";
  const aviso4 = cria ? "\n\nSe um jogador usar a extensão e pedir algo, o pedido chega até você e só vira conteúdo se você aprovar." : "";
  const aviso5 = efeitos.length ? `\n\nEla também vai mudar a mesa inteira (enquanto estiver ativa; você pode desativá-la a qualquer momento):\n${efeitos.map((l) => `• ${l}`).join("\n")}` : "";
  return `Esta extensão quer permissão para:\n${linhas.join("\n")}${aviso}${aviso2}${aviso4}${aviso6}${aviso3}${aviso5}`;
}

/** Referência da API para o prompt da IA, gerada do catálogo (a IA não inventa chamadas que não existem). */
export function descricaoApi(): string {
  const leituras = PERMISSOES_LEITURA.map((p) => `- await RPG.ler("${LEITURAS[p].alvo}") → ${LEITURAS[p].retorno}\n  Permissão: "${p}". ${LEITURAS[p].descricao}`).join("\n");
  const usos = PERMISSOES_USO.map((p) => `- await ${USOS[p].assinatura} → { texto }  (resposta da IA, até 4000 caracteres; pergunta até 2000)\n  Permissão: "${p}". ${USOS[p].descricao} Pode falhar (limite diário); trate o erro.`).join("\n");
  const escritas = PERMISSOES_ESCRITA.map((p) => `- await ${ESCRITAS[p].assinatura}\n  Permissão: "${p}". ${ESCRITAS[p].descricao}`).join("\n");
  return [
    leituras,
    usos,
    '- await RPG.rolar("2d6+3") → { expressao, total, grupos: [{ rotulo, dados, mantidos, subtotal }], bonus, critico? }  (não exige permissão)',
    "Escrita. Quando quem usa é o MESTRE: cada pedido abre uma tela de aprovação e a promise só resolve depois que ele aprova (se recusar, REJEITA com \"O mestre recusou\"). Quando quem usa é um JOGADOR: a mesma chamada NÃO cria nada; envia um pedido ao mestre e resolve na hora com { pedido, status: \"pendente\" } (o jogador é avisado quando o mestre decidir):",
    escritas,
    '- await RPG.propor([{ tipo: "ficha", dados: {...} }, { tipo: "missao", dados: {...} }]) → cria várias ações de uma vez, com UMA aprovação (máx. 20). RPG.criar(tipo, dados) é o atalho de uma ação. Ambas resolvem com { lote, criados: [{ tipo, id, nome }], avisos: [texto] }.',
    "- window.RPG.contexto: quando a extensão é aberta a partir de uma missão ou ficha (encaixes \"missao.acoes\" e \"ficha.acoes\"), vem { tipo: \"missao\"|\"ficha\", id, ... } com os dados dela; caso contrário é null.",
  ].join("\n");
}
