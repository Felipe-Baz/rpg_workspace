import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * O `firebase-admin` (Firestore e Storage) cria o `GoogleAuth` internamente com `credentials`/`fromJSON`, e a
 * `google-auth-library` 11 avisa a cada uso que isso é obsoleto. A credencial vem do nosso ambiente (não de entrada
 * externa), e não há opção pública para silenciar: filtramos só essas duas mensagens exatas, uma vez.
 */
const AVISOS_GOOGLE_AUTH = ["The `credentials` option is deprecated.", "The `fromJSON` method is deprecated."];
const marca = Symbol.for("rpg.avisosGoogleAuthFiltrados");
const globalComMarca = globalThis as unknown as Record<symbol, boolean>;
if (!globalComMarca[marca]) {
  globalComMarca[marca] = true;
  const original = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && AVISOS_GOOGLE_AUTH.some((a) => (args[0] as string).startsWith(a))) return;
    original(...args);
  };
}

/** Há credencial admin configurada? */
export const adminConfigurado = () => !!process.env.FIREBASE_ADMIN_CREDENTIALS;

function app(): App {
  if (getApps().length) return getApp();
  const bruto = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!bruto) throw new Error("FIREBASE_ADMIN_CREDENTIALS não configurada.");
  return initializeApp({
    credential: cert(JSON.parse(bruto)),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
export const adminBucket = () => getStorage(app()).bucket();
