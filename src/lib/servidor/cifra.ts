import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Chave mestra: IA_CHAVE_MESTRA (32 bytes em base64). Gere com:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Formato: base64(iv[12] | tag[16] | texto cifrado).

function chaveMestra(): Buffer {
  const b = process.env.IA_CHAVE_MESTRA;
  if (!b) throw new Error("IA_CHAVE_MESTRA não configurada.");
  const k = Buffer.from(b, "base64");
  if (k.length !== 32) throw new Error("IA_CHAVE_MESTRA deve ter 32 bytes em base64.");
  return k;
}

export function cifrar(texto: string, chave: Buffer = chaveMestra()): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave, iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decifrar(dado: string, chave: Buffer = chaveMestra()): string {
  const buf = Buffer.from(dado, "base64");
  const d = createDecipheriv("aes-256-gcm", chave, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}
