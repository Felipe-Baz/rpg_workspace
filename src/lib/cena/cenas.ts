"use client";

import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { uid as novoId } from "../mesas";
import { enviarArquivo, excluirPorUrl } from "../storage";
import { TEMPO_MAX_JOB_MS, jobExpirado, type Job } from "../mapas-ia/assets/jobs";
import { cenasQueUsam, decidirExclusao, substituirAsset, type UsoEmCena } from "../mapas-ia/assets/biblioteca";
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

// ---- Biblioteca: uso, exclusão segura, substituição e jobs ----

/** Todas as cenas da mesa, com os objetos carregados (inclusive as que guardam o JSON no Storage). */
async function carregarTodasAsCenas(mesaId: string): Promise<Cena[]> {
  const s = await getDocs(collection(db, "mesas", mesaId, "cenas"));
  const cenas = await Promise.all(s.docs.map((d) => carregarCena(mesaId, d.id)));
  return cenas.filter((c): c is Cena => !!c);
}

export async function usosDoAsset(mesaId: string, assetId: string): Promise<UsoEmCena[]> {
  return cenasQueUsam(assetId, await carregarTodasAsCenas(mesaId));
}

/** Troca o asset por outro em todas as cenas que o usam (as cenas são regravadas; o render muda ao salvar no editor). */
export async function substituirAssetNasCenas(mesaId: string, deId: string, paraId: string) {
  for (const c of await carregarTodasAsCenas(mesaId)) {
    if (c.objetos.some((o) => o.assetId === deId)) await salvarCena(mesaId, substituirAsset(c, deId, paraId));
  }
}

export type ResultadoExclusao = { ok: true } | { ok: false; usos: UsoEmCena[]; motivo: string };

/**
 * Exclui o asset. Em uso por alguma cena, só com `substitutoId` (as cenas passam a usá-lo); sem ele
 * devolve `ok: false` com a lista de cenas e nada é apagado.
 */
export async function excluirAsset(mesaId: string, asset: Asset, substitutoId?: string): Promise<ResultadoExclusao> {
  const usos = await usosDoAsset(mesaId, asset.id);
  const d = decidirExclusao(asset.id, usos, substitutoId);
  if (!d.ok) return d;
  if (usos.length > 0 && substitutoId) await substituirAssetNasCenas(mesaId, asset.id, substitutoId);
  await deleteDoc(doc(db, "mesas", mesaId, "assets", asset.id));
  if (asset.url && !asset.publico) await excluirPorUrl(asset.url); // arquivo público é compartilhado
  return { ok: true };
}

export async function atualizarAsset(mesaId: string, assetId: string, patch: Partial<Pick<Asset, "nome" | "tags" | "escalaBase">>) {
  await setDoc(doc(db, "mesas", mesaId, "assets", assetId), limpar(patch), { merge: true });
}

/** Acompanha um job em tempo real (null enquanto não carrega ou sem id). */
export function useJob(mesaId: string, jobId: string | null) {
  const [estado, setEstado] = useState<{ id: string; job: Job | null } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    return onSnapshot(
      doc(db, "mesas", mesaId, "jobs", jobId),
      (s) => setEstado({ id: jobId, job: s.exists() ? (s.data() as Job) : null }),
      (e) => console.error("job:", e),
    );
  }, [mesaId, jobId]);
  return jobId && estado?.id === jobId ? estado.job : null;
}

// ---- Biblioteca pública (assets de IA de todas as mesas) ----

export function useAssetsPublicos() {
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "assetsPublicos"),
        (s) => setAssets(s.docs.map((d) => d.data() as Asset).sort((a, b) => b.criadoEm - a.criadoEm)),
        (e) => console.error("assets públicos:", e),
      ),
    [],
  );
  return assets;
}

/** Traz um asset público para a biblioteca da mesa (mesmo id e arquivo; idempotente). Cenas só enxergam assets da mesa. */
export async function adotarAssetPublico(mesaId: string, pub: Asset): Promise<Asset> {
  const asset: Asset = { ...pub, publico: true };
  await setDoc(doc(db, "mesas", mesaId, "assets", asset.id), limpar(asset));
  return asset;
}

/** Espera o job terminar ("pronto" ou "falhou"); job preso além do tempo máximo conta como falha. */
export function aguardarJob(mesaId: string, jobId: string): Promise<Job> {
  return new Promise((ok, falha) => {
    // Sem novos snapshots, um job preso nunca reavaliaria a expiração: o prazo encerra a espera.
    const prazo = setTimeout(() => {
      parar();
      falha(new Error("A geração não terminou a tempo."));
    }, TEMPO_MAX_JOB_MS);
    const parar = onSnapshot(
      doc(db, "mesas", mesaId, "jobs", jobId),
      (s) => {
        const job = s.data() as Job | undefined;
        if (!job) return;
        if (job.status === "pronto" || job.status === "falhou" || jobExpirado(job)) {
          parar();
          clearTimeout(prazo);
          ok(jobExpirado(job) ? { ...job, status: "falhou", erro: job.erro ?? "A geração não terminou a tempo." } : job);
        }
      },
      (e) => {
        parar();
        clearTimeout(prazo);
        falha(e);
      },
    );
  });
}
