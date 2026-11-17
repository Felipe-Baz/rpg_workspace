"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { uid as novoId } from "./mesas";
import { comprimirImagem } from "./mapas";

export type StatusMissao = "em_andamento" | "concluida" | "fracassada";
export type StatusEtapa = "concluida" | "atual" | "pendente";

export const STATUS_MISSAO: { id: StatusMissao; rotulo: string; icone: string; cor: string }[] = [
  { id: "em_andamento", rotulo: "Em andamento", icone: "⏳", cor: "text-amber-800" },
  { id: "concluida", rotulo: "Concluída", icone: "✅", cor: "text-emerald-800" },
  { id: "fracassada", rotulo: "Fracassada", icone: "❌", cor: "text-red-800" },
];

export const STATUS_ETAPA: { id: StatusEtapa; rotulo: string }[] = [
  { id: "pendente", rotulo: "Pendente (oculta)" },
  { id: "atual", rotulo: "Atual" },
  { id: "concluida", rotulo: "Concluída" },
];

export type Etapa = {
  id: string;
  texto: string;
  status: StatusEtapa;
  notaMestre: string; // privada (só existe no documento do mestre)
  dataConclusao: string; // ISO yyyy-mm-dd ou ""
};

// Visão completa — só o mestre lê/escreve: mesas/{id}/missoesMestre/{missaoId}.
export type MissaoMestre = {
  id: string;
  titulo: string;
  descricaoPublica: string;
  descricaoMestre: string;
  status: StatusMissao;
  dificuldade: string;
  categoria: string;
  etapas: Etapa[];
  criadoEm: number;
};

// Visão dos jogadores — mesas/{id}/missoes/{missaoId}. É derivada da completa e NUNCA contém
// etapas pendentes, notas ou dificuldade: o que não está no documento não vaza.
export type EtapaPublica = { id: string; texto: string; status: "concluida" | "atual"; dataConclusao: string };
export type MissaoPublica = {
  id: string;
  titulo: string;
  descricaoPublica: string;
  status: StatusMissao;
  categoria: string;
  etapas: EtapaPublica[];
  criadoEm: number;
};

/** Gera a versão pública. A etapa atual só aparece com a missão em andamento. */
export function derivarPublica(m: MissaoMestre): MissaoPublica {
  const ativa = m.status === "em_andamento";
  const etapas: EtapaPublica[] = [];
  let temAtual = false;
  for (const e of m.etapas) {
    if (e.status === "concluida") etapas.push({ id: e.id, texto: e.texto, status: "concluida", dataConclusao: e.dataConclusao });
    else if (e.status === "atual" && ativa && !temAtual) {
      temAtual = true;
      etapas.push({ id: e.id, texto: e.texto, status: "atual", dataConclusao: "" });
    }
  }
  return {
    id: m.id,
    titulo: m.titulo,
    descricaoPublica: m.descricaoPublica,
    status: m.status,
    categoria: m.categoria ?? "",
    etapas,
    criadoEm: m.criadoEm,
  };
}

const colPublica = (mesaId: string) => collection(db, "mesas", mesaId, "missoes");
const colMestre = (mesaId: string) => collection(db, "mesas", mesaId, "missoesMestre");

// Tolera documentos da primeira versão (status "andamento", campo "descricao").
function normalizarStatus(s: string): StatusMissao {
  return s === "andamento" ? "em_andamento" : (s as StatusMissao);
}

function useColecao<T extends { id: string; criadoEm: number }>(
  ref: ReturnType<typeof collection>,
  habilitado: boolean,
  chave: string,
) {
  const [itens, setItens] = useState<T[]>([]);
  const [carregado, setCarregado] = useState(false);
  useEffect(() => {
    if (!habilitado) return;
    return onSnapshot(
      ref,
      (snap) => {
        setItens(snap.docs.map((d) => d.data() as T).sort((a, b) => b.criadoEm - a.criadoEm));
        setCarregado(true);
      },
      (e) => {
        console.error("missoes:", e);
        setCarregado(true);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, habilitado]);
  return { itens, carregado };
}

/** Jogador (e mestre): só a visão pública. */
export function useMissoesPublicas(mesaId: string, habilitado: boolean) {
  const { itens, carregado } = useColecao<MissaoPublica & { descricao?: string }>(colPublica(mesaId), habilitado, mesaId);
  const missoes: MissaoPublica[] = itens.map((m) => ({
    ...m,
    status: normalizarStatus(m.status),
    descricaoPublica: m.descricaoPublica ?? m.descricao ?? "",
    etapas: m.etapas ?? [],
    categoria: m.categoria ?? "",
  }));
  return { missoes, carregado };
}

/**
 * Mestre: visão completa. Missões que só existem na coleção pública (criadas antes da
 * separação mestre/público) são adaptadas aqui e passam a existir nas duas ao serem editadas.
 */
export function useMissoesMestre(mesaId: string, habilitado: boolean) {
  const { itens, carregado } = useColecao<MissaoMestre>(colMestre(mesaId), habilitado, mesaId);
  const { missoes: publicas, carregado: publicasOk } = useMissoesPublicas(mesaId, habilitado);

  const completas = itens.map((m) => ({ ...m, status: normalizarStatus(m.status) }));
  const ids = new Set(completas.map((m) => m.id));
  const legadas: MissaoMestre[] = publicas
    .filter((p) => !ids.has(p.id))
    .map((p) => ({
      id: p.id,
      titulo: p.titulo,
      descricaoPublica: p.descricaoPublica,
      descricaoMestre: "",
      status: p.status,
      dificuldade: "",
      categoria: p.categoria ?? "",
      criadoEm: p.criadoEm,
      etapas: p.etapas.map((e) => ({ ...e, notaMestre: "" })),
    }));

  const missoes = [...completas, ...legadas].sort((a, b) => b.criadoEm - a.criadoEm);
  return { missoes, carregado: carregado && publicasOk };
}

/** Grava a missão completa e a versão pública derivada de forma atômica. */
export async function salvarMissao(mesaId: string, m: MissaoMestre) {
  const b = writeBatch(db);
  b.set(doc(colMestre(mesaId), m.id), m);
  b.set(doc(colPublica(mesaId), m.id), derivarPublica(m));
  await b.commit();
}

// Ilustrações: mesas/{id}/missoesImagens/{imagemId}. Visíveis a todos os membros (são públicas);
// cada uma vai em um documento próprio para respeitar o limite de 1 MB do Firestore.
export type ImagemMissao = { id: string; missaoId: string; imagem: string; legenda: string; criadoEm: number };

const colImagens = (mesaId: string) => collection(db, "mesas", mesaId, "missoesImagens");

export function useImagensMissoes(mesaId: string, habilitado: boolean) {
  const { itens, carregado } = useColecao<ImagemMissao>(colImagens(mesaId), habilitado, mesaId + "/img");
  return { imagens: [...itens].sort((a, b) => a.criadoEm - b.criadoEm), carregado };
}

export async function adicionarImagemMissao(mesaId: string, missaoId: string, arquivo: File) {
  const imagem = await comprimirImagem(arquivo, 1600, 700_000);
  const i: ImagemMissao = { id: novoId(), missaoId, imagem, legenda: "", criadoEm: Date.now() };
  await setDoc(doc(colImagens(mesaId), i.id), i);
}

export const atualizarLegendaImagem = (mesaId: string, id: string, legenda: string) =>
  updateDoc(doc(colImagens(mesaId), id), { legenda });

export async function excluirImagemMissao(mesaId: string, id: string) {
  const b = writeBatch(db);
  b.delete(doc(colImagens(mesaId), id));
  await b.commit();
}

export async function excluirMissao(mesaId: string, id: string) {
  const b = writeBatch(db);
  const imgs = await getDocs(query(colImagens(mesaId), where("missaoId", "==", id)));
  imgs.docs.forEach((d) => b.delete(d.ref));
  b.delete(doc(colMestre(mesaId), id));
  b.delete(doc(colPublica(mesaId), id));
  await b.commit();
}

export const novaEtapa = (texto = "", status: StatusEtapa = "pendente"): Etapa => ({
  id: novoId(),
  texto,
  status,
  notaMestre: "",
  dataConclusao: "",
});

export const novaMissao = (titulo: string): MissaoMestre => ({
  id: novoId(),
  titulo,
  descricaoPublica: "",
  descricaoMestre: "",
  status: "em_andamento",
  dificuldade: "",
  categoria: "",
  etapas: [],
  criadoEm: Date.now(),
});

const hoje = () => new Date().toISOString().slice(0, 10);

/** Define o status de uma etapa mantendo no máximo uma "atual" (a anterior volta a pendente). */
export function definirStatusEtapa(m: MissaoMestre, etapaId: string, status: StatusEtapa): MissaoMestre {
  return {
    ...m,
    etapas: m.etapas.map((e) => {
      if (e.id === etapaId)
        return { ...e, status, dataConclusao: status === "concluida" ? e.dataConclusao || hoje() : "" };
      if (status === "atual" && e.status === "atual") return { ...e, status: "pendente" };
      return e;
    }),
  };
}

/** Conclui a etapa atual e promove a próxima pendente a atual. */
export function avancarEtapa(m: MissaoMestre): MissaoMestre {
  const atual = m.etapas.findIndex((e) => e.status === "atual");
  const proxima = m.etapas.findIndex((e, i) => i > atual && e.status === "pendente");
  return {
    ...m,
    etapas: m.etapas.map((e, i) => {
      if (i === atual) return { ...e, status: "concluida", dataConclusao: e.dataConclusao || hoje() };
      if (i === proxima) return { ...e, status: "atual" };
      return e;
    }),
  };
}
