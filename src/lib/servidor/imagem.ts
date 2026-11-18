import "server-only";
import type { PixelsRgba } from "../mapas-ia/fundo";
import type { ImagemBase64 } from "../mapas-ia/tipos";

// Codificação/decodificação de imagens no servidor (sharp). A lógica de pixels fica em mapas-ia/assets.

const sharp = async () => (await import("sharp")).default;

export async function decodificar(img: ImagemBase64): Promise<PixelsRgba> {
  const s = await sharp();
  const { data, info } = await s(Buffer.from(img.base64, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

export async function codificarPng(px: PixelsRgba): Promise<Buffer> {
  const s = await sharp();
  return s(Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength), { raw: { width: px.width, height: px.height, channels: 4 } })
    .png()
    .toBuffer();
}

/** Reduz uma referência (lado maior 768) para JPEG, limitando o peso enviado ao provedor. */
export async function prepararReferencia(buf: Buffer): Promise<ImagemBase64> {
  const s = await sharp();
  const jpg = await s(buf).rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
  return { mime: "image/jpeg", base64: jpg.toString("base64") };
}
