"use client";

// Escrita feita por extensões: sempre em LOTE, marcada com a extensão de origem, para listar e desfazer.
// Quem decide é o mestre: este módulo só executa depois da aprovação (ver components/extensoes/proponente.ts).
// E7: o lote também altera e exclui; o registro guarda o "antes" de cada item para o desfazer restaurar.

import { collection, doc, getDoc, query, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { derivarPublica, type MissaoMestre } from "../missoes";
import { uid as novoId, type Mesa } from "../mesas";
import { ehCriacao, type Acao } from "./acoes";
import { DADOS_EXEMPLO } from "./broker-puro";
import { useLista } from "./dados";
import { editadosDepois, montarLote, type AntesItem, type AtuaisLote, type ItemLote, type LoteMontado } from "./lote";

export type Lote = {
  id: string; extId: string; titulo: string; criadoEm: number; itens: ItemLote[]; desfeitoEm: number | null;
  /** E7: o que estava antes de cada alteração/exclusão (para restaurar) e o hash do que foi gravado. */
  antes?: AntesItem[];
  depois?: Record<string, string>;
};
export type ResultadoLote = { lote: string; criados: ItemLote[]; alterados: ItemLote[]; excluidos: ItemLote[]; avisos: string[] };

/** O registro do lote precisa caber num documento do Firestore (1 MB), com folga. */
const MAX_REGISTRO = 900_000;

const colLotes = (mesaId: string) => collection(db, "mesas", mesaId, "extensoesLotes");
type Doc = Record<string, unknown>;

/** Lê os documentos atuais de tudo que a proposta altera ou exclui. */
export async function lerAtuais(mesaId: string, acoes: readonly Acao[]): Promise<AtuaisLote> {
  const atuais: AtuaisLote = { fichas: {}, missoesMestre: {}, missoesPublicas: {} };
  await Promise.all(
    acoes.filter((a) => !ehCriacao(a)).map(async (a) => {
      const id = (a as { id: string }).id;
      if (a.tipo === "ficha") {
        const s = await getDoc(doc(db, "mesas", mesaId, "fichas", id));
        atuais.fichas[id] = s.exists() ? (s.data() as Doc) : undefined;
      } else {
        const [m, p] = await Promise.all([getDoc(doc(db, "mesas", mesaId, "missoesMestre", id)), getDoc(doc(db, "mesas", mesaId, "missoes", id))]);
        atuais.missoesMestre[id] = m.exists() ? (m.data() as Doc) : undefined;
        atuais.missoesPublicas[id] = p.exists() ? (p.data() as Doc) : undefined;
      }
    }),
  );
  return atuais;
}

/** Ensaio com "dados de exemplo": os itens fictícios do broker viram documentos que dá para alterar e excluir. */
export function atuaisDeExemplo(): AtuaisLote {
  const fichas = (DADOS_EXEMPLO.fichas as { itens: Doc[] }).itens;
  const missoes = (DADOS_EXEMPLO.missoes as { itens: (Doc & { etapas: { texto: string; status: string }[] })[] }).itens;
  return {
    fichas: Object.fromEntries(fichas.map((f) => [f.id as string, { ...f, donoUid: "mestre", foto: "", criadoEm: 0, mestre: true, todos: false, liberadoPara: [] }])),
    missoesMestre: Object.fromEntries(missoes.map((m) => [m.id as string, { id: m.id, titulo: m.titulo, descricaoPublica: m.descricao, descricaoMestre: "", status: m.status, dificuldade: m.dificuldade, categoria: m.categoria, criadoEm: 0, etapas: m.etapas.map((e, i) => ({ id: `${m.id}-e${i + 1}`, texto: e.texto, status: e.status, notaMestre: "", dataConclusao: "" })) }])),
    missoesPublicas: {},
  };
}

export type LotePreparado = { lote: string; montado: LoteMontado; executar: () => Promise<ResultadoLote> };

/**
 * Lê o que existe hoje, monta o lote (com o "antes → depois" para a aprovação) e devolve quem grava.
 * `ensaio` não grava nada: devolve ids fictícios, para a extensão poder ser testada no criador sem sujar a mesa.
 */
export async function prepararLote(entrada: { mesa: Mesa; uid: string; ext: { id: string; titulo: string }; acoes: Acao[]; ensaio?: boolean; exemplo?: boolean }): Promise<LotePreparado> {
  const { mesa, uid, ext, acoes, ensaio } = entrada;
  const lote = novoId();
  const atuais = entrada.exemplo ? atuaisDeExemplo() : await lerAtuais(mesa.id, acoes);
  const montado = montarLote({ acoes, atuais, uidMestre: uid, jogadores: mesa.jogadores, origem: { extensao: ext.id, lote }, agora: Date.now(), novoId });
  const resultado: ResultadoLote = {
    lote,
    criados: montado.itens.filter((i) => i.op === "criar"),
    alterados: montado.itens.filter((i) => i.op === "alterar"),
    excluidos: montado.itens.filter((i) => i.op === "excluir"),
    avisos: montado.avisos,
  };
  const registro: Lote = { id: lote, extId: ext.id, titulo: ext.titulo, criadoEm: Date.now(), itens: montado.itens, desfeitoEm: null, ...(montado.antes.length ? { antes: montado.antes, depois: montado.depois } : {}) };
  if (JSON.stringify(registro).length > MAX_REGISTRO) throw new Error("Esta proposta mexe em itens grandes demais para dar para desfazer de uma vez. Divida em partes menores.");

  return {
    lote,
    montado,
    async executar() {
      if (ensaio) return { ...resultado, lote: `ensaio-${lote}` };
      const b = writeBatch(db);
      for (const f of montado.fichas) b.set(doc(db, "mesas", mesa.id, "fichas", f.id as string), f);
      for (const m of montado.missoes) {
        b.set(doc(db, "mesas", mesa.id, "missoesMestre", m.id as string), m);
        b.set(doc(db, "mesas", mesa.id, "missoes", m.id as string), derivarPublica(m as unknown as MissaoMestre));
      }
      for (const x of montado.excluir) {
        if (x.tipo === "ficha") b.delete(doc(db, "mesas", mesa.id, "fichas", x.id));
        else {
          // As ilustrações da missão ficam: se o lote for desfeito, a missão volta com elas.
          b.delete(doc(db, "mesas", mesa.id, "missoesMestre", x.id));
          b.delete(doc(db, "mesas", mesa.id, "missoes", x.id));
        }
      }
      b.set(doc(colLotes(mesa.id), lote), registro);
      await b.commit();
      return resultado;
    },
  };
}

/** Atalho: prepara e grava sem pedir aprovação (quem chama já aprovou, como em `aprovarPedido`). */
export async function executarLote(entrada: { mesa: Mesa; uid: string; ext: { id: string; titulo: string }; acoes: Acao[]; ensaio?: boolean }): Promise<ResultadoLote> {
  return (await prepararLote(entrada)).executar();
}

/** Documentos atuais (versão completa, no caso das missões) dos itens que o lote alterou, para detectar edição posterior. */
async function atuaisDoLote(mesaId: string, lote: Lote): Promise<Record<string, Doc | undefined>> {
  const saida: Record<string, Doc | undefined> = {};
  await Promise.all(
    Object.keys(lote.depois ?? {}).map(async (chave) => {
      const [tipo, id] = chave.split(":");
      const s = await getDoc(doc(db, "mesas", mesaId, tipo === "ficha" ? "fichas" : "missoesMestre", id));
      saida[chave] = s.exists() ? (s.data() as Doc) : undefined;
    }),
  );
  return saida;
}

/**
 * Desfaz o lote: apaga o que ele criou, restaura o que alterou e recria o que excluiu. Se algum item alterado foi mudado
 * de novo depois do lote, `confirmarPerda(nomes)` decide (false = não desfaz nada).
 */
export async function desfazerLote(mesaId: string, lote: Lote, confirmarPerda?: (nomes: string[]) => Promise<boolean>): Promise<boolean> {
  const ref = doc(colLotes(mesaId), lote.id);
  const atual = await getDoc(ref);
  if (!atual.exists() || (atual.data() as Lote).desfeitoEm) return false;
  const registro = atual.data() as Lote;

  const atuais = await atuaisDoLote(mesaId, registro);
  const editados = editadosDepois(registro.depois ?? {}, atuais);
  if (editados.length) {
    const nomes = editados.map((k) => registro.itens.find((i) => `${i.tipo}:${i.id}` === k)?.nome ?? k);
    if (!confirmarPerda || !(await confirmarPerda(nomes))) return false;
  }

  const b = writeBatch(db);
  for (const i of registro.itens) {
    if ((i.op ?? "criar") !== "criar") continue;
    if (i.tipo === "ficha") b.delete(doc(db, "mesas", mesaId, "fichas", i.id));
    else {
      b.delete(doc(db, "mesas", mesaId, "missoesMestre", i.id));
      b.delete(doc(db, "mesas", mesaId, "missoes", i.id));
    }
  }
  for (const a of registro.antes ?? []) {
    if (a.tipo === "ficha") {
      const r = doc(db, "mesas", mesaId, "fichas", a.id);
      if (!a.ficha) { b.delete(r); continue; }
      // Alterações não guardam a foto (ela não muda por aqui): mantém a atual.
      const fotoAtual = atuais[`ficha:${a.id}`]?.foto;
      b.set(r, { ...a.ficha, foto: (a.ficha.foto as string | undefined) ?? (fotoAtual as string | undefined) ?? "" });
    } else {
      const rm = doc(db, "mesas", mesaId, "missoesMestre", a.id);
      const rp = doc(db, "mesas", mesaId, "missoes", a.id);
      if (a.mestre) b.set(rm, a.mestre); else b.delete(rm);
      if (a.publica) b.set(rp, a.publica); else b.delete(rp);
    }
  }
  b.update(ref, { desfeitoEm: Date.now() });
  await b.commit();
  return true;
}

/** Lotes criados por extensões nesta mesa (mais recentes primeiro). `extId` filtra por extensão. */
export function useLotes(mesaId: string, extId: string | null, habilitado: boolean) {
  const { itens, carregado } = useLista<Lote>(habilitado && mesaId ? () => query(colLotes(mesaId)) : null, `lotes:${mesaId}:${habilitado}`);
  return { lotes: itens.filter((l) => !extId || l.extId === extId).sort((a, b) => b.criadoEm - a.criadoEm), carregado };
}
