// Efeitos de uma extensão sobre a MESA INTEIRA: tema, terminologia, ferramentas visíveis e tipos de recurso próprios.
// Puro e sem dependências. Tudo é validado contra listas fixas (nada de CSS ou rótulos livres chegando à interface sem filtro).

export const TOKENS_TEMA = [
  "--accent", "--accent-hover", "--accent-strong", "--accent-soft", "--gold", "--ext",
  "--background", "--surface", "--card", "--card-2", "--foreground", "--muted", "--border", "--ok", "--warn", "--danger",
] as const;
export type TokenTema = (typeof TOKENS_TEMA)[number];
export type ModoTema = "escuro" | "claro";
export type TemaMesa = { escuro?: Partial<Record<TokenTema, string>>; claro?: Partial<Record<TokenTema, string>> };

/** Nomes que a extensão pode trocar e ferramentas que pode ocultar (chave = id da ferramenta na navegação). */
export const TERMOS = {
  mapas: "Mapas",
  imagens: "Imagens",
  mundo: "Mundo",
  missoes: "Missões",
  "fichas.npc": "NPCs",
  "fichas.inimigo": "Inimigos",
  "fichas.importante": "Pessoas importantes",
  "fichas.item": "Itens",
  jogadores: "Jogadores",
  sessoes: "Sessões",
  segredos: "Segredos",
  quadro: "Quadro",
} as const;
export type ChaveTermo = keyof typeof TERMOS;
export const CHAVES_TERMO = Object.keys(TERMOS) as ChaveTermo[];
export const ehChave = (c: unknown): c is ChaveTermo => typeof c === "string" && Object.hasOwn(TERMOS, c);

export type TipoCampo = "texto" | "longo" | "numero" | "selecao";
export type CampoRecurso = { id: string; rotulo: string; tipo: TipoCampo; opcoes: string[] };
export type DefRecurso = { id: string; singular: string; plural: string; campos: CampoRecurso[] };

export type EfeitosMesa = {
  tema: TemaMesa;
  termos: Partial<Record<ChaveTermo, string>>;
  ocultar: ChaveTermo[];
  recursos: DefRecurso[];
};

export const efeitosVazios = (): EfeitosMesa => ({ tema: {}, termos: {}, ocultar: [], recursos: [] });
export const temEfeitos = (e: EfeitosMesa): boolean =>
  !!(Object.keys(e.tema.escuro ?? {}).length || Object.keys(e.tema.claro ?? {}).length || Object.keys(e.termos).length || e.ocultar.length || e.recursos.length);

const MAX_RECURSOS = 5;
const MAX_CAMPOS = 8;
const MAX_OPCOES = 12;
const COR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,29}$/;

const rotulo = (v: unknown, max: number) =>
  typeof v === "string" ? [...v].filter((c) => c.charCodeAt(0) >= 32 && c !== "<" && c !== ">").join("").trim().slice(0, max) : "";

function normalizarTema(bruto: unknown): TemaMesa {
  const saida: TemaMesa = {};
  if (!bruto || typeof bruto !== "object") return saida;
  for (const modo of ["escuro", "claro"] as const) {
    const b = (bruto as Record<string, unknown>)[modo];
    if (!b || typeof b !== "object") continue;
    const tokens: Partial<Record<TokenTema, string>> = {};
    for (const t of TOKENS_TEMA) {
      const v = (b as Record<string, unknown>)[t];
      if (typeof v === "string" && COR.test(v.trim())) tokens[t] = v.trim().toLowerCase();
    }
    if (Object.keys(tokens).length) saida[modo] = tokens;
  }
  return saida;
}

function normalizarCampo(bruto: unknown): CampoRecurso | null {
  if (!bruto || typeof bruto !== "object") return null;
  const { id, rotulo: r, tipo, opcoes } = bruto as Record<string, unknown>;
  if (typeof id !== "string" || !SLUG.test(id)) return null;
  const nome = rotulo(r, 40);
  if (!nome || !["texto", "longo", "numero", "selecao"].includes(tipo as string)) return null;
  const ops = tipo === "selecao" && Array.isArray(opcoes) ? [...new Set(opcoes.map((o) => rotulo(o, 40)).filter(Boolean))].slice(0, MAX_OPCOES) : [];
  if (tipo === "selecao" && ops.length < 2) return null;
  return { id, rotulo: nome, tipo: tipo as TipoCampo, opcoes: ops };
}

function normalizarRecurso(bruto: unknown): DefRecurso | null {
  if (!bruto || typeof bruto !== "object") return null;
  const { id, singular, plural, campos } = bruto as Record<string, unknown>;
  if (typeof id !== "string" || !SLUG.test(id) || !Array.isArray(campos)) return null;
  const cs: CampoRecurso[] = [];
  for (const c of campos.slice(0, MAX_CAMPOS)) {
    const n = normalizarCampo(c);
    if (n && !cs.some((x) => x.id === n.id)) cs.push(n);
  }
  const s = rotulo(singular, 30);
  const p = rotulo(plural, 30);
  return s && p && cs.length ? { id, singular: s, plural: p, campos: cs } : null;
}

/** Normaliza o bloco `mesa` do manifesto. Qualquer parte inválida é descartada, nunca aceita pela metade. */
export function normalizarEfeitos(bruto: unknown): EfeitosMesa {
  const e = efeitosVazios();
  if (!bruto || typeof bruto !== "object") return e;
  const b = bruto as Record<string, unknown>;
  e.tema = normalizarTema(b.tema);
  if (b.termos && typeof b.termos === "object") {
    for (const c of CHAVES_TERMO) {
      const v = rotulo((b.termos as Record<string, unknown>)[c], 30);
      if (v && v !== TERMOS[c]) e.termos[c] = v;
    }
  }
  if (Array.isArray(b.ocultar)) e.ocultar = CHAVES_TERMO.filter((c) => (b.ocultar as unknown[]).includes(c));
  if (Array.isArray(b.recursos)) {
    for (const r of b.recursos.slice(0, MAX_RECURSOS)) {
      const n = normalizarRecurso(r);
      if (n && !e.recursos.some((x) => x.id === n.id)) e.recursos.push(n);
    }
  }
  return e;
}

// ---------- contraste ----------
const DEFAULTS_LEGIVEIS: Record<ModoTema, { "--background": string; "--foreground": string }> = {
  escuro: { "--background": "#15131a", "--foreground": "#f1eef7" },
  claro: { "--background": "#faf9fc", "--foreground": "#1c1826" },
};

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b); };
export function razaoContraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const CONTRASTE_MINIMO = 4.5;

// ---------- combinação (várias extensões, a última da ordem vence) ----------
export type Conflito = { tipo: "tema" | "termo" | "contraste"; chave: string; vencedora: string; perdedoras: string[] };
export type EfeitosCombinados = {
  tema: Record<ModoTema, Partial<Record<TokenTema, string>>>;
  termos: Partial<Record<ChaveTermo, string>>;
  ocultar: Set<ChaveTermo>;
  recursos: (DefRecurso & { extId: string; extTitulo: string })[];
  conflitos: Conflito[];
};

/** `lista` na ORDEM DE PRIORIDADE da mesa (a última vence conflitos de tema e de termos; ocultar e recursos se somam). */
export function combinarEfeitos(lista: readonly { id: string; titulo: string; efeitos: EfeitosMesa }[]): EfeitosCombinados {
  const r: EfeitosCombinados = { tema: { escuro: {}, claro: {} }, termos: {}, ocultar: new Set(), recursos: [], conflitos: [] };
  const donos = new Map<string, { titulo: string; valor: string }[]>();
  const registrar = (chave: string, titulo: string, valor: string) => donos.set(chave, [...(donos.get(chave) ?? []), { titulo, valor }]);

  for (const { id, titulo, efeitos } of lista) {
    for (const modo of ["escuro", "claro"] as const) {
      for (const [tok, val] of Object.entries(efeitos.tema[modo] ?? {})) {
        r.tema[modo][tok as TokenTema] = val;
        registrar(`tema:${modo}:${tok}`, titulo, val);
      }
    }
    for (const [c, v] of Object.entries(efeitos.termos)) {
      r.termos[c as ChaveTermo] = v;
      registrar(`termo:${c}`, titulo, v);
    }
    efeitos.ocultar.forEach((c) => r.ocultar.add(c));
    efeitos.recursos.forEach((rec) => r.recursos.push({ ...rec, extId: id, extTitulo: titulo }));
  }

  for (const [chave, quem] of donos) {
    const valores = new Set(quem.map((q) => q.valor));
    if (quem.length > 1 && valores.size > 1) {
      const [tipo, ...resto] = chave.split(":");
      r.conflitos.push({ tipo: tipo as "tema" | "termo", chave: resto.join(":"), vencedora: quem[quem.length - 1].titulo, perdedoras: quem.slice(0, -1).map((q) => q.titulo) });
    }
  }

  // Legibilidade: se texto/fundo ficarem ilegíveis, descarta os DOIS (volta ao padrão) e avisa.
  for (const modo of ["escuro", "claro"] as const) {
    const t = r.tema[modo];
    if (!t["--background"] && !t["--foreground"]) continue;
    const bg = t["--background"] ?? DEFAULTS_LEGIVEIS[modo]["--background"];
    const fg = t["--foreground"] ?? DEFAULTS_LEGIVEIS[modo]["--foreground"];
    if (razaoContraste(bg, fg) < CONTRASTE_MINIMO) {
      delete t["--background"];
      delete t["--foreground"];
      r.conflitos.push({ tipo: "contraste", chave: modo, vencedora: "padrão", perdedoras: lista.map((l) => l.titulo) });
    }
  }
  return r;
}

/** Linhas curtas para a tela de consentimento / resumo ("o que esta extensão muda na mesa"). */
export function resumoEfeitos(e: EfeitosMesa): string[] {
  const linhas: string[] = [];
  const cores = new Set([...Object.keys(e.tema.escuro ?? {}), ...Object.keys(e.tema.claro ?? {})]).size;
  if (cores) linhas.push(`trocar ${cores} cor${cores > 1 ? "es" : ""} do tema desta mesa`);
  const termos = Object.entries(e.termos);
  if (termos.length) linhas.push(`renomear: ${termos.map(([c, v]) => `${TERMOS[c as ChaveTermo]} → ${v}`).join(", ")}`);
  if (e.ocultar.length) linhas.push(`ocultar do menu: ${e.ocultar.map((c) => TERMOS[c]).join(", ")}`);
  if (e.recursos.length) linhas.push(`criar tipos de dado: ${e.recursos.map((r) => `${r.plural} (${r.campos.length} campo${r.campos.length > 1 ? "s" : ""})`).join(", ")}`);
  return linhas;
}

/** Variáveis CSS (nome → valor) que o tema pede para o modo atual. */
export const variaveisDoTema = (tema: Partial<Record<TokenTema, string>>): [TokenTema, string][] =>
  TOKENS_TEMA.flatMap((t) => (tema[t] && COR.test(tema[t]!) ? [[t, tema[t]!] as [TokenTema, string]] : []));

// ---------- valores dos registros de um tipo de recurso ----------
export type ValoresRecurso = Record<string, string | number>;

/** Valida os valores digitados contra a definição (tipos, tamanhos, opções). Devolve os normalizados ou o primeiro erro. */
export function validarValores(def: DefRecurso, entrada: Record<string, unknown>): { ok: true; valores: ValoresRecurso } | { ok: false; erro: string } {
  const valores: ValoresRecurso = {};
  for (const c of def.campos) {
    const v = entrada[c.id];
    if (c.tipo === "numero") {
      if (v === "" || v === undefined || v === null) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) return { ok: false, erro: `“${c.rotulo}” precisa ser um número.` };
      valores[c.id] = n;
    } else if (c.tipo === "selecao") {
      if (v === "" || v === undefined || v === null) continue;
      if (typeof v !== "string" || !c.opcoes.includes(v)) return { ok: false, erro: `“${c.rotulo}”: escolha uma das opções.` };
      valores[c.id] = v;
    } else {
      const max = c.tipo === "longo" ? 5000 : 200;
      const s = typeof v === "string" ? v.trim().slice(0, max) : "";
      if (s) valores[c.id] = s;
    }
  }
  if (!Object.keys(valores).length) return { ok: false, erro: "Preencha ao menos um campo." };
  return { ok: true, valores };
}

/** Título de um registro: o primeiro campo de texto preenchido (senão o primeiro valor). */
export function tituloDoRegistro(def: DefRecurso, valores: ValoresRecurso): string {
  const primeiro = def.campos.find((c) => (c.tipo === "texto" || c.tipo === "longo") && valores[c.id]);
  const v = primeiro ? valores[primeiro.id] : Object.values(valores)[0];
  return v === undefined ? def.singular : String(v);
}

/** Referência para o prompt da IA (gerada dos catálogos). */
export function descricaoEfeitos(): string {
  return [
    `- "tema": { "escuro": { "--accent": "#hex", ... }, "claro": { ... } }. Cores SÓ em hexadecimal (#rgb ou #rrggbb), nos tokens: ${TOKENS_TEMA.join(", ")}. Mantenha contraste alto entre --foreground e --background (mínimo ${CONTRASTE_MINIMO}:1) ou a troca é descartada.`,
    `- "termos": renomeia ferramentas do menu, ex.: { "fichas.npc": "Contatos" }. Chaves: ${CHAVES_TERMO.map((c) => `"${c}" (${TERMOS[c]})`).join(", ")}.`,
    `- "ocultar": lista de chaves de ferramentas a esconder do menu (as mesmas chaves de "termos"). Início, Extensões e Configurações nunca se escondem.`,
    `- "recursos": até ${MAX_RECURSOS} tipos de dado próprios, ex.: { "id": "faccoes", "singular": "Facção", "plural": "Facções", "campos": [{ "id": "nome", "rotulo": "Nome", "tipo": "texto" }, { "id": "poder", "rotulo": "Poder", "tipo": "numero" }, { "id": "atitude", "rotulo": "Atitude", "tipo": "selecao", "opcoes": ["Aliada", "Neutra", "Hostil"] }] } (tipos: texto, longo, numero, selecao; ids em minúsculas com hífen; até ${MAX_CAMPOS} campos). O app gera a lista, o formulário e a busca; o mestre libera cada registro aos jogadores.`,
  ].join("\n");
}
