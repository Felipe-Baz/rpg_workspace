import { randomUUID } from "node:crypto";
import type { Asset, Cena } from "@/lib/cena/tipos";
import { executarAgente, type MensagemChat } from "@/lib/mapas-ia/agente/agente";
import { LIMITES_PADRAO, type EventoAgente } from "@/lib/mapas-ia/agente/tipos";
import { verificarLlm } from "@/lib/mapas-ia/orquestrador";
import { obterProvedor, provedoresLlm } from "@/lib/mapas-ia/registro";
import type { Tema } from "@/lib/mapas-ia/temas/tipos";
import { ErroProvedor } from "@/lib/mapas-ia/tipos";
import { adminDb } from "@/lib/servidor/admin";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { contextoDoProvedor, estadoCredenciais, lerConfig } from "@/lib/servidor/ia";

export const maxDuration = 300;

const MAX_OBJETOS = 20_000;

/** A cena vem do cliente (fonte da verdade é o editor); só a forma é conferida. */
function validarCena(b: unknown): Cena {
  const c = b as Cena;
  const ok =
    !!c &&
    typeof c === "object" &&
    typeof c.id === "string" &&
    (c.modo === "grid" || c.modo === "cenario") &&
    Number.isFinite(c.largura) &&
    Number.isFinite(c.altura) &&
    c.largura > 0 &&
    c.altura > 0 &&
    Array.isArray(c.camadas) &&
    c.camadas.length > 0 &&
    Array.isArray(c.objetos) &&
    c.objetos.length <= MAX_OBJETOS;
  if (!ok) throw new ErroHttp(400, "Cena inválida.");
  return c;
}

function validarConversa(b: unknown): MensagemChat[] {
  if (!Array.isArray(b)) return [];
  return b
    .filter((m) => m && (m.papel === "usuario" || m.papel === "assistente") && typeof m.texto === "string" && m.texto.trim())
    .slice(-12)
    .map((m) => ({ papel: m.papel, texto: String(m.texto).slice(0, 4000) }));
}

// Corpo: { mesaId, pedido, cena, selecao?: string[], conversa?: [{ papel, texto }] }
// Resposta: NDJSON em streaming (uma linha por EventoAgente; a última é "fim" ou "erro").
// Nada é aplicado nem salvo aqui: o cliente aplica os comandos. Usa a chave do mestre dono da mesa.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    const { uid } = await exigirMestre(req, mesaId);

    const pedido = typeof b.pedido === "string" ? b.pedido.trim().slice(0, 4000) : "";
    if (!pedido) throw new ErroHttp(400, "Escreva o que deseja.");
    const cena = validarCena(b.cena);
    const selecao = (Array.isArray(b.selecao) ? b.selecao : []).filter((x: unknown): x is string => typeof x === "string").slice(0, 500);

    const cfg = await lerConfig(uid);
    let p = cfg.provedorLlmAtivo ? obterProvedor(cfg.provedorLlmAtivo) : undefined;
    if (!p) {
      const cred = await estadoCredenciais(uid);
      p = provedoresLlm().find((x) => cred[x.credencialId]?.configurada && x.capacidades.ferramentas);
    }
    if (!p || p.tipo !== "llm") throw new ErroHttp(400, "Nenhum LLM ativo ou com chave salva. Configure na tela de IA.");
    const v = verificarLlm(p.capacidades, "agente");
    if (!v.ok) throw new ErroHttp(400, `${v.aviso} ${v.alternativa}`);
    const llm = p;
    const ctx = await contextoDoProvedor(uid, llm);

    // Assets e tema sempre da própria mesa (nunca do corpo da requisição).
    const mesa = adminDb().collection("mesas").doc(mesaId);
    const [snapAssets, snapTema] = await Promise.all([
      mesa.collection("assets").get(),
      cena.temaId ? mesa.collection("temas").doc(cena.temaId).get() : Promise.resolve(null),
    ]);
    const assets = snapAssets.docs.map((d) => d.data() as Asset);
    const tema = snapTema?.exists ? (snapTema.data() as Tema) : undefined;

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enviar = (ev: EventoAgente) => {
          if (!req.signal.aborted) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
        };
        try {
          const plano = await executarAgente(
            { llm, ctx, novoId: randomUUID, emitir: enviar, limites: { ...LIMITES_PADRAO, tempoMaxMs: (maxDuration - 30) * 1000 } },
            { pedido, conversa: validarConversa(b.conversa), cena, assets, tema, selecao },
          );
          enviar({ tipo: "fim", plano });
        } catch (e) {
          if (!(e instanceof ErroProvedor)) console.error("agente:", e);
          enviar({ tipo: "erro", erro: e instanceof ErroProvedor ? e.message : "Erro interno do agente." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return respostaErro(e);
  }
}
