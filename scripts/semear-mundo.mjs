// Grava o conteúdo do Mundo de uma mesa (mesas/{id}/mundo/principal) a partir de um JSON.
//   node --env-file=.env scripts/semear-mundo.mjs [mesaId] [arquivo.json] [--forcar]
// Padrão: mesa 5010347d-14e3-49e2-adb9-eb3bc0952013 com jsons/mundo-valgreth.json (Valgreth).
// Sem --forcar, não sobrescreve um Mundo que o mestre já tenha cadastrado.
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const forcar = args.includes("--forcar");
const [mesaId = "5010347d-14e3-49e2-adb9-eb3bc0952013", arquivo = "jsons/mundo-valgreth.json"] = args.filter((a) => !a.startsWith("--"));

const bruto = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!bruto) throw new Error("Defina FIREBASE_ADMIN_CREDENTIALS.");
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(bruto)) }));

const mundo = JSON.parse(readFileSync(arquivo, "utf8"));
if (!mundo.titulo || !Array.isArray(mundo.secoes)) throw new Error("JSON inválido: faltam titulo/secoes.");

const mesa = await db.collection("mesas").doc(mesaId).get();
if (!mesa.exists) throw new Error(`Mesa não encontrada: ${mesaId}`);

const ref = db.collection("mesas").doc(mesaId).collection("mundo").doc("principal");
if ((await ref.get()).exists && !forcar) {
  console.log("Já existe um Mundo nessa mesa; use --forcar para sobrescrever.");
} else {
  // Guardado como texto JSON: o Firestore não aceita listas dentro de listas (tabelas).
  await ref.set({ json: JSON.stringify(mundo), atualizadoEm: Date.now() });
  console.log(`ok: "${mundo.titulo}" (${mundo.secoes.length} seções) → mesas/${mesaId}/mundo/principal`);
}
