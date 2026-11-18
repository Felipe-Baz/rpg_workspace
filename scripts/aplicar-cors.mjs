// Aplica storage-cors.json ao bucket usando a conta de serviço do .env (sem gcloud).
// Uso: node --env-file=.env scripts/aplicar-cors.mjs
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (!process.env.FIREBASE_ADMIN_CREDENTIALS || !bucketName) throw new Error("Faltam FIREBASE_ADMIN_CREDENTIALS ou NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET no .env");

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS)), storageBucket: bucketName });
const cors = JSON.parse(readFileSync(new URL("../storage-cors.json", import.meta.url), "utf8"));
const bucket = getStorage().bucket();
await bucket.setCorsConfiguration(cors);
const [meta] = await bucket.getMetadata();
console.log(`CORS aplicado em ${bucketName}:`, JSON.stringify(meta.cors));
