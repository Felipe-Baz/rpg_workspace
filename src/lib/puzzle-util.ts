import type { Mecanica, MecanicaLiberada } from "./marcas-data";

/** Minúsculas, sem acento, só [a-z0-9,:] — "Espelho da Primeira Dor!" → "espelhodaprimeiradaor". */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,:]/g, "");

// cyrb53: hash síncrono e sem dependência de contexto seguro (crypto.subtle exige https).
// Não é segurança criptográfica — só impede que a solução apareça em texto puro para o jogador.
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const selar = (valor: string, sal: string) => cyrb53(`${sal}|${normalizar(valor)}`);

/** Troca `solucao` (texto puro) por `hashes`, para o jogador poder conferir sem ver a resposta. */
export function liberarMecanica(m: Mecanica, sal: string): MecanicaLiberada {
  const { solucao, ...resto } = m;
  const out = { ...resto, sal } as MecanicaLiberada;
  if (solucao) out.hashes = solucao.split("|").map((s) => selar(s, sal));
  return out;
}

export const confere = (m: MecanicaLiberada, valor: string) =>
  !!m.sal && !!m.hashes && m.hashes.includes(selar(valor, m.sal));
