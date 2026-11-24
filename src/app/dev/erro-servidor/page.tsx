import { connection } from "next/server";

export const instant = false;

export default async function Page() {
  // Força renderização por requisição: o erro de teste não pode ser lançado na pré-renderização do build.
  await connection();
  throw new Error("Erro de teste (servidor)");
}
