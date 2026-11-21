import "server-only";
import { randomUUID } from "node:crypto";
import { escolherCorChaveParaAsset, type CorChave } from "../mapas-ia/corChave";
import { planejarGeracao } from "../mapas-ia/orquestrador";
import { obterPerspectiva } from "../mapas-ia/perspectivas/registro";
import { obterProvedor } from "../mapas-ia/registro";
import { executarPipeline, planejarVariacoes, removerFundoNecessario, type Etapa } from "../mapas-ia/assets/pipeline";
import { comporPrompt, precisaAlfa } from "../mapas-ia/assets/prompt";
import type { Job, PedidoAsset } from "../mapas-ia/assets/jobs";
import type { PerfilEstilo, Tema } from "../mapas-ia/temas/tipos";
import { ErroProvedor, type ImagemBase64, type ProvedorImagem } from "../mapas-ia/tipos";
import type { Asset } from "../cena/tipos";
import { paraPublico } from "../mapas-ia/assets/biblioteca";
import { adminBucket, adminDb } from "./admin";
import { ErroHttp } from "./auth";
import { codificarPng, decodificar, prepararReferencia } from "./imagem";
import { contextoDoProvedor, lerConfig, registrarUso } from "./ia";

const colJobs = (mesaId: string) => adminDb().collection("mesas").doc(mesaId).collection("jobs");
const colPublicos = () => adminDb().collection("assetsPublicos");
const colAssets = (mesaId: string) => adminDb().collection("mesas").doc(mesaId).collection("assets");

const MAX_ANCORAS = 3;
const LIMITE_DOWNLOAD = 8 * 1024 * 1024;

const semUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore não aceita `undefined`

export async function criarJob(mesaId: string, pedido: PedidoAsset): Promise<Job> {
  const agora = Date.now();
  const ref = colJobs(mesaId).doc();
  const job: Job = semUndefined({ id: ref.id, status: "na-fila", progresso: 0, pedido, criadoEm: agora, atualizadoEm: agora });
  await ref.set(job);
  return job;
}

async function atualizarJob(mesaId: string, jobId: string, patch: Partial<Job>) {
  await colJobs(mesaId).doc(jobId).update(semUndefined({ ...patch, atualizadoEm: Date.now() }));
}

/** Só baixa do Storage da própria mesa (as URLs vêm de documentos do Firestore, nunca do corpo da requisição). */
export const urlDaMesa = (url: string, mesaId: string) => {
  try {
    const u = new URL(url);
    const okHost = u.protocol === "https:" && (u.hostname === "firebasestorage.googleapis.com" || u.hostname.endsWith(".storage.googleapis.com"));
    return okHost && decodeURIComponent(u.pathname).includes(`/mesas/${mesaId}/`);
  } catch {
    return false;
  }
};

async function baixarReferencia(url: string, mesaId: string): Promise<ImagemBase64 | null> {
  if (!urlDaMesa(url, mesaId)) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > LIMITE_DOWNLOAD) return null;
    return await prepararReferencia(buf);
  } catch {
    return null;
  }
}

/**
 * Assets de IA ficam em publico/assets (legíveis por qualquer usuário logado); o mesmo arquivo serve à mesa e à
 * biblioteca pública. Com `mesaPrivada`, o arquivo fica só na pasta da mesa (derivados de arte do mestre).
 */
async function enviarPng(png: Buffer, mesaPrivada?: string): Promise<{ url: string; caminho: string }> {
  const bucket = adminBucket();
  const caminho = mesaPrivada ? `mesas/${mesaPrivada}/assets/${randomUUID()}.png` : `publico/assets/${randomUUID()}.png`;
  const token = randomUUID();
  await bucket.file(caminho).save(png, { contentType: "image/png", metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  return { caminho, url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}` };
}

const ehErroConteudo = (e: unknown) => e instanceof Error && /conteúdo visível/.test(e.message);
/** Mensagem segura para o mestre: erros de provedor já vêm saneados; o resto vira texto genérico. */
const mensagemDe = (e: unknown) => (e instanceof ErroProvedor || e instanceof ErroHttp || ehErroConteudo(e) ? (e as Error).message : "Erro interno ao gerar o asset.");
const esperado = (e: unknown) => e instanceof ErroProvedor || e instanceof ErroHttp || ehErroConteudo(e);

/**
 * Executa o job (chamado depois da resposta HTTP). Cada imagem concluída é salva e contabilizada na hora;
 * falhas não entram no contador de uso.
 */
export async function executarJobAsset(p: { mesaId: string; uid: string; jobId: string; pedido: PedidoAsset }) {
  const { mesaId, uid, jobId } = p;
  let pedido = p.pedido;
  const assetIds: string[] = [];
  let erro: string | undefined;
  // Atualizações de progresso em série: nenhuma pode chegar depois do status final.
  let fila: Promise<void> = Promise.resolve();
  try {
    await atualizarJob(mesaId, jobId, { status: "gerando", progresso: 3, etapa: "preparando" });
    const cfg = await lerConfig(uid);
    const prov = cfg.provedorImagemAtivo ? obterProvedor(cfg.provedorImagemAtivo) : undefined;
    if (!prov || prov.tipo !== "imagem") throw new ErroHttp(400, "Nenhum provedor de imagem ativo configurado.");
    const provedor: ProvedorImagem = prov;
    const ctx = await contextoDoProvedor(uid, provedor);
    const cap = provedor.capacidades;

    // Regeneração: herda as características do asset base e parte da imagem dele.
    let base: Asset | undefined;
    let imagemBase: ImagemBase64 | null = null;
    if (pedido.baseAssetId) {
      const d = await colAssets(mesaId).doc(pedido.baseAssetId).get();
      if (!d.exists) throw new ErroHttp(404, "O asset a regenerar não existe mais.");
      base = d.data() as Asset;
      pedido = { ...pedido, tipo: base.tipo ?? "sprite", tags: base.tags ?? pedido.tags, temaId: base.temaId, perspectivaId: base.perspectivaId, escalaBase: base.escalaBase ?? 1 };
      imagemBase = await baixarReferencia(base.url, mesaId);
    }

    let perfil: PerfilEstilo | undefined;
    let ancoras: ImagemBase64[] = [];
    if (pedido.temaId) {
      const t = (await adminDb().collection("mesas").doc(mesaId).collection("temas").doc(pedido.temaId).get()).data() as Tema | undefined;
      if (t) {
        perfil = t;
        ancoras = (await Promise.all((t.ancoras ?? []).slice(0, MAX_ANCORAS).map((u) => baixarReferencia(u, mesaId)))).filter((x): x is ImagemBase64 => !!x);
      }
    }
    const plano = planejarGeracao(cap, { precisaAlfa: precisaAlfa(pedido.tipo), referencias: ancoras });
    const perspectiva = obterPerspectiva(pedido.perspectivaId);

    // Cor-chave: com o LLM ativo (se houver) ou por heurística; nunca bloqueia a geração.
    let corChave: CorChave | undefined;
    if (removerFundoNecessario(cap, pedido.tipo)) {
      let llm: Parameters<typeof escolherCorChaveParaAsset>[1];
      const llmProv = cfg.provedorLlmAtivo ? obterProvedor(cfg.provedorLlmAtivo) : undefined;
      if (llmProv?.tipo === "llm") {
        try {
          llm = { provedor: llmProv, ctx: await contextoDoProvedor(uid, llmProv) };
        } catch {
          llm = undefined;
        }
      }
      corChave = (await escolherCorChaveParaAsset(pedido.descricao, llm)).chave;
    }

    // Nova versão de um objeto recortado do mapa do mestre: continua privada da mesa.
    const privado = !!base?.convertidoDe;
    const n = pedido.quantidade;
    const variacoes: { seed?: number; instrucao?: string }[] = n > 1 ? planejarVariacoes(cap, n) : [{}];
    const modelo = ctx.config.modelo?.trim() || provedor.campos.find((c) => c.chave === "modelo")?.padrao || "";

    for (let i = 0; i < variacoes.length; i++) {
      const v = variacoes[i];
      const instrucao = [pedido.instrucao, v.instrucao].filter(Boolean).join("; ") || undefined;
      const prompt = comporPrompt({
        tipo: pedido.tipo,
        descricao: pedido.descricao,
        tema: perfil,
        perspectiva,
        corChave,
        instrucao,
        comReferencias: plano.referencias.length > 0 || !!imagemBase,
      });
      const progresso = (etapa: Etapa, pct: number) => {
        fila = fila.then(() => atualizarJob(mesaId, jobId, { progresso: Math.round(((i + pct / 100) / variacoes.length) * 95), etapa })).catch(() => {});
      };
      try {
        const r = await executarPipeline(
          { tipo: pedido.tipo, capacidades: cap },
          {
            gerar: () =>
              imagemBase && provedor.editar
                ? provedor.editar(ctx, { prompt, referencias: plano.referencias, seed: v.seed, imagem: imagemBase })
                : provedor.gerar(ctx, { prompt, referencias: imagemBase ? [imagemBase, ...plano.referencias] : plano.referencias, seed: v.seed }),
            decodificar,
            codificar: async (px) => ({ mime: "image/png", base64: (await codificarPng(px)).toString("base64") }),
            aoProgredir: progresso,
          },
        );
        const { url, caminho } = await enviarPng(Buffer.from(r.png.base64, "base64"), privado ? mesaId : undefined);
        const ref = colAssets(mesaId).doc();
        const asset: Asset = semUndefined({
          id: ref.id,
          nome: base ? `${base.nome} (nova versão)` : n > 1 ? `${pedido.nome} ${i + 1}` : pedido.nome,
          url,
          largura: r.largura,
          altura: r.altura,
          origem: "ia" as const,
          publico: !privado,
          convertidoDe: base?.convertidoDe,
          tipo: pedido.tipo,
          tags: pedido.tags,
          perspectivaId: pedido.perspectivaId,
          temaId: pedido.temaId,
          escalaBase: pedido.escalaBase,
          versaoDeId: base?.id,
          naoRepetivel: r.naoRepetivel || undefined,
          geradoPor: { provedor: provedor.id, modelo, prompt },
          criadoEm: Date.now(),
        });
        try {
          await ref.set(asset); // da mesa (completo, com prompt e tema)
          if (!privado) await colPublicos().doc(asset.id).set(semUndefined(paraPublico(asset))); // pública (sem dados privados)
        } catch (e) {
          await ref.delete().catch(() => {});
          await adminBucket().file(caminho).delete().catch(() => {});
          throw e;
        }
        assetIds.push(asset.id);
        await registrarUso(mesaId, provedor.id, "imagem", 1); // só depois do sucesso
      } catch (e) {
        erro = mensagemDe(e);
        if (!esperado(e)) console.error("job de asset:", e);
        break;
      }
    }
  } catch (e) {
    erro = mensagemDe(e);
    if (!esperado(e)) console.error("job de asset:", e);
  }
  try {
    await fila;
    if (assetIds.length > 0) {
      const parcial = erro ? `${assetIds.length} de ${pedido.quantidade} gerados. ${erro}` : undefined;
      await atualizarJob(mesaId, jobId, { status: "pronto", progresso: 100, etapa: "pronto", resultado: { assetIds }, erro: parcial });
    } else {
      await atualizarJob(mesaId, jobId, { status: "falhou", etapa: "falhou", erro: erro ?? "A geração falhou." });
    }
  } catch (e) {
    console.error("job de asset: não foi possível atualizar o status", e);
  }
}
