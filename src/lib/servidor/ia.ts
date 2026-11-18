import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { TETO_PADRAO, periodoDe, verificarTeto, type UsoPeriodo } from "../mapas-ia/limites";
import { PROVEDORES, obterProvedor } from "../mapas-ia/registro";
import type { ContextoProvedor, Provedor } from "../mapas-ia/tipos";
import { adminDb } from "./admin";
import { cifrar, decifrar } from "./cifra";
import { ErroHttp } from "./auth";

const docSegredo = (uid: string, cred: string) => adminDb().collection("usuarios").doc(uid).collection("segredos").doc(cred);
const docConfig = (uid: string) => adminDb().collection("usuarios").doc(uid).collection("ia").doc("config");

export interface ConfigIa {
  provedorImagemAtivo?: string;
  provedorLlmAtivo?: string;
  /** Campos não-secretos por provedor (ex.: modelo). */
  campos: Record<string, Record<string, string>>;
}

export async function lerConfig(uid: string): Promise<ConfigIa> {
  const d = (await docConfig(uid).get()).data() ?? {};
  return { provedorImagemAtivo: d.provedorImagemAtivo, provedorLlmAtivo: d.provedorLlmAtivo, campos: d.campos ?? {} };
}

export async function salvarConfig(uid: string, c: Partial<ConfigIa>) {
  const atual = await lerConfig(uid);
  if (c.provedorImagemAtivo !== undefined && obterProvedor(c.provedorImagemAtivo)?.tipo !== "imagem")
    throw new ErroHttp(400, "Provedor de imagem inválido.");
  if (c.provedorLlmAtivo !== undefined && obterProvedor(c.provedorLlmAtivo)?.tipo !== "llm")
    throw new ErroHttp(400, "Provedor de LLM inválido.");
  const campos = { ...atual.campos };
  for (const [pid, valores] of Object.entries(c.campos ?? {})) {
    const p = obterProvedor(pid);
    if (!p) throw new ErroHttp(400, `Provedor desconhecido: ${pid}.`);
    const permitidas = p.campos.filter((f) => f.tipo === "texto").map((f) => f.chave);
    const limpo: Record<string, string> = {};
    for (const k of permitidas) if (typeof valores[k] === "string") limpo[k] = valores[k].trim().slice(0, 200);
    campos[pid] = { ...campos[pid], ...limpo };
  }
  const novo: Record<string, unknown> = { campos };
  novo.provedorImagemAtivo = c.provedorImagemAtivo ?? atual.provedorImagemAtivo ?? null;
  novo.provedorLlmAtivo = c.provedorLlmAtivo ?? atual.provedorLlmAtivo ?? null;
  await docConfig(uid).set(novo);
}

const credenciaisValidas = () => new Set(PROVEDORES.map((p) => p.credencialId));

export async function salvarSegredo(uid: string, credencialId: string, chave: string) {
  if (!credenciaisValidas().has(credencialId)) throw new ErroHttp(400, "Credencial desconhecida.");
  const k = chave.trim();
  if (k.length < 8 || k.length > 500) throw new ErroHttp(400, "Chave inválida.");
  await docSegredo(uid, credencialId).set({ cifrado: cifrar(k), ultimos4: k.slice(-4), atualizadoEm: FieldValue.serverTimestamp() });
}

export async function removerSegredo(uid: string, credencialId: string) {
  if (!credenciaisValidas().has(credencialId)) throw new ErroHttp(400, "Credencial desconhecida.");
  await docSegredo(uid, credencialId).delete();
}

/** Estado mascarado: nunca devolve a chave. */
export async function estadoCredenciais(uid: string) {
  const out: Record<string, { configurada: boolean; ultimos4?: string }> = {};
  for (const cred of credenciaisValidas()) {
    const d = (await docSegredo(uid, cred).get()).data();
    out[cred] = d ? { configurada: true, ultimos4: d.ultimos4 } : { configurada: false };
  }
  return out;
}

/** Monta o contexto do provedor com a chave decifrada do usuário. Uso interno do servidor. */
export async function contextoDoProvedor(uid: string, p: Provedor): Promise<ContextoProvedor> {
  const d = (await docSegredo(uid, p.credencialId).get()).data();
  if (!d) throw new ErroHttp(400, "Chave não configurada para este provedor.");
  let apiKey: string;
  try {
    apiKey = decifrar(d.cifrado);
  } catch {
    throw new ErroHttp(500, "Não foi possível decifrar a chave salva. Reinsira a chave.");
  }
  const cfg = (await lerConfig(uid)).campos[p.id] ?? {};
  return { config: { ...cfg, apiKey }, http: (url, init) => fetch(url, init) };
}

// ----- Uso e teto por mesa -----
const refUso = (mesaId: string) => adminDb().collection("mesas").doc(mesaId).collection("uso");

export async function lerUso(mesaId: string, periodo = periodoDe()) {
  const [u, c] = await Promise.all([refUso(mesaId).doc(periodo).get(), refUso(mesaId).doc("config").get()]);
  const d = u.data();
  const uso: UsoPeriodo = { total: d?.total ?? 0, porProvedor: d?.porProvedor ?? {} };
  return { periodo, uso, teto: (c.data()?.teto as number | undefined) ?? TETO_PADRAO };
}

export async function definirTeto(mesaId: string, teto: number) {
  if (!Number.isInteger(teto) || teto < 0 || teto > 100000) throw new ErroHttp(400, "Teto inválido.");
  await refUso(mesaId).doc("config").set({ teto });
}

/** Recusa (429) se estourar o teto. */
export async function exigirTeto(mesaId: string, quantidade: number) {
  const { uso, teto } = await lerUso(mesaId);
  const d = verificarTeto(uso, teto, quantidade);
  if (!d.ok) throw new ErroHttp(429, d.motivo);
}

export async function registrarUso(mesaId: string, provedorId: string, tipo: "imagem" | "llm", quantidade = 1) {
  const periodo = periodoDe();
  await refUso(mesaId)
    .doc(periodo)
    .set({ total: FieldValue.increment(quantidade), porProvedor: { [provedorId]: FieldValue.increment(quantidade) }, [`tipo_${tipo}`]: FieldValue.increment(quantidade) }, { merge: true });
  await adminDb().collection("mesas").doc(mesaId).collection("usoRegistros").add({ provedorId, tipo, quantidade, em: FieldValue.serverTimestamp() });
}
