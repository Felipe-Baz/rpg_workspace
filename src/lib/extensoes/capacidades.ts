// Capacidades: o que uma extensão pode pedir ao app (API `window.RPG`) e as permissões que o mestre aprova.
// Puro e sem dependências. Fonte única: o broker, a validação, a tela de consentimento e o prompt da IA leem daqui.

export type PapelCap = "mestre" | "jogador";

export const PERMISSOES = {
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

export type Permissao = keyof typeof PERMISSOES;
export const PERMISSAO_IDS = Object.keys(PERMISSOES) as Permissao[];
export type AlvoLeitura = (typeof PERMISSOES)[Permissao]["alvo"];

export const ehPermissao = (p: unknown): p is Permissao => typeof p === "string" && Object.hasOwn(PERMISSOES, p);

/** Remove desconhecidas e repetidas, mantendo a ordem do catálogo. */
export const normalizarPermissoes = (bruto: unknown): Permissao[] =>
  Array.isArray(bruto) ? PERMISSAO_IDS.filter((id) => bruto.includes(id)) : [];

export type Pedido =
  | { id: number; op: "ler"; alvo: AlvoLeitura; args: Record<string, unknown> | null }
  | { id: number; op: "rolar"; alvo: "dados"; args: { expressao: string } };

/** Valida a mensagem vinda do iframe. Qualquer coisa fora do formato esperado vira `null`. */
export function validarPedido(m: unknown): Pedido | null {
  if (!m || typeof m !== "object") return null;
  const { rpg, id, op, alvo, args } = m as Record<string, unknown>;
  if (rpg !== "pedido" || typeof id !== "number" || !Number.isSafeInteger(id)) return null;
  const objeto = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : null;
  if (op === "ler") {
    const alvos: string[] = PERMISSAO_IDS.map((p) => PERMISSOES[p].alvo);
    return typeof alvo === "string" && alvos.includes(alvo) ? { id, op, alvo: alvo as AlvoLeitura, args: objeto } : null;
  }
  if (op === "rolar" && alvo === "dados" && objeto && typeof objeto.expressao === "string" && objeto.expressao.length <= 60) {
    return { id, op, alvo, args: { expressao: objeto.expressao } };
  }
  return null;
}

/** A extensão só pode ler o que o MESTRE aprovou na instalação (não o que ela declarou no manifesto). */
export function autorizar(aprovadas: readonly Permissao[], pedido: Pedido): { ok: true } | { ok: false; erro: string } {
  if (pedido.op === "rolar") return { ok: true }; // sem acesso a dados da mesa
  const permissao = PERMISSAO_IDS.find((p) => PERMISSOES[p].alvo === pedido.alvo);
  if (!permissao || !aprovadas.includes(permissao)) {
    return { ok: false, erro: `Permissão não concedida: ${permissao ?? pedido.alvo}. O mestre precisa aprovar esta extensão com essa permissão.` };
  }
  return { ok: true };
}

/** Texto da tela de consentimento (uma linha por permissão pedida). */
export function textoConsentimento(permissoes: readonly Permissao[], visivelAJogadores: boolean): string {
  const linhas = permissoes.map((p) => `• ${PERMISSOES[p].rotulo}: ${PERMISSOES[p].descricao}`);
  const aviso = permissoes.some((p) => PERMISSOES[p].sensivel)
    ? `\n\nAtenção: esta extensão lê dados que podem ser privados. ${visivelAJogadores ? "Como ela está liberada aos jogadores, cada um verá apenas o que a própria conta pode ver, mas o que a extensão guardar no estado dela é visível a todos que a usam." : "Se você a liberar aos jogadores depois, o que ela guardar no estado dela fica visível a todos que a usam."}`
    : "";
  return `Esta extensão quer permissão para ler:\n${linhas.join("\n")}${aviso}`;
}

/** Referência da API para o prompt da IA, gerada do catálogo (a IA não inventa chamadas que não existem). */
export function descricaoApi(): string {
  const leituras = PERMISSAO_IDS.map((p) => `- await RPG.ler("${PERMISSOES[p].alvo}") → ${PERMISSOES[p].retorno}\n  Permissão: "${p}". ${PERMISSOES[p].descricao}`).join("\n");
  return `${leituras}\n- await RPG.rolar("2d6+3") → { expressao, total, grupos: [{ rotulo, dados, mantidos, subtotal }], bonus, critico? }  (não exige permissão)`;
}
