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

/** Decodifica um arquivo (respeitando a orientação EXIF) com o lado maior limitado a `ladoMax`. */
export async function decodificarArquivo(buf: Buffer, ladoMax: number): Promise<PixelsRgba> {
  const s = await sharp();
  const { data, info } = await s(buf)
    .rotate()
    .resize(ladoMax, ladoMax, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

const sharpDePixels = async (px: PixelsRgba) =>
  (await sharp())(Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength), { raw: { width: px.width, height: px.height, channels: 4 } });

export async function codificarJpeg(px: PixelsRgba, qualidade = 90): Promise<Buffer> {
  return (await sharpDePixels(px)).flatten({ background: "#000000" }).jpeg({ quality: qualidade }).toBuffer();
}

/** Versão reduzida (lado maior `ladoMax`) em JPEG para enviar a um provedor. */
export async function paraEnvio(px: PixelsRgba, ladoMax: number, qualidade = 92): Promise<ImagemBase64> {
  const jpg = await (await sharpDePixels(px)).resize(ladoMax, ladoMax, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#000000" }).jpeg({ quality: qualidade }).toBuffer();
  return { mime: "image/jpeg", base64: jpg.toString("base64") };
}

/** Decodifica e força o tamanho exato (o provedor pode devolver outra resolução). */
export async function decodificarNoTamanho(img: ImagemBase64, largura: number, altura: number): Promise<PixelsRgba> {
  const s = await sharp();
  const { data, info } = await s(Buffer.from(img.base64, "base64")).resize(largura, altura, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

/** Reduz uma referência (lado maior 768) para JPEG, limitando o peso enviado ao provedor. */
export async function prepararReferencia(buf: Buffer): Promise<ImagemBase64> {
  const s = await sharp();
  const jpg = await s(buf).rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
  return { mime: "image/jpeg", base64: jpg.toString("base64") };
}
