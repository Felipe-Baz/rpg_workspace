"use client";

import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getApp } from "firebase/app";
import "./firebase"; // garante o app inicializado

const LIMITE = 15 * 1024 * 1024;

/** Storage só é usado se o bucket estiver configurado; senão o fluxo cai para data URL. */
export const storageConfigurado = () => !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const storage = () => getStorage(getApp());

/** Envia um arquivo para mesas/{mesaId}/{pasta}/ e devolve a URL. O nome é aleatório (não adivinhável). */
export async function enviarArquivo(mesaId: string, pasta: "mapas" | "assets" | "refs", arquivo: Blob, ext = "jpg") {
  if (arquivo.size > LIMITE) throw new Error("Arquivo maior que 15 MB.");
  const nome = `${crypto.randomUUID()}.${ext}`;
  const r = ref(storage(), `mesas/${mesaId}/${pasta}/${nome}`);
  await uploadBytes(r, arquivo, { contentType: arquivo.type || "image/jpeg" });
  return getDownloadURL(r);
}

export const ehUrlStorage = (url: string) => /^https:\/\/(firebasestorage\.googleapis\.com|[^/]*\.storage\.googleapis\.com)\//.test(url);

/** Exclui pela URL; ignora silenciosamente data URLs e falhas (arquivo já removido). */
export async function excluirPorUrl(url: string) {
  if (!ehUrlStorage(url)) return;
  try {
    await deleteObject(ref(storage(), url));
  } catch (e) {
    console.warn("storage: exclusão falhou", e);
  }
}
