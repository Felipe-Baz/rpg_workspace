// Monta, de forma pura, os documentos de um lote de uma extensão (sem tocar no Firestore).
// Tudo recebe a marca `origem` para o mestre poder listar e desfazer o lote inteiro.
// E7: além de criar, o lote pode ALTERAR e EXCLUIR fichas/missões existentes; guarda o documento anterior (`antes`)
// para o desfazer restaurar, e um hash do que foi gravado (`depois`) para avisar se o item foi mudado de novo depois.
import { ehCriacao, linhaCriacao, rotuloCategoria, tituloResumo, type Acao, type AcaoAlterarFicha, type AcaoAlterarMissao, type AcaoCriar, type LiberarPara } from "./acoes.ts";

export type Origem = { extensao: string; lote: string };
export type ItemLote = { tipo: "ficha" | "missao"; id: string; nome: string; op?: "criar" | "alterar" | "excluir" };

export type FichaLote = {
  id: string; donoUid: string; categoria: string; nome: string; foto: ""; texto: string; criadoEm: number;
  mestre: true; todos: boolean; liberadoPara: string[]; origem: Origem;
};

export type MissaoLote = {
  id: string; titulo: string; descricaoPublica: string; descricaoMestre: ""; status: "em_andamento"; dificuldade: string; categoria: string;
  etapas: { id: string; texto: string; status: "atual" | "pendente"; notaMestre: ""; dataConclusao: "" }[]; criadoEm: number; origem: Origem;
};

export type JogadorLote = { id: string; nome: string; personagem: string; uid?: string };

export type DocumentosLote = {
  fichas: FichaLote[];
  missoes: MissaoLote[];
  itens: ItemLote[];
  avisos: string[];
};

/** Converte "liberarPara" (ids de jogadores) em contas. Quem ainda não tem conta vira aviso. */
function contasDe(liberarPara: LiberarPara, nome: string, jogadores: readonly JogadorLote[], avisos: string[]): { todos: boolean; liberadoPara: string[] } {
  if (!Array.isArray(liberarPara)) return { todos: liberarPara === "todos", liberadoPara: [] };
  const contas: string[] = [];
  for (const id of liberarPara) {
    const j = jogadores.find((x) => x.id === id);
    if (!j) avisos.push(`“${nome}”: jogador “${id}” não existe nesta mesa; não foi liberada para ele.`);
    else if (!j.uid) avisos.push(`“${nome}”: ${j.personagem || j.nome || id} ainda não entrou na mesa com uma conta; a ficha não foi liberada para esse personagem.`);
    else contas.push(j.uid);
  }
  return { todos: false, liberadoPara: [...new Set(contas)] };
}

/**
 * `jogadores`: os da mesa (para converter ids em contas). Quem ainda não reivindicou o personagem (sem `uid`)
 * não consegue ver a ficha: vira aviso. `novoId` e `agora` são injetados para o teste ser determinístico.
 */
export function montarDocumentosLote(entrada: {
  acoes: readonly AcaoCriar[];
  uidMestre: string;
  jogadores: readonly JogadorLote[];
  origem: Origem;
  agora: number;
  novoId: () => string;
}): DocumentosLote {
  const { acoes, uidMestre, jogadores, origem, agora, novoId } = entrada;
  const saida: DocumentosLote = { fichas: [], missoes: [], itens: [], avisos: [] };

  for (const a of acoes) {
    if (a.tipo === "ficha") {
      const { categoria, nome, texto, liberarPara } = a.dados;
      const { todos, liberadoPara } = contasDe(liberarPara, nome, jogadores, saida.avisos);
      const ficha: FichaLote = { id: novoId(), donoUid: uidMestre, categoria, nome, foto: "", texto, criadoEm: agora, mestre: true, todos, liberadoPara, origem };
      saida.fichas.push(ficha);
      saida.itens.push({ tipo: "ficha", id: ficha.id, nome });
    } else {
      const { titulo, descricao, categoria, dificuldade, etapas } = a.dados;
      const missao: MissaoLote = {
        id: novoId(), titulo, descricaoPublica: descricao, descricaoMestre: "", status: "em_andamento", dificuldade, categoria,
        // A primeira etapa fica visível; as demais ficam ocultas até o mestre avançar.
        etapas: etapas.map((texto, i) => ({ id: novoId(), texto, status: i === 0 ? ("atual" as const) : ("pendente" as const), notaMestre: "" as const, dataConclusao: "" as const })),
        criadoEm: agora, origem,
      };
      saida.missoes.push(missao);
      saida.itens.push({ tipo: "missao", id: missao.id, nome: titulo });
    }
  }
  return saida;
}

// ======================= E7: alterar / excluir =======================

type Doc = Record<string, unknown>;
type EtapaDoc = { id: string; texto: string; status: string; notaMestre?: string; dataConclusao?: string };

/** Documentos atuais lidos antes de montar o lote. Missões: a versão completa (`missoesMestre`) e a pública. */
export type AtuaisLote = {
  fichas: Record<string, Doc | undefined>;
  missoesMestre: Record<string, Doc | undefined>;
  missoesPublicas: Record<string, Doc | undefined>;
};

/** O que o desfazer restaura. `null` = o documento não existia (então é apagado ao desfazer). */
export type AntesItem =
  | { tipo: "ficha"; id: string; ficha: Doc | null }
  | { tipo: "missao"; id: string; mestre: Doc | null; publica: Doc | null };

export type LoteMontado = {
  /** Documentos a gravar (set): fichas e missões completas (a pública é derivada na gravação). */
  fichas: Doc[];
  missoes: Doc[];
  excluir: { tipo: "ficha" | "missao"; id: string }[];
  itens: ItemLote[];
  antes: AntesItem[];
  /** chave "tipo:id" → hash do documento gravado (missão: da versão completa). Ausente = item excluído. */
  depois: Record<string, string>;
  avisos: string[];
  /** Texto da tela de aprovação: o que muda, com antes → depois. */
  resumo: string;
};

/** Hash estável (chaves ordenadas) de um documento, para detectar edição posterior ao lote. */
export function hashDoc(d: unknown): string {
  const estavel = (v: unknown): unknown => (Array.isArray(v) ? v.map(estavel) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as Doc).sort().map((k) => [k, estavel((v as Doc)[k])])) : v);
  const s = JSON.stringify(estavel(d));
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

const s = (v: unknown) => (typeof v === "string" ? v : "");
const curto = (v: string, n = 50) => (v.length > n ? `${v.slice(0, n)}…` : v);
const ROTULO_STATUS: Record<string, string> = { em_andamento: "em andamento", concluida: "concluída", fracassada: "fracassada", atual: "atual", pendente: "pendente" };

/** Missão antiga (só a versão pública) vira uma completa, como faz a tela de missões. */
function missaoCompleta(mestre: Doc | undefined, publica: Doc | undefined): Doc | null {
  if (mestre) return mestre;
  if (!publica) return null;
  return {
    id: s(publica.id), titulo: s(publica.titulo), descricaoPublica: s(publica.descricaoPublica) || s(publica.descricao), descricaoMestre: "",
    status: s(publica.status) === "andamento" ? "em_andamento" : s(publica.status) || "em_andamento", dificuldade: "", categoria: s(publica.categoria),
    etapas: (Array.isArray(publica.etapas) ? (publica.etapas as EtapaDoc[]) : []).map((e) => ({ id: s(e.id), texto: s(e.texto), status: s(e.status) || "pendente", notaMestre: "", dataConclusao: s(e.dataConclusao) })),
    criadoEm: typeof publica.criadoEm === "number" ? publica.criadoEm : 0,
  };
}

function quemVeDoc(d: Doc, nomesPorConta: Record<string, string>): string {
  if (d.todos === true) return "todos os jogadores";
  const l = Array.isArray(d.liberadoPara) ? (d.liberadoPara as string[]) : [];
  return l.length ? l.map((u) => nomesPorConta[u] ?? "jogador").join(", ") : "só você";
}

function alterarFicha(a: AcaoAlterarFicha, atual: Doc, jogadores: readonly JogadorLote[], origem: Origem, avisos: string[], nomesPorConta: Record<string, string>): { doc: Doc; linha: string } {
  const m = a.mudancas;
  const novo: Doc = { ...atual, origem };
  const partes: string[] = [];
  if (m.nome !== undefined && m.nome !== atual.nome) { partes.push(`nome “${curto(s(atual.nome))}” → “${curto(m.nome)}”`); novo.nome = m.nome; }
  if (m.categoria !== undefined && m.categoria !== atual.categoria) { partes.push(`categoria ${rotuloCategoria(s(atual.categoria))} → ${rotuloCategoria(m.categoria)}`); novo.categoria = m.categoria; }
  if (m.texto !== undefined && m.texto !== atual.texto) { partes.push(`texto alterado (${s(atual.texto).length} → ${m.texto.length} caracteres)`); novo.texto = m.texto; }
  if (m.liberarPara !== undefined) {
    const { todos, liberadoPara } = contasDe(m.liberarPara, s(novo.nome), jogadores, avisos);
    novo.todos = todos;
    novo.liberadoPara = liberadoPara;
    const antes = quemVeDoc(atual, nomesPorConta), depois = quemVeDoc(novo, nomesPorConta);
    if (antes !== depois) partes.push(`visível para: ${antes} → ${depois}`);
  }
  return { doc: novo, linha: `• Alterar ficha “${curto(s(atual.nome))}”: ${partes.length ? partes.join("; ") : "nada muda"}` };
}

function alterarMissao(a: AcaoAlterarMissao, atual: Doc, origem: Origem, novoId: () => string, hoje: string): { doc: Doc; linha: string } {
  const m = a.mudancas;
  const novo: Doc = { ...atual, origem };
  const partes: string[] = [];
  if (m.titulo !== undefined && m.titulo !== atual.titulo) { partes.push(`título “${curto(s(atual.titulo))}” → “${curto(m.titulo)}”`); novo.titulo = m.titulo; }
  if (m.descricao !== undefined && m.descricao !== atual.descricaoPublica) { partes.push("descrição alterada"); novo.descricaoPublica = m.descricao; }
  for (const k of ["categoria", "dificuldade"] as const) {
    if (m[k] !== undefined && m[k] !== atual[k]) { partes.push(`${k} “${s(atual[k]) || "—"}” → “${m[k] || "—"}”`); novo[k] = m[k]; }
  }
  if (m.status !== undefined && m.status !== atual.status) { partes.push(`status ${ROTULO_STATUS[s(atual.status)] ?? s(atual.status)} → ${ROTULO_STATUS[m.status]}`); novo.status = m.status; }
  if (m.etapas !== undefined) {
    const antigas = new Map((Array.isArray(atual.etapas) ? (atual.etapas as EtapaDoc[]) : []).map((e) => [e.id, e]));
    for (const e of m.etapas) if (e.id && !antigas.has(e.id)) throw new Error(`A missão “${s(atual.titulo)}” não tem a etapa ${e.id}.`);
    let temAtual = false;
    const etapas = m.etapas.map((e) => {
      const velha = e.id ? antigas.get(e.id) : undefined;
      let status = e.status ?? (velha?.status as string | undefined) ?? "pendente";
      if (status === "atual") { if (temAtual) status = "pendente"; else temAtual = true; } // no máximo uma etapa atual
      return { id: velha?.id ?? novoId(), texto: e.texto, status, notaMestre: velha?.notaMestre ?? "", dataConclusao: status === "concluida" ? velha?.dataConclusao || hoje : "" };
    });
    const novas = etapas.filter((e) => !antigas.has(e.id)).length;
    const removidas = [...antigas.keys()].filter((id) => !etapas.some((e) => e.id === id)).length;
    const mudadas = etapas.filter((e) => { const v = antigas.get(e.id); return v && (v.texto !== e.texto || v.status !== e.status); }).length;
    const desc = [novas && `${novas} nova(s)`, mudadas && `${mudadas} alterada(s)`, removidas && `${removidas} removida(s)`].filter(Boolean).join(", ");
    if (desc) partes.push(`etapas: ${desc}`);
    novo.etapas = etapas;
  }
  return { doc: novo, linha: `• Alterar missão “${curto(s(atual.titulo))}”: ${partes.length ? partes.join("; ") : "nada muda"}` };
}

/**
 * Monta o lote completo (criar + alterar + excluir) a partir dos documentos atuais.
 * Lança com mensagem clara se um item não existe ou não pode ser alterado por extensões (fichas pessoais de jogadores).
 */
export function montarLote(entrada: {
  acoes: readonly Acao[];
  atuais: AtuaisLote;
  uidMestre: string;
  jogadores: readonly JogadorLote[];
  origem: Origem;
  agora: number;
  novoId: () => string;
}): LoteMontado {
  const { acoes, atuais, jogadores, origem, agora, novoId } = entrada;
  const nomesJogador = Object.fromEntries(jogadores.map((j) => [j.id, j.personagem || j.nome || "jogador"]));
  const nomesPorConta = Object.fromEntries(jogadores.filter((j) => j.uid).map((j) => [j.uid!, j.personagem || j.nome || "jogador"]));
  const hoje = new Date(agora).toISOString().slice(0, 10);

  const criacoes = acoes.filter(ehCriacao);
  const docsCriados = montarDocumentosLote({ acoes: criacoes, uidMestre: entrada.uidMestre, jogadores, origem, agora, novoId });
  const saida: LoteMontado = {
    fichas: [...docsCriados.fichas], missoes: [...docsCriados.missoes], excluir: [], itens: docsCriados.itens.map((i) => ({ ...i, op: "criar" as const })),
    antes: [], depois: {}, avisos: [...docsCriados.avisos], resumo: "",
  };
  const linhas = criacoes.map((a) => linhaCriacao(a, nomesJogador));
  const tocados = new Set<string>();

  for (const a of acoes) {
    if (ehCriacao(a)) continue;
    const chave = `${a.tipo}:${a.id}`;
    if (tocados.has(chave)) throw new Error("A proposta mexe no mesmo item mais de uma vez. Junte as mudanças numa só ação.");
    tocados.add(chave);

    if (a.tipo === "ficha") {
      const atual = atuais.fichas[a.id];
      if (!atual) throw new Error(`Ficha não encontrada: ${a.id}`);
      if (atual.mestre !== true) throw new Error("Esta ficha não pode ser alterada por extensões (é uma ficha pessoal de jogador).");
      // Sem a foto (que nunca muda por aqui) no "antes" de alterações, para o registro do lote caber no Firestore.
      const { foto: _foto, ...semFoto } = atual;
      void _foto;
      if (a.op === "excluir") {
        saida.excluir.push({ tipo: "ficha", id: a.id });
        saida.antes.push({ tipo: "ficha", id: a.id, ficha: atual });
        saida.itens.push({ tipo: "ficha", id: a.id, nome: s(atual.nome), op: "excluir" });
        linhas.push(`• EXCLUIR ficha “${curto(s(atual.nome))}” (${rotuloCategoria(s(atual.categoria))}, visível para: ${quemVeDoc(atual, nomesPorConta)})`);
        continue;
      }
      const r = alterarFicha(a, atual, jogadores, origem, saida.avisos, nomesPorConta);
      saida.fichas.push(r.doc);
      saida.antes.push({ tipo: "ficha", id: a.id, ficha: semFoto });
      saida.depois[chave] = hashDoc(r.doc);
      saida.itens.push({ tipo: "ficha", id: a.id, nome: s(r.doc.nome), op: "alterar" });
      linhas.push(r.linha);
      continue;
    }

    const mestre = atuais.missoesMestre[a.id];
    const publica = atuais.missoesPublicas[a.id];
    const completa = missaoCompleta(mestre, publica);
    if (!completa) throw new Error(`Missão não encontrada: ${a.id}`);
    saida.antes.push({ tipo: "missao", id: a.id, mestre: mestre ?? null, publica: publica ?? null });
    if (a.op === "excluir") {
      saida.excluir.push({ tipo: "missao", id: a.id });
      saida.itens.push({ tipo: "missao", id: a.id, nome: s(completa.titulo), op: "excluir" });
      linhas.push(`• EXCLUIR missão “${curto(s(completa.titulo))}”`);
      continue;
    }
    const r = alterarMissao(a, completa, origem, novoId, hoje);
    saida.missoes.push(r.doc);
    saida.depois[chave] = hashDoc(r.doc);
    saida.itens.push({ tipo: "missao", id: a.id, nome: s(r.doc.titulo), op: "alterar" });
    linhas.push(r.linha);
  }

  const exclusoes = saida.excluir.length ? `\n\nAtenção: ${saida.excluir.length} item(ns) serão APAGADOS.` : "";
  saida.resumo = `${tituloResumo(acoes)}:\n${linhas.join("\n")}${exclusoes}\n\nVocê poderá desfazer tudo depois, na tela da extensão (o que foi alterado ou apagado volta como era).`;
  return saida;
}

/** Itens de um lote que foram mudados de novo depois dele (o desfazer sobrescreveria essas mudanças). */
export function editadosDepois(depois: Record<string, string>, atuaisPorChave: Record<string, unknown | undefined>): string[] {
  return Object.entries(depois).filter(([chave, h]) => atuaisPorChave[chave] !== undefined && hashDoc(atuaisPorChave[chave]) !== h).map(([chave]) => chave);
}
