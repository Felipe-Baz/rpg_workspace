"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { MUNDO_PADRAO } from "@/content/valgreth";

// ===== Modelo (o que o mestre cadastra como JSON) =====

export type Detalhe = { rotulo: string; valor: string };

export type ItemCartao = {
  titulo: string;
  subtitulo?: string;
  icone?: string; // emoji
  tags?: string[];
  texto?: string; // Markdown
  detalhes?: Detalhe[];
};

export type Bloco =
  | { tipo: "texto"; titulo?: string; texto: string }
  | { tipo: "destaque"; titulo?: string; texto: string }
  | { tipo: "cartoes"; titulo?: string; texto?: string; colunas?: 1 | 2 | 3; itens: ItemCartao[] }
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] };

export type Secao = { id: string; titulo: string; icone?: string; resumo?: string; blocos: Bloco[] };

export type Mundo = { titulo: string; subtitulo?: string; introducao?: string; secoes: Secao[] };

// ===== Validação =====

const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function str(v: unknown, caminho: string, obrigatorio = true): string | undefined {
  if (v === undefined || v === null) {
    if (obrigatorio) throw new Error(`${caminho}: campo obrigatório.`);
    return undefined;
  }
  if (typeof v !== "string") throw new Error(`${caminho}: deve ser texto.`);
  return v;
}

function lista(v: unknown, caminho: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${caminho}: deve ser uma lista.`);
  return v;
}

function item(v: unknown, c: string): ItemCartao {
  if (!ehObj(v)) throw new Error(`${c}: deve ser um objeto.`);
  return {
    titulo: str(v.titulo, `${c}.titulo`)!,
    subtitulo: str(v.subtitulo, `${c}.subtitulo`, false),
    icone: str(v.icone, `${c}.icone`, false),
    texto: str(v.texto, `${c}.texto`, false),
    tags: v.tags === undefined ? undefined : lista(v.tags, `${c}.tags`).map((t, i) => str(t, `${c}.tags[${i}]`)!),
    detalhes:
      v.detalhes === undefined
        ? undefined
        : lista(v.detalhes, `${c}.detalhes`).map((d, i) => {
            if (!ehObj(d)) throw new Error(`${c}.detalhes[${i}]: deve ser um objeto.`);
            return { rotulo: str(d.rotulo, `${c}.detalhes[${i}].rotulo`)!, valor: str(d.valor, `${c}.detalhes[${i}].valor`)! };
          }),
  };
}

function bloco(v: unknown, c: string): Bloco {
  if (!ehObj(v)) throw new Error(`${c}: deve ser um objeto.`);
  const titulo = str(v.titulo, `${c}.titulo`, false);
  switch (v.tipo) {
    case "texto":
    case "destaque":
      return { tipo: v.tipo, titulo, texto: str(v.texto, `${c}.texto`)! };
    case "cartoes": {
      const colunas = v.colunas === undefined ? undefined : Number(v.colunas);
      if (colunas !== undefined && ![1, 2, 3].includes(colunas)) throw new Error(`${c}.colunas: use 1, 2 ou 3.`);
      return {
        tipo: "cartoes",
        titulo,
        texto: str(v.texto, `${c}.texto`, false),
        colunas: colunas as 1 | 2 | 3 | undefined,
        itens: lista(v.itens, `${c}.itens`).map((x, i) => item(x, `${c}.itens[${i}]`)),
      };
    }
    case "tabela":
      return {
        tipo: "tabela",
        titulo,
        colunas: lista(v.colunas, `${c}.colunas`).map((x, i) => str(x, `${c}.colunas[${i}]`)!),
        linhas: lista(v.linhas, `${c}.linhas`).map((l, i) =>
          lista(l, `${c}.linhas[${i}]`).map((x, j) => str(x, `${c}.linhas[${i}][${j}]`)!),
        ),
      };
    default:
      throw new Error(`${c}.tipo: use "texto", "destaque", "cartoes" ou "tabela".`);
  }
}

/** Valida um objeto qualquer e devolve o Mundo normalizado (lança Error com o caminho do problema). */
export function validarMundo(v: unknown): Mundo {
  if (!ehObj(v)) throw new Error("A raiz deve ser um objeto { titulo, secoes: [...] }.");
  const secoes = lista(v.secoes, "secoes").map((s, i): Secao => {
    const c = `secoes[${i}]`;
    if (!ehObj(s)) throw new Error(`${c}: deve ser um objeto.`);
    const titulo = str(s.titulo, `${c}.titulo`)!;
    return {
      id: str(s.id, `${c}.id`, false) || `s${i}`,
      titulo,
      icone: str(s.icone, `${c}.icone`, false),
      resumo: str(s.resumo, `${c}.resumo`, false),
      blocos: lista(s.blocos, `${c}.blocos`).map((b, j) => bloco(b, `${c}.blocos[${j}]`)),
    };
  });
  return {
    titulo: str(v.titulo, "titulo")!,
    subtitulo: str(v.subtitulo, "subtitulo", false),
    introducao: str(v.introducao, "introducao", false),
    secoes,
  };
}

/** Texto JSON → Mundo validado. */
export function lerMundoJson(json: string): Mundo {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch (e) {
    throw new Error(`JSON inválido: ${e instanceof Error ? e.message : String(e)}`);
  }
  return validarMundo(bruto);
}

// ===== Firestore: mesas/{id}/mundo/principal → { json, atualizadoEm } =====
// Guardado como texto JSON porque o Firestore não aceita listas dentro de listas (tabelas).

const ref = (mesaId: string) => doc(db, "mesas", mesaId, "mundo", "principal");

export function useMundo(mesaId: string, habilitado: boolean) {
  const [json, setJson] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!habilitado) return;
    return onSnapshot(
      ref(mesaId),
      (snap) => {
        setJson(snap.exists() ? ((snap.data().json as string | undefined) ?? null) : null);
        setCarregado(true);
      },
      (e) => {
        console.error("mundo:", e);
        setCarregado(true);
      },
    );
  }, [mesaId, habilitado]);

  let mundo: Mundo = MUNDO_PADRAO;
  let personalizado = false;
  if (json) {
    try {
      mundo = lerMundoJson(json);
      personalizado = true;
    } catch (e) {
      console.error("mundo salvo inválido:", e);
    }
  }
  return { mundo, personalizado, json, carregado };
}

export async function salvarMundo(mesaId: string, json: string) {
  const mundo = lerMundoJson(json); // valida antes de gravar
  await setDoc(ref(mesaId), { json: JSON.stringify(mundo), atualizadoEm: Date.now() });
}

export const restaurarMundoPadrao = (mesaId: string) => deleteDoc(ref(mesaId));
