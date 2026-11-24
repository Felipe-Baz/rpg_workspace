// Aleatoriedade criptográfica (CSPRNG do navegador/Node). Nunca usar Math.random para dados de jogo.

const MAX32 = 0x1_0000_0000;

function uint32(): number {
  const b = new Uint32Array(1);
  globalThis.crypto.getRandomValues(b);
  return b[0];
}

/** Inteiro uniforme em [1, n], sem viés de módulo (amostragem por rejeição). */
export function inteiroSeguro(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > MAX32) throw new RangeError(`inteiroSeguro: n inválido (${n})`);
  const limite = MAX32 - (MAX32 % n);
  let x = uint32();
  while (x >= limite) x = uint32();
  return (x % n) + 1;
}

/** Float em [0, 1) com 53 bits de aleatoriedade (substituto de Math.random). */
export function floatSeguro(): number {
  const b = new Uint32Array(2);
  globalThis.crypto.getRandomValues(b);
  return ((b[0] >>> 5) * 67108864 + (b[1] >>> 6)) / 9007199254740992;
}

/** Semente de 32 bits para repetir uma animação de forma idêntica em outros navegadores. */
export const sementeSegura = (): number => uint32();
