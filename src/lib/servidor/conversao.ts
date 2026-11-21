import "server-only";
import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { ehMapaDeCena } from "../cena/compat";
import { LADO_MAXIMO_RENDER } from "../cena/tipos";
import {
  ErroConversao,
  LADO_TRABALHO,
  MAX_OBJETOS_CONVERSAO,
  converterMapa,
  copiarPinos,
  prepararRevisao,
  type JobConversao,
  type MapaOrigem,
  type PedidoConversao,
  type PinosDoc,
  type Revisao,
} from "../mapas-ia/conversao/conversao";
import { mascaraDoSegmento } from "../mapas-ia/conversao/mascaras";
import { obterProvedor, segmentadores, suportaInpainting } from "../mapas-ia/registro";
import { ErroProvedor, type ImagemBase64, type ProvedorImagem, type Segmentador } from "../mapas-ia/tipos";
import { adminBucket, adminDb } from "./admin";
import { urlDaMesa } from "./assets";
import { ErroHttp } from "./auth";
import { codificarJpeg, codificarPng, decodificar, decodificarArquivo, decodificarNoTamanho, paraEnvio } from "./imagem";
import { contextoDoProvedor, lerConfig, registrarUso } from "./ia";

const mesa = (mesaId: string) => adminDb().collection("mesas").doc(mesaId);
const semUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)); // Firestore não aceita `undefined`
const novoId = () => adminDb().collection("_").doc().id;

const LIMITE_DOWNLOAD = 20 * 1024 * 1024;
/** Lado maior da imagem enviada para o inpainting. */
const LADO_INPAINT = 1536;

// ---------- Mapa de origem (somente leitura) ----------

interface Origem {
  mapa: MapaOrigem & { imagem: string };
  arquivo: Buffer;
  mime: string;
}

async function carregarOrigem(mesaId: string, colecao: "mapas" | "imagens", mapaId: string): Promise<Origem> {
  const d = (await mesa(mesaId).collection(colecao).doc(mapaId).get()).data() as (MapaOrigem & { imagem: string }) | undefined;
  if (!d) throw new ErroHttp(404, "Mapa não encontrado.");
  if (ehMapaDeCena(d)) throw new ErroHttp(400, "Este mapa já é um mapa de cena.");
  const dados = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(d.imagem);
  if (dados) return { mapa: d, arquivo: Buffer.from(dados[2], "base64"), mime: dados[1] };
  // Só baixa do Storage da própria mesa (a URL vem do documento, nunca do corpo da requisição).
  if (!urlDaMesa(d.imagem, mesaId)) throw new ErroHttp(400, "A imagem do mapa não está no armazenamento desta mesa.");
  const r = await fetch(d.imagem).catch(() => null);
  if (!r?.ok) throw new ErroHttp(502, "Não foi possível baixar a imagem do mapa.");
  const arquivo = Buffer.from(await r.arrayBuffer());
  if (arquivo.length > LIMITE_DOWNLOAD) throw new ErroHttp(400, "A imagem do mapa é grande demais para converter.");
  return { mapa: d, arquivo, mime: r.headers.get("content-type") ?? "image/jpeg" };
}

/** Segmentador ativo; sem escolha, o primeiro do registro. */
async function segmentadorAtivo(uid: string): Promise<Segmentador> {
  const cfg = await lerConfig(uid);
  const p = cfg.provedorSegmentacaoAtivo ? obterProvedor(cfg.provedorSegmentacaoAtivo) : segmentadores()[0];
  if (!p || p.tipo !== "segmentacao") throw new ErroHttp(400, "Nenhum segmentador configurado.");
  return p;
}

/** Provedor de imagem ativo, se ele reconstrói o fundo; senão a conversão é parcial. */
export async function provedorInpainting(uid: string): Promise<ProvedorImagem | null> {
  const cfg = await lerConfig(uid);
  const p = cfg.provedorImagemAtivo ? obterProvedor(cfg.provedorImagemAtivo) : undefined;
  return p?.tipo === "imagem" && suportaInpainting(p) ? p : null;
}

// ---------- Segmentação (síncrona) ----------

export async function segmentarMapa(p: { mesaId: string; uid: string; colecao: "mapas" | "imagens"; mapaId: string }): Promise<Revisao> {
  const origem = await carregarOrigem(p.mesaId, p.colecao, p.mapaId);
  const seg = await segmentadorAtivo(p.uid);
  const ctx = await contextoDoProvedor(p.uid, seg);
  const trabalho = await decodificarArquivo(origem.arquivo, LADO_TRABALHO);
  const brutos = await seg.segmentar(ctx, { imagem: await paraEnvio(trabalho, LADO_TRABALHO), dica: origem.mapa.nome, maxObjetos: seg.capacidades.maxObjetos });
  await registrarUso(p.mesaId, seg.id, "segmentacao", 1);
  const comMascara = await Promise.all(
    brutos.map(async (b) => {
      let cinza;
      if (b.mascara) cinza = await decodificar(b.mascara).catch(() => undefined); // máscara ilegível: usa a caixa
      return { rotulo: b.rotulo, mascara: mascaraDoSegmento(trabalho.width, trabalho.height, b.caixa, cinza) };
    }),
  );
  return prepararRevisao(trabalho.width, trabalho.height, comMascara, novoId, MAX_OBJETOS_CONVERSAO);
}

// ---------- Job de conversão ----------

const colJobs = (mesaId: string) => mesa(mesaId).collection("jobs");

export async function criarJobConversao(mesaId: string, mapaOrigemId: string): Promise<JobConversao> {
  const agora = Date.now();
  const ref = colJobs(mesaId).doc();
  const job: JobConversao = { id: ref.id, tipo: "conversao", status: "na-fila", progresso: 0, mapaOrigemId, criadoEm: agora, atualizadoEm: agora };
  await ref.set(job);
  return job;
}

const atualizarJob = (mesaId: string, jobId: string, patch: Partial<JobConversao>) =>
  colJobs(mesaId).doc(jobId).update(semUndefined({ ...patch, atualizadoEm: Date.now() }));

async function enviarArquivo(mesaId: string, buf: Buffer, ext: "png" | "jpg", pasta: "assets" | "mapas") {
  const bucket = adminBucket();
  const caminho = `mesas/${mesaId}/${pasta}/${randomUUID()}.${ext}`;
  const token = randomUUID();
  await bucket.file(caminho).save(buf, {
    contentType: ext === "png" ? "image/png" : "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return { caminho, url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}` };
}

const extDe = (mime: string): "png" | "jpg" => (/png/.test(mime) ? "png" : "jpg");
const esperado = (e: unknown) => e instanceof ErroProvedor || e instanceof ErroHttp || e instanceof ErroConversao;
const mensagemDe = (e: unknown) => (esperado(e) ? (e as Error).message : "Erro interno ao converter o mapa.");

/** Executa a conversão (chamado depois da resposta HTTP). O mapa original só é lido. */
export async function executarJobConversao(p: { mesaId: string; uid: string; jobId: string; pedido: PedidoConversao }) {
  const { mesaId, uid, jobId, pedido } = p;
  let fila: Promise<void> = Promise.resolve();
  try {
    await atualizarJob(mesaId, jobId, { status: "gerando", progresso: 2, etapa: "preparando" });
    const origem = await carregarOrigem(mesaId, pedido.colecao, pedido.mapaId);
    const original = await decodificarArquivo(origem.arquivo, LADO_MAXIMO_RENDER);
    const prov = await provedorInpainting(uid);
    const ctx = prov ? await contextoDoProvedor(uid, prov) : null;
    const pinos = mesa(mesaId).collection("pinos");

    const resultado = await converterMapa(
      { mapa: origem.mapa, original, pedido },
      {
        editar:
          prov && ctx
            ? async (img, prompt) => {
                const editada: ImagemBase64 = await prov.editar!(ctx, { prompt, imagem: await paraEnvio(img, LADO_INPAINT) });
                return decodificarNoTamanho(editada, img.width, img.height);
              }
            : undefined,
        registrarUso: () => registrarUso(mesaId, prov!.id, "imagem", 1),
        salvarImagem: async (px, uso) =>
          uso === "fundo" ? enviarArquivo(mesaId, await codificarJpeg(px, 92), "jpg", "assets") : enviarArquivo(mesaId, await codificarPng(px), "png", "assets"),
        copiarImagemDoMapa: async () =>
          /^data:/.test(origem.mapa.imagem) ? { url: origem.mapa.imagem } : enviarArquivo(mesaId, origem.arquivo, extDe(origem.mime), "mapas"),
        apagarArquivo: async (caminho) => {
          await adminBucket().file(caminho).delete({ ignoreNotFound: true });
        },
        gravarAsset: async (a) => {
          await mesa(mesaId).collection("assets").doc(a.id).set(semUndefined(a));
        },
        apagarAsset: async (id) => {
          await mesa(mesaId).collection("assets").doc(id).delete();
        },
        gravarCena: async (c) => {
          await mesa(mesaId).collection("cenas").doc(c.id).set(semUndefined(c));
        },
        apagarCena: async (id) => {
          await mesa(mesaId).collection("cenas").doc(id).delete();
        },
        copiarPinos: async (de, para) => {
          for (const d of (await pinos.get()).docs) {
            const c = copiarPinos(d.data() as PinosDoc, de);
            if (!c) continue;
            const campos: unknown[] = [];
            if (c.pinos) campos.push(new FieldPath("porMapa", para), c.pinos);
            if (c.nota) campos.push(new FieldPath("notas", para), c.nota);
            const [primeiro, valor, ...resto] = campos;
            await d.ref.update(primeiro as FieldPath, valor, ...resto);
          }
        },
        apagarPinos: async (para) => {
          for (const d of (await pinos.get()).docs) {
            const x = d.data() as PinosDoc;
            if (x.porMapa?.[para] || x.notas?.[para])
              await d.ref.update(new FieldPath("porMapa", para), FieldValue.delete(), new FieldPath("notas", para), FieldValue.delete());
          }
        },
        gravarMapa: async (m) => {
          await mesa(mesaId).collection(pedido.colecao).doc(m.id).set(semUndefined(m));
        },
        aoProgredir: (etapa, pct) => {
          fila = fila
            .then(() => atualizarJob(mesaId, jobId, { progresso: pct, etapa }))
            .then(() => {})
            .catch(() => {});
        },
        novoId,
      },
    );
    await fila;
    await atualizarJob(mesaId, jobId, { status: "pronto", progresso: 100, etapa: "pronto", resultado });
  } catch (e) {
    if (!esperado(e)) console.error("conversão de mapa:", e);
    await fila;
    await atualizarJob(mesaId, jobId, { status: "falhou", etapa: "falhou", erro: mensagemDe(e) }).catch((x) => console.error("conversão: status", x));
  }
}
