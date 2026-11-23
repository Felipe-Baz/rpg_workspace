// Ações de escrita que uma extensão pode PROPOR (nunca executa sozinha: o mestre aprova antes).
// Puro e sem dependências: validação, normalização e o resumo mostrado na tela de aprovação.
// Três operações: criar (E3), alterar e excluir (E7). Sem `op` = criar (formato original).

export const CATEGORIAS_FICHA = ["npc", "inimigo", "importante", "item"] as const;
export type CategoriaFichaAcao = (typeof CATEGORIAS_FICHA)[number];
const ROTULO_CATEGORIA: Record<CategoriaFichaAcao, string> = { npc: "NPC", inimigo: "inimigo", importante: "pessoa importante", item: "item" };

export const STATUS_MISSAO_ACAO = ["em_andamento", "concluida", "fracassada"] as const;
export type StatusMissaoAcao = (typeof STATUS_MISSAO_ACAO)[number];
export const STATUS_ETAPA_ACAO = ["concluida", "atual", "pendente"] as const;
export type StatusEtapaAcao = (typeof STATUS_ETAPA_ACAO)[number];

/** `ninguem` = só o mestre vê; `todos` = todos os jogadores; lista = ids dos jogadores (os de `RPG.ler("jogadores")`). */
export type LiberarPara = "ninguem" | "todos" | string[];

export type AcaoFicha = { tipo: "ficha"; dados: { categoria: CategoriaFichaAcao; nome: string; texto: string; liberarPara: LiberarPara } };
export type AcaoMissao = { tipo: "missao"; dados: { titulo: string; descricao: string; categoria: string; dificuldade: string; etapas: string[] } };
export type AcaoCriar = AcaoFicha | AcaoMissao;

export type MudancasFicha = Partial<{ categoria: CategoriaFichaAcao; nome: string; texto: string; liberarPara: LiberarPara }>;
/** Etapa com `id` = existente (muda texto/status); sem `id` = nova. Etapas existentes fora da lista são removidas. */
export type EtapaMudanca = { id?: string; texto: string; status?: StatusEtapaAcao };
export type MudancasMissao = Partial<{ titulo: string; descricao: string; categoria: string; dificuldade: string; status: StatusMissaoAcao; etapas: EtapaMudanca[] }>;

export type AcaoAlterarFicha = { tipo: "ficha"; op: "alterar"; id: string; mudancas: MudancasFicha };
export type AcaoAlterarMissao = { tipo: "missao"; op: "alterar"; id: string; mudancas: MudancasMissao };
export type AcaoExcluir = { tipo: "ficha" | "missao"; op: "excluir"; id: string };
export type AcaoAlterar = AcaoAlterarFicha | AcaoAlterarMissao;

export type Acao = AcaoCriar | AcaoAlterar | AcaoExcluir;
export type OpAcao = "criar" | "alterar" | "excluir";

export const opDaAcao = (a: Acao): OpAcao => ("op" in a ? a.op : "criar");
export const ehCriacao = (a: Acao): a is AcaoCriar => !("op" in a);

export const MAX_ACOES = 20;
const MAX_NOME = 80;
const MAX_TEXTO = 5000;
const MAX_ETAPAS = 30;
const MAX_ETAPA = 300;
const MAX_LIBERADOS = 50;
const MAX_ID = 80;

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ehId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_ID;

function liberarPara(v: unknown): LiberarPara | null {
  if (v === undefined || v === null || v === "ninguem") return "ninguem";
  if (v === "todos") return "todos";
  if (Array.isArray(v) && v.length <= MAX_LIBERADOS && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 80)) return [...new Set(v as string[])];
  return null;
}

const CAMPOS_FICHA = ["categoria", "nome", "texto", "liberarPara"] as const;
const CAMPOS_MISSAO = ["titulo", "descricao", "categoria", "dificuldade", "status", "etapas"] as const;

/** Só campos conhecidos, ao menos um, e cada valor válido. Qualquer coisa fora disso invalida a ação. */
function validarMudancasFicha(m: Record<string, unknown>): MudancasFicha | null {
  const chaves = Object.keys(m);
  if (chaves.length === 0 || chaves.some((k) => !(CAMPOS_FICHA as readonly string[]).includes(k))) return null;
  const saida: MudancasFicha = {};
  if ("categoria" in m) {
    const c = CATEGORIAS_FICHA.find((x) => x === m.categoria);
    if (!c) return null;
    saida.categoria = c;
  }
  if ("nome" in m) {
    const n = txt(m.nome, MAX_NOME);
    if (!n) return null;
    saida.nome = n;
  }
  if ("texto" in m) {
    if (typeof m.texto !== "string") return null;
    saida.texto = txt(m.texto, MAX_TEXTO);
  }
  if ("liberarPara" in m) {
    if (m.liberarPara === undefined) return null;
    const l = liberarPara(m.liberarPara);
    if (!l) return null;
    saida.liberarPara = l;
  }
  return saida;
}

function validarMudancasMissao(m: Record<string, unknown>): MudancasMissao | null {
  const chaves = Object.keys(m);
  if (chaves.length === 0 || chaves.some((k) => !(CAMPOS_MISSAO as readonly string[]).includes(k))) return null;
  const saida: MudancasMissao = {};
  if ("titulo" in m) {
    const t = txt(m.titulo, MAX_NOME);
    if (!t) return null;
    saida.titulo = t;
  }
  for (const [k, max] of [["descricao", MAX_TEXTO], ["categoria", 40], ["dificuldade", 40]] as const) {
    if (k in m) {
      if (typeof m[k] !== "string") return null;
      saida[k] = txt(m[k], max);
    }
  }
  if ("status" in m) {
    const s = STATUS_MISSAO_ACAO.find((x) => x === m.status);
    if (!s) return null;
    saida.status = s;
  }
  if ("etapas" in m) {
    if (!Array.isArray(m.etapas) || m.etapas.length > MAX_ETAPAS) return null;
    const etapas: EtapaMudanca[] = [];
    const ids = new Set<string>();
    for (const e of m.etapas) {
      if (!e || typeof e !== "object") return null;
      const { id, texto, status } = e as Record<string, unknown>;
      if (id !== undefined && (!ehId(id) || ids.has(id))) return null;
      const t = txt(texto, MAX_ETAPA);
      if (!t) return null;
      if (status !== undefined && !STATUS_ETAPA_ACAO.some((x) => x === status)) return null;
      if (typeof id === "string") ids.add(id);
      etapas.push({ ...(typeof id === "string" ? { id } : {}), texto: t, ...(status ? { status: status as StatusEtapaAcao } : {}) });
    }
    saida.etapas = etapas;
  }
  return saida;
}

/** Valida e normaliza UMA ação vinda do iframe. `null` = inválida (a proposta inteira é recusada). */
export function validarAcao(bruta: unknown): Acao | null {
  if (!bruta || typeof bruta !== "object") return null;
  const { tipo, op, id, dados, mudancas } = bruta as { tipo?: unknown; op?: unknown; id?: unknown; dados?: unknown; mudancas?: unknown };
  if (tipo !== "ficha" && tipo !== "missao") return null;

  if (op === "excluir") return ehId(id) ? { tipo, op, id } : null;
  if (op === "alterar") {
    if (!ehId(id) || !mudancas || typeof mudancas !== "object" || Array.isArray(mudancas)) return null;
    if (tipo === "ficha") {
      const m = validarMudancasFicha(mudancas as Record<string, unknown>);
      return m ? { tipo, op, id, mudancas: m } : null;
    }
    const m = validarMudancasMissao(mudancas as Record<string, unknown>);
    return m ? { tipo, op, id, mudancas: m } : null;
  }
  if (op !== undefined && op !== "criar") return null;

  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;

  if (tipo === "ficha") {
    const categoria = CATEGORIAS_FICHA.find((c) => c === d.categoria);
    const nome = txt(d.nome, MAX_NOME);
    const lib = liberarPara(d.liberarPara);
    if (!categoria || !nome || !lib) return null;
    return { tipo, dados: { categoria, nome, texto: txt(d.texto, MAX_TEXTO), liberarPara: lib } };
  }

  const titulo = txt(d.titulo, MAX_NOME);
  const etapasBrutas = d.etapas === undefined ? [] : d.etapas;
  if (!titulo || !Array.isArray(etapasBrutas) || etapasBrutas.length > MAX_ETAPAS) return null;
  const etapas = etapasBrutas.map((e) => txt(e, MAX_ETAPA)).filter(Boolean);
  return { tipo, dados: { titulo, descricao: txt(d.descricao, MAX_TEXTO), categoria: txt(d.categoria, 40), dificuldade: txt(d.dificuldade, 40), etapas } };
}

/** Valida a lista inteira: 1 a MAX_ACOES ações, todas válidas. */
export function validarAcoes(brutas: unknown): Acao[] | null {
  if (!Array.isArray(brutas) || brutas.length === 0 || brutas.length > MAX_ACOES) return null;
  const acoes = brutas.map(validarAcao);
  return acoes.every((a): a is Acao => a !== null) ? acoes : null;
}

export type PermissaoAcao = "criar:fichas" | "criar:missoes" | "alterar:fichas" | "alterar:missoes";

/** Permissão exigida por cada ação (catálogo em capacidades.ts). Alterar e excluir usam `alterar:*`. */
export const permissaoDaAcao = (a: Acao): PermissaoAcao =>
  ehCriacao(a) ? (a.tipo === "ficha" ? "criar:fichas" : "criar:missoes") : a.tipo === "ficha" ? "alterar:fichas" : "alterar:missoes";

const quemVe = (lib: LiberarPara, jogadores: Record<string, string>) =>
  lib === "ninguem" ? "só você" : lib === "todos" ? "todos os jogadores" : lib.length === 0 ? "só você" : lib.map((id) => jogadores[id] ?? "jogador desconhecido").join(", ");

export const rotuloCategoria = (c: string) => {
  const r = ROTULO_CATEGORIA[c as CategoriaFichaAcao] ?? c;
  return r[0].toUpperCase() + r.slice(1);
};

/** Linha de uma criação (o resumo das alterações, com "antes → depois", é montado em lote.ts com os dados atuais). */
export function linhaCriacao(a: AcaoCriar, jogadores: Record<string, string>): string {
  if (a.tipo === "missao") {
    const e = a.dados.etapas.length;
    return `• Missão “${a.dados.titulo}”${e ? ` com ${e} etapa${e > 1 ? "s" : ""}` : ""} (só você vê as etapas ocultas)`;
  }
  const { categoria, nome, liberarPara: lib } = a.dados;
  return `• ${rotuloCategoria(categoria)}: “${nome}” (visível para: ${quemVe(lib, jogadores)})`;
}

/** Linha de uma alteração/exclusão SEM os dados atuais (usada na lista de pedidos dos jogadores). */
export function linhaSemAtuais(a: AcaoAlterar | AcaoExcluir, jogadores: Record<string, string>): string {
  const alvo = a.tipo === "ficha" ? "ficha" : "missão";
  if (a.op === "excluir") return `• EXCLUIR ${alvo} (${a.id})`;
  const campos = Object.entries(a.mudancas).map(([k, v]) => (k === "liberarPara" ? `visível para: ${quemVe(v as LiberarPara, jogadores)}` : k === "etapas" ? `${(v as unknown[]).length} etapa(s)` : `${k}: “${String(v).slice(0, 60)}”`));
  return `• Alterar ${alvo} (${a.id}): ${campos.join("; ")}`;
}

/** Texto da tela de aprovação quando não há dados atuais à mão. `jogadores` = id → nome do personagem/jogador. */
export function resumirAcoes(acoes: readonly Acao[], jogadores: Record<string, string>): string {
  const linhas = acoes.map((a) => (ehCriacao(a) ? linhaCriacao(a, jogadores) : linhaSemAtuais(a, jogadores)));
  return `${tituloResumo(acoes)}:\n${linhas.join("\n")}\n\nVocê poderá desfazer tudo depois, na tela da extensão.`;
}

/** "Vai criar 2 fichas e alterar 1 missão" etc. */
export function tituloResumo(acoes: readonly Acao[]): string {
  const conta = (op: OpAcao, tipo: "ficha" | "missao") => acoes.filter((a) => opDaAcao(a) === op && a.tipo === tipo).length;
  const plural = (n: number, tipo: "ficha" | "missao") => (tipo === "ficha" ? `${n} ficha${n > 1 ? "s" : ""}` : `${n} ${n > 1 ? "missões" : "missão"}`);
  const partes = (["criar", "alterar", "excluir"] as const)
    .map((op) => {
      const itens = (["ficha", "missao"] as const).map((t) => conta(op, t)).map((n, i) => (n ? plural(n, i === 0 ? "ficha" : "missao") : "")).filter(Boolean);
      return itens.length ? `${op} ${itens.join(" e ")}` : "";
    })
    .filter(Boolean);
  return `Vai ${partes.join(", ")}`;
}
