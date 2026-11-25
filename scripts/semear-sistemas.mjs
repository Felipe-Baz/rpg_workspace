// Cadastra/atualiza os sistemas públicos na coleção `sistemas` (o cliente não escreve nela).
//   node --env-file=.env scripts/semear-sistemas.mjs
// Mantenha a lista alinhada a SISTEMAS_PADRAO em src/lib/sistemas-padrao.ts.
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SISTEMAS = ["D&D 5e", "Tormenta20", "Pathfinder 2e", "Call of Cthulhu", "Vampiro: A Máscara"];

const bruto = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!bruto) throw new Error("Defina FIREBASE_ADMIN_CREDENTIALS.");
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(bruto)) }));

for (const nome of SISTEMAS) {
  const id = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await db.collection("sistemas").doc(id).set({ nome });
  console.log("ok:", nome);
}
