import { connection } from "next/server";

// Diagnóstico: só informa se está configurado, nunca os valores.
export async function GET() {
  await connection();
  return Response.json({
    storage: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    admin: !!process.env.FIREBASE_ADMIN_CREDENTIALS,
  });
}
