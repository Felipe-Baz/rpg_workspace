"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Code2, Eye, LayoutTemplate, Loader2, Save, Send, Sparkles, Undo2, Upload, WandSparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { criarBroker, type FonteDados, type RegistroChamada } from "@/lib/extensoes/broker";
import { PERMISSAO_IDS, PERMISSOES, textoConsentimento, type Permissao } from "@/lib/extensoes/capacidades";
import { MAX_TITULO } from "@/lib/extensoes/documento";
import { publicarNaMesa, salvarNaBiblioteca, useBiblioteca, useExtensoesMesa, type ExtensaoBiblioteca } from "@/lib/extensoes/dados";
import { ALTURA_PADRAO, SLOTS, SLOTS_INLINE, SLOT_IDS, alternarEncaixe, normalizarManifesto, type Manifesto } from "@/lib/extensoes/manifesto";
import type { MensagemChat } from "@/lib/extensoes/prompt";
import { chamarIa } from "@/lib/ia-cliente";
import { uid as novoId } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import { confirmar } from "../ui/Dialogos";
import { ListaSkeleton } from "../ui/Skeleton";
import { toast } from "../ui/Toasts";
import Sandbox from "./Sandbox";

const agora = () => Date.now();

const SUGESTOES = [
  "Um gerador de tesouro aleatório para D&D 5e, com tabelas por nível de desafio",
  "Um rastreador de PV e condições dos NPCs da cena, que guarde o estado",
  "Uma tabela de rumores da taverna que eu possa rolar e marcar como verdadeiros ou falsos",
  "Um gerador de nomes de personagens por cultura",
];

type Resposta = { explicacao: string; html: string | null; manifesto: Manifesto | null };

// Tela dedicada (chat + prévia ao vivo). Rascunho local até "Salvar" ou "Publicar na mesa".
export default function CriadorExtensao() {
  const { user } = useAuth();
  const { extId } = useParams<{ extId?: string }>();
  const { extensoes, carregado } = useBiblioteca(user?.uid ?? "");
  if (extId && !carregado) return <div className="p-8"><ListaSkeleton linhas={2} /></div>;
  return <Editor key={extId ?? "nova"} extId={extId} inicial={extId ? extensoes.find((e) => e.id === extId) : undefined} />;
}

function Editor({ extId, inicial: existente }: { extId?: string; inicial?: ExtensaoBiblioteca }) {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const router = useRouter();
  const base = `/mesas/${mesa.id}`;
  const { extensoes: naMesa } = useExtensoesMesa(mesa.id, true);

  const [id] = useState(() => extId ?? novoId());
  const instalada = naMesa.find((e) => e.id === id);

  const [titulo, setTitulo] = useState(existente?.titulo ?? "");
  const [mensagens, setMensagens] = useState<MensagemChat[]>(existente?.conversa ?? []);
  const [html, setHtml] = useState<string | null>(existente?.html ?? null);
  const [versoes, setVersoes] = useState<string[]>([]); // histórico para desfazer
  const [salvoHtml, setSalvoHtml] = useState<string | null>(existente?.html ?? null);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"previa" | "codigo" | "encaixes">("previa");
  const [manifesto, setManifesto] = useState<Manifesto>(() => normalizarManifesto(existente?.manifesto));
  const [comoJogador, setComoJogador] = useState(false);
  const [fonte, setFonte] = useState<FonteDados>("real"); // modo ensaio: dados reais da mesa ou de exemplo
  const [chamadas, setChamadas] = useState<RegistroChamada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, pensando]);

  async function enviar(t = texto) {
    const pedido = t.trim();
    if (!pedido || pensando) return;
    const historico: MensagemChat[] = [...mensagens, { papel: "usuario", texto: pedido }];
    setMensagens(historico);
    setTexto("");
    setErro("");
    setPensando(true);
    try {
      const r = await chamarIa<Resposta>("extensao", { corpo: { mesaId: mesa.id, mensagens: historico, htmlAtual: html } });
      setMensagens([...historico, { papel: "assistente", texto: r.explicacao || "Pronto, atualizei a extensão." }]);
      if (r.html) {
        if (html) setVersoes((v) => [...v.slice(-9), html]);
        setHtml(r.html);
        if (r.manifesto) setManifesto(r.manifesto);
        setAba("previa");
        if (!titulo.trim()) setTitulo(historico[0].texto.replace(/\s+/g, " ").slice(0, 40).replace(/[.,;:]+$/, ""));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível falar com a IA.");
    } finally {
      setPensando(false);
    }
  }

  function desfazer() {
    const v = versoes[versoes.length - 1];
    if (!v) return;
    setVersoes((x) => x.slice(0, -1));
    setHtml(v);
    setMensagens((m) => [...m, { papel: "assistente", texto: "Voltei para a versão anterior." }]);
  }

  async function guardar(): Promise<boolean> {
    if (!html || !user) return false;
    await salvarNaBiblioteca(user.uid, {
      id,
      donoUid: user.uid,
      titulo: titulo || "Extensão sem nome",
      descricao: "",
      html,
      manifesto,
      conversa: mensagens.slice(-20).map((m) => ({ ...m, texto: m.texto.slice(0, 1500) })),
      criadoEm: existente?.criadoEm ?? agora(),
      arquivada: existente?.arquivada ?? false,
    });
    setSalvoHtml(html);
    return true;
  }

  async function acao(publicar: boolean) {
    // O mestre aprova o que a extensão pode ler; vale o que ele aprovar aqui, não o que a IA declarou.
    const pedidas: Permissao[] = manifesto.permissoes;
    const jaAprovadas = instalada?.permissoesAprovadas ?? [];
    if (publicar && pedidas.some((p) => !jaAprovadas.includes(p))) {
      const ok = await confirmar({ titulo: "Aprovar permissões", texto: textoConsentimento(pedidas, instalada?.visivelJogadores ?? false), confirmar: "Aprovar e publicar" });
      if (!ok) return;
    }
    setOcupado(true);
    try {
      await guardar();
      if (publicar) {
        await publicarNaMesa(mesa.id, { id, titulo: titulo || "Extensão sem nome", html: html!, manifesto, permissoesAprovadas: pedidas }, instalada);
        toast(instalada ? "Extensão atualizada na mesa" : "Extensão publicada na mesa");
        router.push(`${base}/extensoes/${id}`);
      } else {
        toast("Salva na sua biblioteca");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar.", "erro");
    } finally {
      setOcupado(false);
    }
  }

  async function voltar() {
    if (html && html !== salvoHtml && !(await confirmar({ titulo: "Sair sem salvar", texto: "Há alterações que não foram salvas na sua biblioteca. Sair mesmo assim?", confirmar: "Sair" }))) return;
    router.push(`${base}/extensoes`);
  }

  // Prévia: a extensão recebe as permissões que PEDE (simuladas); o registro mostra o que ela leu.
  const aoPedidoPrevia = useMemo(
    () => criarBroker({ mesa, papel: comoJogador ? "jogador" : "mestre", uid: user?.uid ?? "", aprovadas: manifesto.permissoes, fonte, aoRegistrar: (r) => setChamadas((l) => [...l.slice(-19), r]) }),
    [mesa, comoJogador, user?.uid, manifesto.permissoes, fonte, setChamadas],
  );

  const atualizada = !!instalada && !!html && (instalada.html !== html || JSON.stringify(normalizarManifesto(instalada.manifesto)) !== JSON.stringify(manifesto));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <button onClick={voltar} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft size={16} /> Extensões</button>
        <span className="rounded border border-ext/40 px-1.5 text-[10px] text-ext">Extensão</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value.slice(0, MAX_TITULO))} placeholder="Nome da extensão" aria-label="Nome da extensão" className="min-w-0 flex-1 bg-transparent font-display text-lg outline-none placeholder:text-muted" />
        <div className="flex gap-2">
          <button disabled={!html || ocupado} onClick={() => acao(false)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent-hover disabled:opacity-50"><Save size={15} /> Salvar</button>
          <button disabled={!html || ocupado} onClick={() => acao(true)} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50">
            <Upload size={15} /> {instalada ? (atualizada ? "Atualizar na mesa" : "Republicar") : "Publicar na mesa"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[26rem_1fr]">
        {/* Conversa */}
        <section className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {mensagens.length === 0 && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 font-display text-lg"><WandSparkles size={18} className="text-gold" /> O que você quer criar?</p>
                <p className="text-sm text-muted">Descreva a ferramenta como se explicasse a um colega. A IA pergunta o que faltar e monta a extensão ao lado, já utilizável.</p>
                <ul className="space-y-2">
                  {SUGESTOES.map((s) => (
                    <li key={s}><button onClick={() => enviar(s)} className="elevar w-full rounded-xl border border-border bg-card p-3 text-left text-sm">{s}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {mensagens.map((m, i) => (
              <div key={i} className={`anim-surgir max-w-[92%] rounded-2xl px-4 py-2.5 text-sm ${m.papel === "usuario" ? "ml-auto rounded-br-sm bg-accent/20" : "rounded-bl-sm bg-card-2"}`}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
              </div>
            ))}
            {pensando && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Construindo…</p>}
            {erro && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{erro} {erro.includes("provedor") && <Link href="/configuracoes/ia" className="underline">Configurar IA</Link>}</p>}
            <div ref={fim} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              rows={2}
              placeholder={html ? "Peça uma mudança: “adicione uma coluna de peso”…" : "Descreva a extensão…"}
              aria-label="Mensagem para a IA"
              className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <button disabled={pensando || !texto.trim()} aria-label="Enviar" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-strong disabled:opacity-50"><Send size={16} /></button>
          </form>
        </section>

        {/* Prévia ao vivo */}
        <section className="flex min-h-[24rem] min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
            <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist">
              {([["previa", "Prévia", Eye], ["codigo", "Código", Code2], ["encaixes", "Onde aparece", LayoutTemplate]] as const).map(([id_, rot, I]) => (
                <button key={id_} role="tab" aria-selected={aba === id_} onClick={() => setAba(id_)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 ${aba === id_ ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}><I size={14} /> {rot}</button>
              ))}
            </div>
            <label className="ml-2 inline-flex items-center gap-2 text-muted"><input type="checkbox" checked={comoJogador} onChange={(e) => setComoJogador(e.target.checked)} /> ver como jogador</label>
            {manifesto.permissoes.length > 0 && (
              <label className="ml-2 inline-flex items-center gap-2 text-muted">
                Dados
                <select value={fonte} onChange={(e) => { setFonte(e.target.value as FonteDados); setChamadas([]); }} aria-label="Fonte dos dados na prévia" className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
                  <option value="real">da mesa (reais)</option>
                  <option value="exemplo">de exemplo</option>
                </select>
              </label>
            )}
            <button disabled={versoes.length === 0} onClick={desfazer} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-muted hover:text-foreground disabled:opacity-40"><Undo2 size={14} /> Desfazer</button>
          </div>
          <div className="min-h-0 flex-1 p-3">
            {!html ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center text-muted">
                <Sparkles size={28} className="text-gold" style={{ animation: "flutuar 5s ease-in-out infinite" }} />
                <p className="max-w-xs text-sm">A extensão aparece aqui, já funcionando, assim que a IA terminar o primeiro rascunho.</p>
              </div>
            ) : aba === "encaixes" ? (
              <PainelEncaixes manifesto={manifesto} onChange={setManifesto} />
            ) : aba === "previa" ? (
              <div className="flex h-full flex-col gap-2">
                <div className="min-h-0 flex-1">
                  <Sandbox key={fonte} html={html} somenteLeitura={comoJogador} aoPedido={aoPedidoPrevia} permissoes={manifesto.permissoes} titulo={titulo || "Prévia da extensão"} />
                </div>
                {manifesto.permissoes.length > 0 && <RegistroChamadas permissoes={manifesto.permissoes} chamadas={chamadas} fonte={fonte} />}
              </div>
            ) : (
              <pre className="h-full overflow-auto rounded-xl border border-border bg-card p-4 text-xs"><code>{html}</code></pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Edita o manifesto: em quais telas do app a extensão aparece (a IA propõe, o mestre ajusta).
function PainelEncaixes({ manifesto, onChange }: { manifesto: Manifesto; onChange: (m: Manifesto) => void }) {
  const atualizar = (slot: (typeof SLOT_IDS)[number], patch: { rotulo?: string; altura?: number }) =>
    onChange({ ...manifesto, encaixes: manifesto.encaixes.map((e) => (e.slot === slot ? { ...e, ...patch } : e)) });

  return (
    <div className="h-full overflow-y-auto rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-lg">Onde esta extensão aparece</h3>
      <p className="mb-4 text-sm text-muted">Marque as telas em que ela deve aparecer nesta mesa. A IA sugere; você decide. Vale ao publicar ou atualizar.</p>
      <ul className="space-y-3">
        {SLOT_IDS.map((slot) => {
          const enc = manifesto.encaixes.find((e) => e.slot === slot);
          return (
            <li key={slot} className={`rounded-xl border p-3 ${enc ? "border-accent/50 bg-accent/5" : "border-border"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={!!enc} onChange={(e) => onChange(alternarEncaixe(manifesto, slot, e.target.checked))} className="mt-1" />
                <span>
                  <span className="block font-medium">{SLOTS[slot].rotulo}</span>
                  <span className="block text-sm text-muted">{SLOTS[slot].descricao}</span>
                </span>
              </label>
              {enc && (
                <div className="mt-3 flex flex-wrap items-center gap-3 pl-7 text-sm">
                  <label className="flex items-center gap-2">Nome <input value={enc.rotulo} onChange={(e) => atualizar(slot, { rotulo: e.target.value })} placeholder="(título da extensão)" maxLength={40} className="w-48 rounded-lg border border-border bg-background px-2 py-1" /></label>
                  {SLOTS_INLINE.includes(slot) && (
                    <label className="flex items-center gap-2">Altura <input type="number" min={160} max={900} step={20} value={enc.altura || ALTURA_PADRAO} onChange={(e) => atualizar(slot, { altura: Number(e.target.value) || ALTURA_PADRAO })} className="w-24 rounded-lg border border-border bg-background px-2 py-1" /> px</label>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <h3 className="mt-8 font-display text-lg">O que ela pode ler</h3>
      <p className="mb-4 text-sm text-muted">Dados da mesa que a extensão consulta. Ao publicar, você revisa e aprova; sem aprovação ela não lê nada. Esta versão só lê dados, não altera nada.</p>
      <ul className="space-y-2">
        {PERMISSAO_IDS.map((p) => {
          const ligada = manifesto.permissoes.includes(p);
          return (
            <li key={p} className={`rounded-xl border p-3 ${ligada ? "border-accent/50 bg-accent/5" : "border-border"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={ligada} onChange={(e) => onChange({ ...manifesto, permissoes: PERMISSAO_IDS.filter((x) => (x === p ? e.target.checked : manifesto.permissoes.includes(x))) })} className="mt-1" />
                <span>
                  <span className="block font-medium">{PERMISSOES[p].rotulo} {PERMISSOES[p].sensivel && <span className="ml-1 rounded border border-warn/50 px-1.5 text-[10px] font-normal text-warn">dados privados</span>}</span>
                  <span className="block text-sm text-muted">{PERMISSOES[p].descricao}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {manifesto.encaixes.length === 0 && <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Sem nenhum encaixe, a extensão fica instalada mas não aparece em lugar nenhum (só em Extensões &gt; Gerenciar).</p>}
    </div>
  );
}

// O que a extensão leu durante a prévia: transparência sobre quais dados ela pede.
function RegistroChamadas({ permissoes, chamadas, fonte }: { permissoes: Permissao[]; chamadas: RegistroChamada[]; fonte: FonteDados }) {
  return (
    <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
      <summary className="cursor-pointer text-muted">Prévia com permissões simuladas ({permissoes.map((p) => PERMISSOES[p].rotulo).join(", ")}) · dados {fonte === "real" ? "da mesa" : "de exemplo"} · {chamadas.length} chamada(s)</summary>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono">
        {chamadas.length === 0 && <li className="text-muted">Nenhuma chamada ainda.</li>}
        {chamadas.map((c, i) => (
          <li key={i} className={c.ok ? "text-muted" : "text-danger"}>{c.op} {c.alvo} → {c.detalhe}</li>
        ))}
      </ul>
    </details>
  );
}
