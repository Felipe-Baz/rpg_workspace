"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where, type Query } from "firebase/firestore";
import { db } from "./firebase";
import { uid as novoId, useDocSincronizado } from "./mesas";

// Documento mesas/{id}/mapas/{mapaId}. A imagem vai comprimida (data URL)
// no próprio documento, por isso o limite de ~900 KB.
export type Mapa = {
  id: string;
  nome: string;
  imagem: string;
  criadoEm: number;
  todos: boolean; // liberado para todos os jogadores
  liberadoPara: string[]; // uids com acesso individual
};

// Pino privado do jogador. x/y em fração (0–1) da imagem.
export type Pino = { id: string; x: number; y: number; titulo: string; texto: string };

const LIMITE_BYTES = 900_000;

/** Reduz e recomprime a imagem até caber no limite de um documento do Firestore. */
export async function comprimirImagem(arquivo: File, ladoInicial = 2200, limite = LIMITE_BYTES): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  let lado = ladoInicial;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const esc = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * esc);
    c.height = Math.round(bmp.height * esc);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const url = c.toDataURL("image/jpeg", q);
      if (url.length <= limite) return url;
    }
    lado = Math.round(lado * 0.8);
  }
  throw new Error("Não foi possível reduzir a imagem o bastante.");
}

function useColecaoMapas(mesaId: string, consultas: (() => Query)[], habilitado: boolean) {
  const [grupos, setGrupos] = useState<Mapa[][]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!habilitado) return;
    const resultados: Mapa[][] = consultas.map(() => []);
    const feitos = new Set<number>();
    const offs = consultas.map((q, i) =>
      onSnapshot(
        q(),
        (snap) => {
          resultados[i] = snap.docs.map((d) => d.data() as Mapa);
          feitos.add(i);
          setGrupos([...resultados]);
          if (feitos.size === consultas.length) setCarregado(true);
        },
        (e) => {
          console.error("mapas:", e);
          feitos.add(i);
          if (feitos.size === consultas.length) setCarregado(true);
        },
      ),
    );
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId, habilitado]);

  const vistos = new Map<string, Mapa>();
  grupos.flat().forEach((m) => vistos.set(m.id, m));
  const mapas = [...vistos.values()].sort((a, b) => b.criadoEm - a.criadoEm);
  return { mapas, carregado };
}

const col = (mesaId: string) => collection(db, "mesas", mesaId, "mapas");

export function useMapasMestre(mesaId: string, habilitado: boolean) {
  return useColecaoMapas(mesaId, [() => query(col(mesaId))], habilitado);
}

/** Mapas liberados para todos ou individualmente para este jogador. */
export function useMapasJogador(mesaId: string, usuarioUid: string, habilitado: boolean) {
  return useColecaoMapas(
    mesaId,
    [
      () => query(col(mesaId), where("todos", "==", true)),
      () => query(col(mesaId), where("liberadoPara", "array-contains", usuarioUid)),
    ],
    habilitado && !!usuarioUid,
  );
}

export async function criarMapa(mesaId: string, nome: string, imagem: string) {
  const mapa: Mapa = { id: novoId(), nome, imagem, criadoEm: Date.now(), todos: false, liberadoPara: [] };
  await setDoc(doc(col(mesaId), mapa.id), mapa);
}

export const atualizarMapa = (mesaId: string, mapaId: string, patch: Partial<Mapa>) =>
  updateDoc(doc(col(mesaId), mapaId), patch);

export const excluirMapa = (mesaId: string, mapaId: string) => deleteDoc(doc(col(mesaId), mapaId));

// Pinos privados: mesas/{id}/pinos/{uid} → { porMapa: { [mapaId]: Pino[] } }
type PinosDoc = { porMapa: Record<string, Pino[]> };
const PINOS_VAZIOS: PinosDoc = { porMapa: {} };

export function usePinos(mesaId: string, usuarioUid: string, habilitado: boolean) {
  const { dados, carregado, atualizar } = useDocSincronizado<PinosDoc>(
    ["mesas", mesaId, "pinos", usuarioUid],
    PINOS_VAZIOS,
    habilitado && !!usuarioUid,
  );
  return {
    carregado,
    pinosDe: (mapaId: string) => dados.porMapa?.[mapaId] ?? [],
    definirPinos: (mapaId: string, pinos: Pino[]) =>
      atualizar({ porMapa: { ...dados.porMapa, [mapaId]: pinos } }),
  };
}
