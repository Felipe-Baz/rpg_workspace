// Ações de escrita que uma extensão pode PROPOR (nunca executa sozinha: o mestre aprova antes).
// Puro e sem dependências: validação, normalização e o resumo mostrado na tela de aprovação.

export const CATEGORIAS_FICHA = ["npc", "inimigo", "importante", "item"] as const;
export type CategoriaFichaAcao = (typeof CATEGORIAS_FICHA)[number];
const ROTULO_CATEGORIA: Record<CategoriaFichaAcao, string> = { npc: "NPC", inimigo: "inimigo", importante: "pessoa importante", item: "item" };

/** `ninguem` = só o mestre vê; `todos` = todos os jogadores; lista = ids dos jogadores (os de `RPG.ler("jogadores")`). */
export type LiberarPara = "ninguem" | "todos" | string[];

export type AcaoFicha = { tipo: "ficha"; dados: { categoria: CategoriaFichaAcao; nome: string; texto: string; liberarPara: LiberarPara } };
export type AcaoMissao = { tipo: "missao"; dados: { titulo: string; descricao: string; categoria: string; dificuldade: string; etapas: string[] } };
export type Acao = AcaoFicha | AcaoMissao;

export const MAX_ACOES = 20;
const MAX_NOME = 80;
const MAX_TEXTO = 5000;
const MAX_ETAPAS = 30;
const MAX_ETAPA = 300;
const MAX_LIBERADOS = 50;

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function liberarPara(v: unknown): LiberarPara | null {
  if (v === undefined || v === null || v === "ninguem") return "ninguem";
  if (v === "todos") return "todos";
  if (Array.isArray(v) && v.length <= MAX_LIBERADOS && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 80)) return [...new Set(v as string[])];
  return null;
}

/** Valida e normaliza UMA ação vinda do iframe. `null` = inválida (a proposta inteira é recusada). */
export function validarAcao(bruta: unknown): Acao | null {
  if (!bruta || typeof bruta !== "object") return null;
  const { tipo, dados } = bruta as { tipo?: unknown; dados?: unknown };
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;

  if (tipo === "ficha") {
    const categoria = CATEGORIAS_FICHA.find((c) => c === d.categoria);
    const nome = txt(d.nome, MAX_NOME);
    const lib = liberarPara(d.liberarPara);
    if (!categoria || !nome || !lib) return null;
    return { tipo, dados: { categoria, nome, texto: txt(d.texto, MAX_TEXTO), liberarPara: lib } };
  }

  if (tipo === "missao") {
    const titulo = txt(d.titulo, MAX_NOME);
    const etapasBrutas = d.etapas === undefined ? [] : d.etapas;
    if (!titulo || !Array.isArray(etapasBrutas) || etapasBrutas.length > MAX_ETAPAS) return null;
    const etapas = etapasBrutas.map((e) => txt(e, MAX_ETAPA)).filter(Boolean);
    return { tipo, dados: { titulo, descricao: txt(d.descricao, MAX_TEXTO), categoria: txt(d.categoria, 40), dificuldade: txt(d.dificuldade, 40), etapas } };
  }
  return null;
}

/** Valida a lista inteira: 1 a MAX_ACOES ações, todas válidas. */
export function validarAcoes(brutas: unknown): Acao[] | null {
  if (!Array.isArray(brutas) || brutas.length === 0 || brutas.length > MAX_ACOES) return null;
  const acoes = brutas.map(validarAcao);
  return acoes.every((a): a is Acao => a !== null) ? acoes : null;
}

/** Permissão exigida por cada tipo de ação (catálogo em capacidades.ts). */
export const permissaoDaAcao = (a: Acao): "criar:fichas" | "criar:missoes" => (a.tipo === "ficha" ? "criar:fichas" : "criar:missoes");

/** Texto da tela de aprovação: o que será criado e para quem. `jogadores` = id → nome do personagem/jogador. */
export function resumirAcoes(acoes: readonly Acao[], jogadores: Record<string, string>): string {
  const linhas = acoes.map((a) => {
    if (a.tipo === "missao") {
      const e = a.dados.etapas.length;
      return `• Missão “${a.dados.titulo}”${e ? ` com ${e} etapa${e > 1 ? "s" : ""}` : ""} (só você vê as etapas ocultas)`;
    }
    const { categoria, nome, liberarPara: lib } = a.dados;
    const quem = lib === "ninguem" ? "só você" : lib === "todos" ? "todos os jogadores" : lib.map((id) => jogadores[id] ?? "jogador desconhecido").join(", ");
    return `• ${ROTULO_CATEGORIA[categoria][0].toUpperCase()}${ROTULO_CATEGORIA[categoria].slice(1)}: “${nome}” (visível para: ${quem})`;
  });
  const fichas = acoes.filter((a) => a.tipo === "ficha").length;
  const missoes = acoes.length - fichas;
  const total = [fichas ? `${fichas} ficha${fichas > 1 ? "s" : ""}` : "", missoes ? `${missoes} ${missoes > 1 ? "missões" : "missão"}` : ""].filter(Boolean).join(" e ");
  return `Vai criar ${total}:\n${linhas.join("\n")}\n\nVocê poderá desfazer tudo depois, na tela da extensão.`;
}
