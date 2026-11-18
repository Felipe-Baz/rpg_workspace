"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { excluirCena } from "../../cena/cenas";
import { excluirPorUrl } from "../../storage";
import { extrairPaleta } from "./paleta";
import type { ImagemBase64 } from "../tipos";
import type { Tema } from "./tipos";

// Temas em mesas/{id}/temas/{temaId} (só o mestre lê/escreve).

const colTemas = (mesaId: string) => collection(db, "mesas", mesaId, "temas");

export function useTemas(mesaId: string) {
  const [temas, setTemas] = useState<Tema[]>([]);
  useEffect(
    () =>
      onSnapshot(
        colTemas(mesaId),
        (s) => setTemas(s.docs.map((d) => d.data() as Tema).sort((a, b) => a.nome.localeCompare(b.nome))),
        (e) => console.error("temas:", e),
      ),
    [mesaId],
  );
  return temas;
}

export const salvarTema = (mesaId: string, tema: Tema) => setDoc(doc(colTemas(mesaId), tema.id), JSON.parse(JSON.stringify(tema)));

const consultaCenas = (mesaId: string, temaId: string) => query(collection(db, "mesas", mesaId, "cenas"), where("temaId", "==", temaId));
const consultaAssets = (mesaId: string, temaId: string) => query(collection(db, "mesas", mesaId, "assets"), where("temaId", "==", temaId));

/** O que seria apagado junto com o tema (para o aviso de confirmação). */
export async function usoDoTema(mesaId: string, temaId: string) {
  const [c, a] = await Promise.all([getDocs(consultaCenas(mesaId, temaId)), getDocs(consultaAssets(mesaId, temaId))]);
  return { mapas: c.size, assets: a.size };
}

/**
 * Exclui o tema EM CASCATA: os mapas de cena que o usam (mapa, cena e render), os assets do tema
 * e as imagens de referência. A confirmação (digitar o nome) é responsabilidade da tela.
 */
export async function excluirTemaEmCascata(mesaId: string, tema: Tema) {
  for (const d of (await getDocs(consultaCenas(mesaId, tema.id))).docs) {
    const cena = d.data() as { mapaId?: string };
    if (cena.mapaId) {
      const refMapa = doc(db, "mesas", mesaId, "mapas", cena.mapaId);
      const mapa = (await getDoc(refMapa)).data() as { imagem?: string } | undefined;
      await deleteDoc(refMapa);
      if (mapa?.imagem) await excluirPorUrl(mapa.imagem);
    }
    await excluirCena(mesaId, d.id);
  }
  for (const d of (await getDocs(consultaAssets(mesaId, tema.id))).docs) {
    const { url, publico } = d.data() as { url?: string; publico?: boolean };
    await deleteDoc(d.ref);
    if (url && !publico) await excluirPorUrl(url); // arquivo público é compartilhado com outras mesas
  }
  await deleteDoc(doc(colTemas(mesaId), tema.id));
  await Promise.all([...tema.referencias, ...tema.ancoras].map(excluirPorUrl));
}

/** Lê o arquivo, reduz (lado maior 768) e devolve pixels RGBA + JPEG base64 para a análise. Tudo no cliente. */
export async function prepararReferencia(arquivo: File): Promise<{ paleta: string[]; imagem: ImagemBase64 }> {
  const bmp = await createImageBitmap(arquivo);
  const esc = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * esc));
  c.height = Math.max(1, Math.round(bmp.height * esc));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const paleta = extrairPaleta(ctx.getImageData(0, 0, c.width, c.height).data);
  const url = c.toDataURL("image/jpeg", 0.8);
  return { paleta, imagem: { mime: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) } };
}
