/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de APIs externas */
import { ErroProvedor, type HttpFn } from "./tipos.ts";

/** Remove do texto qualquer ocorrência dos segredos informados. */
export function sanear(texto: string, segredos: string[]): string {
  let t = texto;
  for (const s of segredos) if (s && s.length >= 4) t = t.split(s).join("***");
  return t;
}

/** POST JSON; em erro lança ErroProvedor sem vazar a chave. */
export async function postarJson(
  http: HttpFn,
  url: string,
  headers: Record<string, string>,
  corpo: unknown,
  segredos: string[],
): Promise<any> {
  let r: Response;
  try {
    r = await http(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    throw new ErroProvedor(sanear(`Falha de rede: ${(e as Error).message}`, segredos));
  }
  const txt = await r.text();
  if (!r.ok) {
    let msg = txt.slice(0, 300);
    try {
      const j = JSON.parse(txt);
      msg = j?.error?.message ?? j?.error ?? msg;
    } catch {}
    throw new ErroProvedor(sanear(`Provedor respondeu ${r.status}: ${String(msg)}`, segredos));
  }
  try {
    return JSON.parse(txt);
  } catch {
    throw new ErroProvedor("Resposta inválida do provedor.");
  }
}

export function exigirCampo(config: Record<string, string>, chave: string, rotulo: string): string {
  const v = config[chave]?.trim();
  if (!v) throw new ErroProvedor(`Campo obrigatório ausente: ${rotulo}.`);
  return v;
}
