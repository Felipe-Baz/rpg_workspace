import { obterProvedor, provedoresLlm } from "@/lib/mapas-ia/registro";
import { ErroProvedor, type ImagemBase64 } from "@/lib/mapas-ia/tipos";
import { MAX_REFERENCIAS_ANALISE, interpretarPerfil, montarPedidoAnalise } from "@/lib/mapas-ia/temas/analise";
import { ErroHttp, exigirMestre, respostaErro } from "@/lib/servidor/auth";
import { contextoDoProvedor, estadoCredenciais, lerConfig } from "@/lib/servidor/ia";

const ehImagem = (r: unknown): r is ImagemBase64 =>
  !!r && typeof (r as ImagemBase64).base64 === "string" && /^image\/(jpeg|png|webp)$/.test(String((r as ImagemBase64).mime));

// Corpo: { mesaId, texto?, referencias: [{ mime, base64 }] } (imagens já reduzidas no cliente).
// Devolve um perfil PROPOSTO; nada é salvo aqui. Usa a chave do mestre dono da mesa.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const mesaId = String(b.mesaId ?? "");
    if (!mesaId) throw new ErroHttp(400, "mesaId ausente.");
    const { uid } = await exigirMestre(req, mesaId);

    const refs: ImagemBase64[] = (Array.isArray(b.referencias) ? b.referencias : []).filter(ehImagem).slice(0, MAX_REFERENCIAS_ANALISE);
    const texto = typeof b.texto === "string" ? b.texto.slice(0, 4000) : "";
    if (refs.length === 0 && !texto.trim()) throw new ErroHttp(400, "Envie ao menos uma referência ou um texto.");

    const cfg = await lerConfig(uid);
    let p = cfg.provedorLlmAtivo ? obterProvedor(cfg.provedorLlmAtivo) : undefined;
    if (!p) {
      // Sem LLM "ativo": usa o primeiro (com visão, se houver imagens) cuja chave já foi salva.
      const cred = await estadoCredenciais(uid);
      p = provedoresLlm().find((x) => cred[x.credencialId]?.configurada && (refs.length === 0 || x.capacidades.visao));
    }
    if (!p || p.tipo !== "llm") throw new ErroHttp(400, "Nenhum provedor de LLM ativo ou com chave salva (na tela IA, use Salvar e ativar). Você pode preencher o perfil manualmente.");
    if (refs.length > 0 && !p.capacidades.visao)
      throw new ErroHttp(400, "O LLM ativo não aceita imagens. Escolha um com visão ou preencha o perfil manualmente.");

    const ctx = await contextoDoProvedor(uid, p);
    try {
      const r = await p.conversar(ctx, montarPedidoAnalise(texto, refs));
      return Response.json({ perfil: interpretarPerfil(r.texto), provedor: p.id });
    } catch (e) {
      if (e instanceof ErroProvedor || (e instanceof Error && /perfil válido/.test(e.message)))
        return Response.json({ erro: (e as Error).message }, { status: 502 });
      throw e;
    }
  } catch (e) {
    return respostaErro(e);
  }
}
