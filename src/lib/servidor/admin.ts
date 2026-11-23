import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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
