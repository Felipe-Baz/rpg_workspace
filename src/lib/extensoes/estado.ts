// Estado por escopo das extensões (E7). Puro e sem dependências: catálogo dos escopos, quem lê e quem grava,
// validação/autorização dos pedidos `RPG.estado.*`, o atendimento sobre um "armazém" injetado (Firestore ou memória,
// no ensaio) e o formato do backup. Fonte única: broker, regras de consentimento, prompt da IA e criador leem daqui.
//
// Onde mora cada escopo (ver firestore.rules):
//   compartilhado → campo `dadosJson` da instalação (o mesmo de sempre; sem migração)
//   mestre        → mesas/{id}/extensoes/{extId}/estado/mestre
//   porJogador    → .../estado/para_{uid}   (o mestre grava; só aquele jogador lê)
//   doJogador     → .../estado/de_{uid}     (o jogador grava o seu, sem aprovação; o mestre lê)

export const MAX_ESTADO = 50_000; // caracteres de JSON por documento (igual a MAX_DADOS)
export const MAX_GRAVACOES_JOGADOR_POR_MINUTO = 10;

export type PapelEstado = "mestre" | "jogador";

export const ESCOPOS = {
  compartilhado: {
    rotulo: "Compartilhado",
    descricao: "Um estado único: você grava, e todos que veem a extensão leem.",
    le: "todos que veem a extensão",
    grava: "o mestre",
    consentimento: "Guardar um estado que todos que veem a extensão podem ler (só você grava).",
    porJogador: false,
  },
  mestre: {
    rotulo: "Só do mestre",
    descricao: "Dados que só você vê e grava: gabaritos, lore, segredos. Nunca chegam ao jogador.",
    le: "só o mestre",
    grava: "o mestre",
    consentimento: "Guardar dados que SÓ VOCÊ vê (por exemplo, gabaritos e segredos). Jogadores nunca os recebem.",
    porJogador: false,
  },
  porJogador: {
    rotulo: "Entregue a cada jogador",
    descricao: "Um documento por jogador: você grava, e só aquele jogador lê o dele (ex.: a Marca dele, a etapa liberada).",
    le: "só aquele jogador (e o mestre)",
    grava: "o mestre",
    consentimento: "Guardar um conteúdo diferente para cada jogador: só você grava, e cada jogador lê só o dele.",
    porJogador: true,
  },
  doJogador: {
    rotulo: "Escrito pelo jogador",
    descricao: "Um documento por jogador: o próprio jogador grava, sem pedir aprovação (ex.: anotações, respostas, progresso). Você lê todos.",
    le: "o próprio jogador e o mestre",
    grava: "o próprio jogador",
    consentimento: "Deixar CADA JOGADOR gravar até 50 KB de dados próprios (anotações, respostas) SEM a sua aprovação. Você lê tudo e pode apagar.",
    porJogador: true,
  },
} as const satisfies Record<string, { rotulo: string; descricao: string; le: string; grava: string; consentimento: string; porJogador: boolean }>;

export type Escopo = keyof typeof ESCOPOS;
export const ESCOPO_IDS = Object.keys(ESCOPOS) as Escopo[];
export const ehEscopo = (e: unknown): e is Escopo => typeof e === "string" && Object.hasOwn(ESCOPOS, e);

/** Mantém só escopos conhecidos, sem repetir, na ordem do catálogo. */
export const normalizarEscopos = (bruto: unknown): Escopo[] => (Array.isArray(bruto) ? ESCOPO_IDS.filter((id) => bruto.includes(id)) : []);

/** `compartilhado` sempre vale (é o estado de sempre); os demais só se o mestre aprovou. */
export const escopoLiberado = (aprovados: readonly Escopo[], e: Escopo): boolean => e === "compartilhado" || aprovados.includes(e);

/** Id do documento em `estado/`. `compartilhado` não tem documento próprio (fica em `dadosJson`). */
export function idDocEstado(escopo: Escopo, uid: string | null): string | null {
  if (escopo === "compartilhado") return null;
  if (escopo === "mestre") return "mestre";
  if (!uid) return null;
  return `${escopo === "porJogador" ? "para_" : "de_"}${uid}`;
}

/** Inverso de `idDocEstado` (para listar a subcoleção). */
export function lerIdDocEstado(id: string): { escopo: Exclude<Escopo, "compartilhado">; uid: string | null } | null {
  if (id === "mestre") return { escopo: "mestre", uid: null };
  if (id.startsWith("para_") && id.length > 5) return { escopo: "porJogador", uid: id.slice(5) };
  if (id.startsWith("de_") && id.length > 3) return { escopo: "doJogador", uid: id.slice(3) };
  return null;
}

// ---------- pedidos vindos do iframe ----------
export type OpEstado = "ler" | "salvar" | "listar" | "assinar";
export type PedidoEstado = { op: OpEstado; escopo: Escopo; jogador: string | null; dados?: unknown };

/** Valida os argumentos de `RPG.estado.*`. `null` = fora do formato. */
export function validarPedidoEstado(op: unknown, args: unknown): PedidoEstado | null {
  if (op !== "ler" && op !== "salvar" && op !== "listar" && op !== "assinar") return null;
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  const { escopo, jogador, dados } = args as Record<string, unknown>;
  if (!ehEscopo(escopo)) return null;
  if (jogador !== undefined && jogador !== null && (typeof jogador !== "string" || !jogador || jogador.length > 80)) return null;
  const p: PedidoEstado = { op, escopo, jogador: typeof jogador === "string" ? jogador : null };
  if (op === "salvar") p.dados = dados ?? null;
  return p;
}

/**
 * Quem pode o quê, por papel. O servidor (regras) impõe o mesmo; aqui recusamos antes, com mensagem clara.
 * O mestre nunca grava `doJogador` (não forja respostas do jogador); o jogador só grava `doJogador` (o dele).
 */
export function autorizarEstado(aprovados: readonly Escopo[], papel: PapelEstado, p: PedidoEstado): { ok: true } | { ok: false; erro: string } {
  if (!escopoLiberado(aprovados, p.escopo)) return { ok: false, erro: `Escopo não aprovado: ${p.escopo}. O mestre precisa aprovar esta extensão com esse escopo.` };
  const porJogador = ESCOPOS[p.escopo].porJogador;
  if (papel === "mestre") {
    if (p.op === "salvar" && p.escopo === "doJogador") return { ok: false, erro: "O mestre não grava os dados escritos pelo jogador (apenas lê ou apaga no painel Dados)." };
    if (p.op === "listar" && !porJogador) return { ok: false, erro: `"listar" só existe para escopos por jogador (porJogador, doJogador).` };
    if ((p.op === "ler" || p.op === "salvar") && porJogador && !p.jogador) return { ok: false, erro: `Informe o jogador: RPG.estado.${p.op}("${p.escopo}", ${p.op === "salvar" ? "dados, " : ""}{ jogador: id }).` };
    return { ok: true };
  }
  // jogador
  if (p.escopo === "mestre") return { ok: false, erro: "Este escopo é só do mestre." };
  if (p.op === "listar") return { ok: false, erro: "Só o mestre lista os dados de todos os jogadores." };
  if (p.op === "salvar" && p.escopo !== "doJogador") return { ok: false, erro: "O jogador só grava no escopo doJogador (os próprios dados)." };
  if (p.jogador && porJogador) return { ok: false, erro: "O jogador só acessa os próprios dados (não informe outro jogador)." };
  return { ok: true };
}

/** Escopos que este papel pode gravar (vira `RPG.podeSalvar(escopo)`). */
export function escoposGravaveis(aprovados: readonly Escopo[], papel: PapelEstado): Escopo[] {
  return ESCOPO_IDS.filter((e) => escopoLiberado(aprovados, e) && autorizarEstado(aprovados, papel, { op: "salvar", escopo: e, jogador: papel === "mestre" && ESCOPOS[e].porJogador ? "x" : null }).ok);
}

/** Serializa e confere o limite. Lança acima de 50 KB. */
export function serializarEstado(dados: unknown): string {
  const json = JSON.stringify(dados ?? null);
  if (json === undefined) throw new Error("Os dados não podem ser convertidos em JSON.");
  if (json.length > MAX_ESTADO) throw new Error(`A extensão tentou guardar mais de ${Math.round(MAX_ESTADO / 1000)} KB de dados neste escopo.`);
  return json;
}

export function lerJson(json: string | null | undefined): unknown {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

// ---------- atendimento (sobre um armazém injetado) ----------
/** `conta` = chave da conta do jogador (uid real; no ensaio, um id fictício). `null` = documento único do escopo. */
export type ArmazemEstado = {
  ler(escopo: Escopo, conta: string | null): Promise<string | null>;
  salvar(escopo: Escopo, conta: string | null, json: string): Promise<void>;
  /** Todos os documentos de um escopo por jogador: conta → json. */
  listar(escopo: Escopo): Promise<Record<string, string>>;
  /** `conta: null` num escopo por jogador = todos (só o mestre). Devolve a função que cancela. */
  assinar(escopo: Escopo, conta: string | null, aoMudar: (conta: string | null, json: string | null) => void): () => void;
};

export type ContextoEstado = {
  papel: PapelEstado;
  aprovados: readonly Escopo[];
  /** Jogadores da mesa: id (o que a extensão vê) → conta. Sem conta = ainda não entrou com uma conta. */
  jogadores: readonly { id: string; conta?: string; nome?: string }[];
  /** A conta de quem usa (para o jogador, de quem são os próprios dados). */
  minhaConta: string;
  armazem: ArmazemEstado;
  /** Limite de gravações do jogador (true = pode). */
  podeGravar?: () => boolean;
};

function contaDoJogador(ctx: ContextoEstado, jogador: string): string {
  const j = ctx.jogadores.find((x) => x.id === jogador);
  if (!j) throw new Error(`Jogador não encontrado nesta mesa: ${jogador}`);
  if (!j.conta) throw new Error(`${j.nome || "Este personagem"} ainda não entrou na mesa com uma conta; não há onde guardar os dados dele.`);
  return j.conta;
}

/** Conta-alvo do pedido: o mestre informa o jogador; o jogador usa a própria. */
export function contaAlvo(ctx: ContextoEstado, p: Pick<PedidoEstado, "escopo" | "jogador">): string | null {
  if (!ESCOPOS[p.escopo].porJogador) return null;
  if (ctx.papel === "jogador") return ctx.minhaConta;
  return p.jogador ? contaDoJogador(ctx, p.jogador) : null;
}

/** Conta → id de jogador (para devolver à extensão; ela nunca vê uids). */
export const jogadorDaConta = (ctx: Pick<ContextoEstado, "jogadores">, conta: string | null): string | null =>
  conta ? ctx.jogadores.find((j) => j.conta === conta)?.id ?? null : null;

/** Atende `ler`, `salvar` e `listar` (a assinatura em tempo real é tratada pelo Sandbox com `contaAlvo`). */
export async function atenderEstado(p: PedidoEstado, ctx: ContextoEstado): Promise<unknown> {
  const aut = autorizarEstado(ctx.aprovados, ctx.papel, p);
  if (!aut.ok) throw new Error(aut.erro);
  if (p.op === "listar") {
    const todos = await ctx.armazem.listar(p.escopo);
    const saida: Record<string, unknown> = {};
    for (const [conta, json] of Object.entries(todos)) {
      const jogador = jogadorDaConta(ctx, conta);
      if (jogador) saida[jogador] = lerJson(json); // contas que saíram da mesa ficam só no painel Dados
    }
    return saida;
  }
  const conta = contaAlvo(ctx, p);
  if (p.op === "ler") return lerJson(await ctx.armazem.ler(p.escopo, conta));
  if (p.op === "salvar") {
    const json = serializarEstado(p.dados);
    if (ctx.papel === "jogador" && ctx.podeGravar && !ctx.podeGravar()) throw new Error("Muitas gravações; tente de novo em instantes.");
    await ctx.armazem.salvar(p.escopo, conta, json);
    return { ok: true };
  }
  throw new Error("Operação inválida.");
}

/**
 * `RPG.estado.aoMudar`: confere papel e aprovação e assina no armazém. O mestre num escopo por jogador sem `jogador`
 * recebe `{ jogador, dados }` de cada um; nos demais casos, os dados do documento. Lança se não for permitido.
 */
export function assinarEstado(ctx: ContextoEstado, escopo: Escopo, jogador: string | null, aoMudar: (dados: unknown) => void): () => void {
  const p: PedidoEstado = { op: "assinar", escopo, jogador };
  const aut = autorizarEstado(ctx.aprovados, ctx.papel, p);
  if (!aut.ok) throw new Error(aut.erro);
  const conta = contaAlvo(ctx, p);
  const todos = ctx.papel === "mestre" && ESCOPOS[escopo].porJogador && !conta;
  return ctx.armazem.assinar(escopo, conta, (c, json) => {
    if (!todos) return aoMudar(lerJson(json));
    const j = jogadorDaConta(ctx, c);
    if (j) aoMudar({ jogador: j, dados: lerJson(json) });
  });
}

/** Armazém em memória (ensaio no criador): nada vai ao Firestore. `aoGravar` alimenta o painel do ensaio. */
export function criarArmazemMemoria(inicial: Record<string, string> = {}, aoGravar?: (chave: string, json: string) => void): ArmazemEstado & { dump(): Record<string, string> } {
  const dados = new Map<string, string>(Object.entries(inicial));
  const ouvintes = new Set<{ escopo: Escopo; conta: string | null; fn: (conta: string | null, json: string | null) => void }>();
  const chave = (e: Escopo, conta: string | null) => (conta ? `${e}:${conta}` : e);
  return {
    async ler(e, conta) { return dados.get(chave(e, conta)) ?? null; },
    async salvar(e, conta, json) {
      dados.set(chave(e, conta), json);
      aoGravar?.(chave(e, conta), json);
      for (const o of ouvintes) if (o.escopo === e && (o.conta === conta || (o.conta === null && ESCOPOS[e].porJogador))) o.fn(conta, json);
    },
    async listar(e) {
      const saida: Record<string, string> = {};
      for (const [k, v] of dados) if (k.startsWith(`${e}:`)) saida[k.slice(e.length + 1)] = v;
      return saida;
    },
    assinar(e, conta, fn) {
      const o = { escopo: e, conta, fn };
      ouvintes.add(o);
      if (conta === null && ESCOPOS[e].porJogador) for (const [k, v] of dados) { if (k.startsWith(`${e}:`)) fn(k.slice(e.length + 1), v); }
      else fn(conta, dados.get(chave(e, conta)) ?? null);
      return () => { ouvintes.delete(o); };
    },
    dump: () => Object.fromEntries(dados),
  };
}

// ---------- consentimento, prompt ----------
/** Linhas da tela de consentimento para os escopos pedidos (`compartilhado` não precisa de aprovação). */
export function linhasConsentimentoEstado(escopos: readonly Escopo[]): string[] {
  return escopos.filter((e) => e !== "compartilhado").map((e) => `• Guardar dados — ${ESCOPOS[e].rotulo}: ${ESCOPOS[e].consentimento}`);
}

export function descricaoEstado(): string {
  const lista = ESCOPO_IDS.map((e) => `  "${e}": ${ESCOPOS[e].descricao} Lê: ${ESCOPOS[e].le}. Grava: ${ESCOPOS[e].grava}.`).join("\n");
  return `- Estado por escopo (declare em "estado" no manifesto os escopos que usa; "compartilhado" não precisa ser declarado). Cada documento guarda até ${Math.round(MAX_ESTADO / 1000)} KB de JSON:
${lista}
  await RPG.estado.ler(escopo, { jogador? }) → dados ou null
  await RPG.estado.salvar(escopo, dados, { jogador? })
  await RPG.estado.listar("porJogador"|"doJogador") → { [idDoJogador]: dados }   (só o mestre)
  RPG.estado.aoMudar(escopo, function (dados) { ... }, { jogador? })   (tempo real; o mestre num escopo por jogador sem "jogador" recebe { jogador, dados } de cada um)
  RPG.eu → id do jogador de quem usa (o mesmo de RPG.ler("jogadores")), ou null para o mestre
  RPG.podeSalvar(escopo) → true/false para quem está usando agora
  Regras: o MESTRE informa { jogador: id } nos escopos por jogador; o JOGADOR nunca informa (usa sempre os próprios dados) e só grava "doJogador" (no máximo ${MAX_GRAVACOES_JOGADOR_POR_MINUTO} gravações por minuto: agrupe, por exemplo, ao clicar em "Enviar", não a cada tecla).
  NUNCA coloque no HTML gabaritos, segredos ou conteúdo que um jogador não deva ver: o código é visível a quem abre a extensão. Guarde isso no escopo "mestre" (o mestre pode preencher em "Dados iniciais") e entregue a cada jogador só o que for dele via "porJogador".
  O que o jogador grava em "doJogador" é dado NÃO confiável: na visão do mestre, valide e mostre como texto (nunca como HTML).`;
}

// ---------- backup ----------
export const FORMATO_BACKUP = "rpg-workspace/extensao-dados";
export type BackupEstado = {
  formato: typeof FORMATO_BACKUP;
  versao: 1;
  extId: string;
  compartilhado: string | null;
  mestre: string | null;
  /** id do jogador → json (por jogador, para sobreviver a reinstalações e a contas trocadas). */
  porJogador: Record<string, string>;
  doJogador: Record<string, string>;
};

export function criarBackup(e: { extId: string; compartilhado: string | null; mestre: string | null; porJogador: Record<string, string>; doJogador: Record<string, string> }): BackupEstado {
  return { formato: FORMATO_BACKUP, versao: 1, ...e };
}

export type ResultadoBackup = { ok: true; backup: BackupEstado } | { ok: false; erro: string };

/** Valida o arquivo de backup (cada documento ≤ 50 KB e JSON válido). */
export function lerBackup(texto: string): ResultadoBackup {
  let j: unknown;
  try { j = JSON.parse(texto); } catch { return { ok: false, erro: "O arquivo não é um JSON válido." }; }
  if (!j || typeof j !== "object") return { ok: false, erro: "Arquivo inválido." };
  const b = j as Record<string, unknown>;
  if (b.formato !== FORMATO_BACKUP || b.versao !== 1) return { ok: false, erro: "Este arquivo não é um backup de dados de extensão." };
  const doc = (v: unknown): string | null | false => (v === null || v === undefined ? null : typeof v === "string" && v.length <= MAX_ESTADO && safeJson(v) ? v : false);
  const mapa = (v: unknown): Record<string, string> | false => {
    if (v === undefined || v === null) return {};
    if (typeof v !== "object" || Array.isArray(v)) return false;
    const saida: Record<string, string> = {};
    for (const [k, x] of Object.entries(v)) { const d = doc(x); if (d === false || d === null) return false; saida[k] = d; }
    return saida;
  };
  const compartilhado = doc(b.compartilhado), mestre = doc(b.mestre), porJogador = mapa(b.porJogador), doJogador = mapa(b.doJogador);
  if (compartilhado === false || mestre === false || porJogador === false || doJogador === false) return { ok: false, erro: "O backup tem dados inválidos ou grandes demais." };
  return { ok: true, backup: criarBackup({ extId: typeof b.extId === "string" ? b.extId : "", compartilhado, mestre, porJogador, doJogador }) };
}

function safeJson(v: string): boolean {
  try { JSON.parse(v); return true; } catch { return false; }
}
