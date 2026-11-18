"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { uid as novoId } from "../mesas";
import { enviarArquivo, excluirPorUrl } from "../storage";
import type { Asset, Cena } from "./tipos";

// Cena em mesas/{id}/cenas/{cenaId}. Acima do limite, camadas/objetos vão num JSON no Storage
// e o documento guarda só `jsonUrl`. Assets em mesas/{id}/assets/{assetId} (só o mestre lê).

const LIMITE_DOC = 800_000;

type DocCena = Omit<Cena, "camadas" | "objetos"> & { camadas?: Cena["camadas"]; objetos?: Cena["objetos"]; jsonUrl?: string };

const refCena = (mesaId: string, cenaId: string) => doc(db, "mesas", mesaId, "cenas", cenaId);
const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore não aceita `undefined`

export async function salvarCena(mesaId: string, cena: Cena): Promise<Cena> {
  const salva = { ...cena, atualizadoEm: Date.now() };
  const json = JSON.stringify(salva);
  const anterior = await getDoc(refCena(mesaId, cena.id));
  const urlAnterior = (anterior.data() as DocCena | undefined)?.jsonUrl;
  if (json.length <= LIMITE_DOC) {
    await setDoc(refCena(mesaId, cena.id), limpar(salva));
  } else {
    const { camadas: _c, objetos: _o, ...resto } = salva;
    void _c; void _o;
    const jsonUrl = await enviarArquivo(mesaId, "cenas", new Blob([json], { type: "application/json" }), "json");
    await setDoc(refCena(mesaId, cena.id), limpar({ ...resto, jsonUrl }));
  }
  if (urlAnterior) await excluirPorUrl(urlAnterior);
  return salva;
}

export async function carregarCena(mesaId: string, cenaId: string): Promise<Cena | null> {
  const snap = await getDoc(refCena(mesaId, cenaId));
  if (!snap.exists()) return null;
  const d = snap.data() as DocCena;
  if (d.jsonUrl) {
    const r = await fetch(d.jsonUrl);
    if (!r.ok) throw new Error("Não foi possível carregar a cena.");
    return (await r.json()) as Cena;
  }
  return { ...d, camadas: d.camadas ?? [], objetos: d.objetos ?? [] } as Cena;
}

export async function excluirCena(mesaId: string, cenaId: string) {
  const snap = await getDoc(refCena(mesaId, cenaId));
  const url = (snap.data() as DocCena | undefined)?.jsonUrl;
  await deleteDoc(refCena(mesaId, cenaId));
  if (url) await excluirPorUrl(url);
}

// ---- Assets ----

export function useAssets(mesaId: string) {
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "mesas", mesaId, "assets"),
        (s) => setAssets(s.docs.map((d) => d.data() as Asset).sort((a, b) => b.criadoEm - a.criadoEm)),
        (e) => console.error("assets:", e),
      ),
    [mesaId],
  );
  return assets;
}

/** Envia um PNG (com transparência) e registra o asset. */
export async function enviarAsset(mesaId: string, arquivo: File, perspectivaId = "topdown"): Promise<Asset> {
  if (!/^image\/(png|webp)$/.test(arquivo.type)) throw new Error("Use PNG (ou WebP) com transparência.");
  const bmp = await createImageBitmap(arquivo);
  const url = await enviarArquivo(mesaId, "assets", arquivo, arquivo.type === "image/webp" ? "webp" : "png");
  const asset: Asset = {
    id: novoId(),
    nome: arquivo.name.replace(/\.[^.]+$/, ""),
    url,
    largura: bmp.width,
    altura: bmp.height,
    origem: "enviado",
    perspectivaId,
    criadoEm: Date.now(),
  };
  await setDoc(doc(db, "mesas", mesaId, "assets", asset.id), asset);
  return asset;
}
