// Contrato de compatibilidade: mapa de cena é um mapa de imagem com uma cena opcional anexada.

export type MapaLike = { origem?: "imagem" | "cena"; cenaId?: string };

/** Só é "de cena" (editável) se tiver origem "cena" E a referência à cena; sem `cenaId` vira mapa de imagem. */
export const ehMapaDeCena = (m: MapaLike) => m.origem === "cena" && !!m.cenaId;

/** Patch aplicado ao salvar: SOMENTE a imagem. Zonas, coberturas, pinos e liberação nunca são tocados. */
export const patchSalvarRender = (urlRender: string) => ({ imagem: urlRender });
