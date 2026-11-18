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
  zonas?: Zona[]; // agrupamentos de coberturas (ex.: um cômodo)
  cobertas?: Cobertura[]; // áreas pretas sobre o mapa; vale para mestre e jogadores
};

// Pontos em fração (0–1) da imagem. Objetos {x,y}: o Firestore não aceita arrays aninhados.
export type Ponto = { x: number; y: number };
export type Zona = { id: string; nome: string };
export type Cobertura = { id: string; zonaId: string; pontos: Ponto[]; revelada: boolean };

// Pino privado do jogador. x/y em fração (0–1) da imagem.
export type Pino = { id: string; x: number; y: number; titulo: string; texto: string };

// "mapas" e "imagens" compartilham o mesmo formato; só mudam a coleção e os rótulos.
export type Colecao = "mapas" | "imagens";

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

function useColecaoMapas(mesaId: string, colecao: Colecao, consultas: (() => Query)[], habilitado: boolean) {
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
  }, [mesaId, colecao, habilitado]);

  const vistos = new Map<string, Mapa>();
  grupos.flat().forEach((m) => vistos.set(m.id, m));
  const mapas = [...vistos.values()].sort((a, b) => b.criadoEm - a.criadoEm);
  return { mapas, carregado };
}

const col = (mesaId: string, colecao: Colecao = "mapas") => collection(db, "mesas", mesaId, colecao);

export function useMapasMestre(mesaId: string, habilitado: boolean, colecao: Colecao = "mapas") {
  return useColecaoMapas(mesaId, colecao, [() => query(col(mesaId, colecao))], habilitado);
}

/** Mapas liberados para todos ou individualmente para este jogador. */
export function useMapasJogador(mesaId: string, usuarioUid: string, habilitado: boolean, colecao: Colecao = "mapas") {
  return useColecaoMapas(
    mesaId,
    colecao,
    [
      () => query(col(mesaId, colecao), where("todos", "==", true)),
      () => query(col(mesaId, colecao), where("liberadoPara", "array-contains", usuarioUid)),
    ],
    habilitado && !!usuarioUid,
  );
}

export async function criarMapa(mesaId: string, nome: string, imagem: string, colecao: Colecao = "mapas") {
  const mapa: Mapa = { id: novoId(), nome, imagem, criadoEm: Date.now(), todos: false, liberadoPara: [] };
  await setDoc(doc(col(mesaId, colecao), mapa.id), mapa);
}

export const atualizarMapa = (mesaId: string, mapaId: string, patch: Partial<Mapa>, colecao: Colecao = "mapas") =>
  updateDoc(doc(col(mesaId, colecao), mapaId), patch);

export const excluirMapa = (mesaId: string, mapaId: string, colecao: Colecao = "mapas") =>
  deleteDoc(doc(col(mesaId, colecao), mapaId));

// Pinos privados: mesas/{id}/pinos/{uid} → { porMapa: { [mapaId]: Pino[] }, notas: { [mapaId]: texto } }
// (os ids de mapas e imagens não colidem, então os dois usam o mesmo documento).
type PinosDoc = { porMapa: Record<string, Pino[]>; notas?: Record<string, string> };
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
      atualizar({ ...dados, porMapa: { ...dados.porMapa, [mapaId]: pinos } }),
    notaDe: (mapaId: string) => dados.notas?.[mapaId] ?? "",
    definirNota: (mapaId: string, texto: string) =>
      atualizar({ ...dados, notas: { ...(dados.notas ?? {}), [mapaId]: texto } }),
  };
}
