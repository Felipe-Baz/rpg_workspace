"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Code2, Eye, LayoutTemplate, Loader2, Save, Send, Sparkles, Undo2, Upload, WandSparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { criarBroker, type FonteDados, type RegistroChamada } from "@/lib/extensoes/broker";
import { DADOS_EXEMPLO } from "@/lib/extensoes/broker-puro";
import { ESCOPOS, ESCOPO_IDS, MAX_ESTADO, MAX_GRAVACOES_JOGADOR_POR_MINUTO, assinarEstado, criarArmazemMemoria, escoposGravaveis, type ArmazemEstado, type ContextoEstado, type Escopo } from "@/lib/extensoes/estado";
import { criarLimitador } from "@/lib/extensoes/eventos";
import { PERMISSAO_IDS, PERMISSOES, altera, escreve, textoConsentimento, type Permissao } from "@/lib/extensoes/capacidades";
import { MAX_TITULO } from "@/lib/extensoes/documento";
import { publicarNaMesa, salvarNaBiblioteca, useBiblioteca, useExtensoesMesa, type ExtensaoBiblioteca } from "@/lib/extensoes/dados";
import { ALTURA_PADRAO, SLOTS, SLOTS_INLINE, SLOT_IDS, alternarEncaixe, normalizarManifesto, type Manifesto } from "@/lib/extensoes/manifesto";
import type { MensagemChat } from "@/lib/extensoes/prompt";
import { chamarIa } from "@/lib/ia-cliente";
import { uid as novoId } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import { confirmar } from "../ui/Dialogos";
import { efeitosVazios, resumoEfeitos } from "@/lib/extensoes/efeitos";
import { EVENTO_IDS, EVENTOS, EXEMPLO_EVENTO, type EventoId } from "@/lib/extensoes/eventos";
import { criarProponente, criarSolicitante } from "./proponente";
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
type EstadoInicial = NonNullable<ExtensaoBiblioteca["estadoInicial"]>;

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
  // Ensaio: "mestre" ou o id de um jogador (de exemplo ou da mesa, conforme a fonte de dados).
  const [verComo, setVerComo] = useState<string>("mestre");
  const comoJogador = verComo !== "mestre";
  const [estadoInicial, setEstadoInicial] = useState<EstadoInicial>(existente?.estadoInicial ?? {});
  const [fonte, setFonte] = useState<FonteDados>("real"); // modo ensaio: dados reais da mesa ou de exemplo
  const [chamadas, setChamadas] = useState<RegistroChamada[]>([]);
  const enviarPrevia = useRef<((msg: unknown) => void) | null>(null);
  const registrarPrevia = useCallback((f: ((msg: unknown) => void) | null) => { enviarPrevia.current = f; }, []);
  const simularEvento = (e: EventoId) => enviarPrevia.current?.({ rpg: "evento", evento: e, dados: EXEMPLO_EVENTO[e] });
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
      ...(estadoInicial.compartilhado || estadoInicial.mestre ? { estadoInicial } : {}),
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
    const eventosNovos = manifesto.eventos.length > 0 && JSON.stringify(manifesto.eventos) !== JSON.stringify(normalizarManifesto(instalada?.manifesto).eventos);
    const efeitosTxt = resumoEfeitos(manifesto.mesa);
    const efeitosNovos = efeitosTxt.length > 0 && JSON.stringify(manifesto.mesa) !== JSON.stringify(normalizarManifesto(instalada?.manifesto).mesa);
    // Escopos de estado: pedir um escopo novo exige nova aprovação (como as permissões).
    const escopos = manifesto.estado.filter((e) => e !== "compartilhado");
    const escoposNovos = escopos.some((e) => !(instalada?.estadoAprovado ?? []).includes(e));
    if (publicar && (pedidas.some((p) => !jaAprovadas.includes(p)) || eventosNovos || efeitosNovos || escoposNovos)) {
      const ok = await confirmar({ titulo: "Aprovar permissões", texto: textoConsentimento(pedidas, instalada?.visivelJogadores ?? false, manifesto.eventos, efeitosTxt, escopos), confirmar: "Aprovar e publicar" });
      if (!ok) return;
    }
    setOcupado(true);
    try {
      await guardar();
      if (publicar) {
        await publicarNaMesa(mesa.id, { id, titulo: titulo || "Extensão sem nome", html: html!, manifesto, permissoesAprovadas: pedidas, estadoAprovado: escopos, estadoInicial }, instalada);
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

  // Ensaio do estado por escopo: tudo em memória (nada vai ao Firestore). Cada jogador do ensaio tem uma conta fictícia.
  const jogadoresEnsaio = useMemo(
    () =>
      (fonte === "exemplo"
        ? (DADOS_EXEMPLO.jogadores as { itens: { id: string; personagem: string }[] }).itens.map((j) => ({ id: j.id, nome: j.personagem }))
        : mesa.jogadores.map((j) => ({ id: j.id, nome: j.personagem || j.nome }))
      ).map((j) => ({ ...j, conta: `ensaio:${j.id}` })),
    [fonte, mesa.jogadores],
  );
  // O armazém do ensaio nasce com os dados iniciais; "Reiniciar ensaio" cria outro (e remonta a prévia).
  const [versaoEnsaio, setVersaoEnsaio] = useState(0);
  const [dumpEnsaio, setDumpEnsaio] = useState<Record<string, string>>({});
  const novoArmazem = useCallback((ini: EstadoInicial) => {
    const base: Record<string, string> = {};
    if (ini.compartilhado) base.compartilhado = ini.compartilhado;
    if (ini.mestre) base.mestre = ini.mestre;
    const a = criarArmazemMemoria(base, () => setDumpEnsaio(a.dump()));
    return { a, base };
  }, []);
  const [armazemEnsaio, setArmazemEnsaio] = useState(() => novoArmazem(existente?.estadoInicial ?? {}).a);
  const reiniciarEnsaio = () => {
    const { a, base } = novoArmazem(estadoInicial);
    setArmazemEnsaio(a);
    setDumpEnsaio(base);
    setVersaoEnsaio((v) => v + 1);
  };
  const [limitadorEnsaio] = useState(() => criarLimitador(MAX_GRAVACOES_JOGADOR_POR_MINUTO));
  const ctxEnsaio = useMemo<ContextoEstado>(
    () => ({ papel: comoJogador ? "jogador" : "mestre", aprovados: manifesto.estado, jogadores: jogadoresEnsaio, minhaConta: comoJogador ? `ensaio:${verComo}` : "ensaio:mestre", armazem: armazemEnsaio, podeGravar: () => limitadorEnsaio("ensaio", Date.now()) }),
    [comoJogador, verComo, manifesto.estado, jogadoresEnsaio, armazemEnsaio, limitadorEnsaio],
  );
  const assinarPrevia = useCallback((escopo: Escopo, jogador: string | null, fn: (d: unknown) => void) => assinarEstado(ctxEnsaio, escopo, jogador, fn), [ctxEnsaio]);
  const gravaveisPrevia = useMemo(() => escoposGravaveis(manifesto.estado, comoJogador ? "jogador" : "mestre"), [manifesto.estado, comoJogador]);

  // Prévia: a extensão recebe as permissões que PEDE (simuladas); o registro mostra o que ela leu.
  const aoPedidoPrevia = useMemo(
    () => criarBroker({ mesa, papel: comoJogador ? "jogador" : "mestre", uid: user?.uid ?? "", aprovadas: manifesto.permissoes, fonte, estado: ctxEnsaio, aoRegistrar: (r) => setChamadas((l) => [...l.slice(-19), r]), perguntar: async () => ({ texto: "(Resposta de exemplo da IA: no ensaio nada é enviado à IA nem consome o limite.)" }), propor: comoJogador ? criarSolicitante({ mesa, uid: user?.uid ?? "", ext: { id, titulo: titulo || "Extensão sem nome" }, ensaio: true }) : criarProponente({ mesa, uid: user?.uid ?? "", ext: { id, titulo: titulo || "Extensão sem nome" }, ensaio: true, exemplo: fonte === "exemplo" }) }),
    [mesa, comoJogador, user?.uid, manifesto.permissoes, fonte, setChamadas, id, titulo, ctxEnsaio],
  );

  // Encaixes de ação (missão/ficha) abrem a extensão com o item em RPG.contexto; na prévia usamos um item de exemplo.
  const contextoPrevia = useMemo(() => {
    const enc = manifesto.encaixes.map((e) => e.slot);
    if (enc.includes("missao.acoes")) return { tipo: "missao", id: "m1", titulo: "A Cripta Esquecida", status: "em_andamento", categoria: "Principal", dificuldade: "Média", descricao: "Recuperar o relicário do abade.", etapas: [{ texto: "Entrar na cripta", status: "concluida" }, { texto: "Achar o relicário", status: "atual" }] };
    if (enc.includes("ficha.acoes")) return { tipo: "ficha", id: "f1", categoria: "npc", nome: "Osric, o mercador", texto: "Dono da loja do mercado." };
    return null;
  }, [manifesto.encaixes]);

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
            <label className="ml-2 inline-flex items-center gap-2 text-muted">
              Ver como
              <select value={verComo} onChange={(e) => setVerComo(e.target.value)} aria-label="Ver a prévia como" className="rounded-lg border border-border bg-background px-2 py-1 text-foreground">
                <option value="mestre">mestre</option>
                {jogadoresEnsaio.map((j) => <option key={j.id} value={j.id}>{j.nome || j.id} (jogador)</option>)}
              </select>
            </label>
            {(manifesto.permissoes.length > 0 || manifesto.estado.length > 0) && (
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
              <PainelEncaixes manifesto={manifesto} onChange={setManifesto} estadoInicial={estadoInicial} onEstadoInicial={setEstadoInicial} />
            ) : aba === "previa" ? (
              <div className="flex h-full flex-col gap-2">
                <div className="min-h-0 flex-1">
                  <Sandbox key={`${fonte}:${verComo}:${versaoEnsaio}`} html={html} somenteLeitura={comoJogador} aoPedido={aoPedidoPrevia} permissoes={manifesto.permissoes} contexto={contextoPrevia} registrarEnvio={registrarPrevia} eu={comoJogador ? verComo : null} gravaveis={gravaveisPrevia} assinarEstado={assinarPrevia} titulo={titulo || "Prévia da extensão"} />
                </div>
                {manifesto.eventos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted">Simular evento:</span>{manifesto.eventos.map((e) => <button key={e} onClick={() => simularEvento(e)} className="rounded-lg border border-border px-2.5 py-1 hover:border-accent-hover">{EVENTOS[e].rotulo}</button>)}</div>
                )}
                {(manifesto.permissoes.length > 0 || manifesto.estado.length > 0) && <RegistroChamadas permissoes={manifesto.permissoes} chamadas={chamadas} fonte={fonte} />}
                {manifesto.estado.some((e) => e !== "compartilhado") && <EstadoEnsaio dump={dumpEnsaio} jogadores={jogadoresEnsaio} armazem={armazemEnsaio} aoReiniciar={reiniciarEnsaio} />}
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
function PainelEncaixes({ manifesto, onChange, estadoInicial, onEstadoInicial }: { manifesto: Manifesto; onChange: (m: Manifesto) => void; estadoInicial: EstadoInicial; onEstadoInicial: (e: EstadoInicial) => void }) {
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
      <p className="mb-4 text-sm text-muted">O que a extensão pode ler e criar na mesa. Ao publicar, você revisa e aprova; sem aprovação ela não acessa nada. Para criar conteúdo, cada pedido ainda abre uma tela de aprovação, e dá para desfazer em lote.</p>
      <ul className="space-y-2">
        {PERMISSAO_IDS.map((p) => {
          const ligada = manifesto.permissoes.includes(p);
          return (
            <li key={p} className={`rounded-xl border p-3 ${ligada ? "border-accent/50 bg-accent/5" : "border-border"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={ligada} onChange={(e) => onChange({ ...manifesto, permissoes: PERMISSAO_IDS.filter((x) => (x === p ? e.target.checked : manifesto.permissoes.includes(x))) })} className="mt-1" />
                <span>
                  <span className="block font-medium">{PERMISSOES[p].rotulo} {PERMISSOES[p].sensivel && <span className="ml-1 rounded border border-warn/50 px-1.5 text-[10px] font-normal text-warn">dados privados</span>} {escreve(p) && <span className="ml-1 rounded border border-danger/50 px-1.5 text-[10px] font-normal text-danger">{altera(p) ? "altera e apaga" : "cria conteúdo"}</span>}</span>
                  <span className="block text-sm text-muted">{PERMISSOES[p].descricao}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <h3 className="mt-8 font-display text-lg">O que ela muda na mesa</h3>
      <p className="mb-3 text-sm text-muted">Aparência, nomes, menu e tipos de dado. Só valem depois de publicar, enquanto a extensão estiver ativa, e você revisa tudo ao publicar. Peça ajustes pelo chat.</p>
      {resumoEfeitos(manifesto.mesa).length === 0 ? (
        <p className="text-sm text-muted">Nada: esta extensão não muda a mesa.</p>
      ) : (
        <div className="rounded-xl border border-gold/40 bg-card p-3 text-sm">
          <ul className="list-disc space-y-1 pl-5">{resumoEfeitos(manifesto.mesa).map((l) => <li key={l}>{l}</li>)}</ul>
          <button onClick={() => onChange({ ...manifesto, mesa: efeitosVazios() })} className="mt-3 rounded-lg border border-border px-3 py-1 text-muted hover:border-danger hover:text-danger">Remover estes efeitos</button>
        </div>
      )}

      <h3 className="mt-8 font-display text-lg">Quando reagir sozinha</h3>
      <p className="mb-4 text-sm text-muted">Automação: a extensão recebe estes eventos mesmo fechada, mas só enquanto você está com a mesa aberta. Ela precisa da permissão de leitura correspondente, e criar algo ainda pede a sua aprovação.</p>
      <ul className="space-y-2">
        {EVENTO_IDS.map((ev) => {
          const ligado = manifesto.eventos.includes(ev);
          return (
            <li key={ev} className={`rounded-xl border p-3 ${ligado ? "border-accent/50 bg-accent/5" : "border-border"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={ligado} onChange={(e) => onChange({ ...manifesto, eventos: EVENTO_IDS.filter((x) => (x === ev ? e.target.checked : manifesto.eventos.includes(x))) })} className="mt-1" />
                <span>
                  <span className="block font-medium">{EVENTOS[ev].rotulo}</span>
                  <span className="block text-sm text-muted">{EVENTOS[ev].descricao}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <PainelEscopos manifesto={manifesto} onChange={onChange} estadoInicial={estadoInicial} onEstadoInicial={onEstadoInicial} />

      {manifesto.encaixes.length === 0 && <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Sem nenhum encaixe, a extensão fica instalada mas não aparece em lugar nenhum (só em Extensões &gt; Gerenciar).</p>}
    </div>
  );
}

// O que a extensão leu durante a prévia: transparência sobre quais dados ela pede.
function RegistroChamadas({ permissoes, chamadas, fonte }: { permissoes: Permissao[]; chamadas: RegistroChamada[]; fonte: FonteDados }) {
  return (
    <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
      <summary className="cursor-pointer text-muted">Prévia com permissões simuladas ({permissoes.map((p) => PERMISSOES[p].rotulo).join(", ")}); criações são ensaiadas, nada é gravado · dados {fonte === "real" ? "da mesa" : "de exemplo"} · {chamadas.length} chamada(s)</summary>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono">
        {chamadas.length === 0 && <li className="text-muted">Nenhuma chamada ainda.</li>}
        {chamadas.map((c, i) => (
          <li key={i} className={c.ok ? "text-muted" : "text-danger"}>{c.op} {c.alvo} → {c.detalhe}</li>
        ))}
      </ul>
    </details>
  );
}

// "Onde guarda dados": escopos de estado que a extensão pede, e os dados iniciais (gabaritos, conteúdo de partida).
function PainelEscopos({ manifesto, onChange, estadoInicial, onEstadoInicial }: { manifesto: Manifesto; onChange: (m: Manifesto) => void; estadoInicial: EstadoInicial; onEstadoInicial: (e: EstadoInicial) => void }) {
  const [rascunho, setRascunho] = useState<Record<"compartilhado" | "mestre", string>>({ compartilhado: estadoInicial.compartilhado ?? "", mestre: estadoInicial.mestre ?? "" });
  const [erros, setErros] = useState<Record<string, string>>({});
  function aplicar(chave: "compartilhado" | "mestre", texto: string) {
    setRascunho((r) => ({ ...r, [chave]: texto }));
    if (!texto.trim()) {
      setErros((e) => ({ ...e, [chave]: "" }));
      onEstadoInicial({ ...estadoInicial, [chave]: undefined });
      return;
    }
    try {
      const json = JSON.stringify(JSON.parse(texto));
      if (json.length > MAX_ESTADO) throw new Error(`Passa de ${Math.round(MAX_ESTADO / 1000)} KB.`);
      setErros((e) => ({ ...e, [chave]: "" }));
      onEstadoInicial({ ...estadoInicial, [chave]: json });
    } catch (e) {
      setErros((x) => ({ ...x, [chave]: e instanceof Error && e.message.startsWith("Passa") ? e.message : "JSON inválido (ainda não aplicado)." }));
    }
  }
  const usaMestre = manifesto.estado.includes("mestre");
  return (
    <>
      <h3 className="mt-8 font-display text-lg">Onde guarda dados</h3>
      <p className="mb-4 text-sm text-muted">O estado “Compartilhado” sempre existe. Os demais escopos são aprovados por você ao publicar, e as regras do servidor garantem quem lê e quem grava cada um.</p>
      <ul className="space-y-2">
        {ESCOPO_IDS.filter((e) => e !== "compartilhado").map((e) => {
          const ligado = manifesto.estado.includes(e);
          return (
            <li key={e} className={`rounded-xl border p-3 ${ligado ? "border-accent/50 bg-accent/5" : "border-border"}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={ligado} onChange={(ev) => onChange({ ...manifesto, estado: ESCOPO_IDS.filter((x) => (x === e ? ev.target.checked : manifesto.estado.includes(x))) })} className="mt-1" />
                <span>
                  <span className="block font-medium">{ESCOPOS[e].rotulo} {e === "doJogador" && <span className="ml-1 rounded border border-warn/50 px-1.5 text-[10px] font-normal text-warn">jogador grava sem aprovação</span>}</span>
                  <span className="block text-sm text-muted">{ESCOPOS[e].descricao}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {usaMestre && <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm">Segredos e gabaritos vão em <b>Dados iniciais → Só do mestre</b>, nunca no código: o código da extensão é visível a quem a abre.</p>}

      <h3 className="mt-8 font-display text-lg">Dados iniciais</h3>
      <p className="mb-3 text-sm text-muted">JSON gravado na mesa ao instalar, só se ela ainda não tiver dados. Fica na sua biblioteca (privada) e nunca vai no arquivo exportado.</p>
      {(["compartilhado", ...(usaMestre ? ["mestre" as const] : [])] as const).map((chave) => (
        <label key={chave} className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">{ESCOPOS[chave].rotulo}</span>
          <textarea value={rascunho[chave]} onChange={(e) => aplicar(chave, e.target.value)} rows={5} spellCheck={false} placeholder='{ "exemplo": true }' className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs" />
          {erros[chave] && <span role="alert" className="text-xs text-danger">{erros[chave]}</span>}
        </label>
      ))}
    </>
  );
}

/** "porJogador:ensaio:j1" → ["porJogador", "ensaio:j1"]. */
const separar = (chave: string): [Escopo, string | undefined] => { const i = chave.indexOf(":"); return i < 0 ? [chave as Escopo, undefined] : [chave.slice(0, i) as Escopo, chave.slice(i + 1)]; };

// Estado simulado do ensaio, por escopo e por jogador. Dá para editar (como o mestre faria no painel Dados) e reiniciar.
function EstadoEnsaio({ dump, jogadores, armazem, aoReiniciar }: { dump: Record<string, string>; jogadores: { id: string; nome: string; conta: string }[]; armazem: ArmazemEstado; aoReiniciar: () => void }) {
  const [editando, setEditando] = useState<{ chave: string; texto: string } | null>(null);
  const nome = (conta: string) => jogadores.find((j) => j.conta === conta)?.nome ?? conta;
  const rotulo = (chave: string) => {
    const [escopo, conta] = separar(chave);
    return `${ESCOPOS[escopo]?.rotulo ?? escopo}${conta ? ` · ${nome(conta)}` : ""}`;
  };
  async function salvar() {
    if (!editando) return;
    try {
      const json = JSON.stringify(JSON.parse(editando.texto));
      const [escopo, conta] = separar(editando.chave);
      await armazem.salvar(escopo, conta ?? null, json);
      setEditando(null);
    } catch {
      toast("JSON inválido", "erro");
    }
  }
  const chaves = Object.keys(dump).sort();
  return (
    <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
      <summary className="cursor-pointer text-muted">Estado simulado do ensaio ({chaves.length} documento(s)) · nada é gravado na mesa</summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {chaves.length === 0 && <li className="text-muted">Vazio. Use a extensão (ou troque “Ver como”) para ver o que ela guarda.</li>}
        {chaves.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono">{rotulo(k)}: {dump[k].slice(0, 80)}</span>
            {!k.startsWith("doJogador:") && <button onClick={() => setEditando({ chave: k, texto: dump[k] })} className="underline">editar</button>}
          </li>
        ))}
      </ul>
      {editando && (
        <div className="mt-2">
          <textarea value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} rows={5} spellCheck={false} aria-label="JSON do ensaio" className="w-full rounded-lg border border-border bg-background p-2 font-mono" />
          <button onClick={salvar} className="mt-1 rounded-lg border border-border px-2 py-1 hover:border-accent-hover">Aplicar no ensaio</button>
        </div>
      )}
      <button onClick={aoReiniciar} className="mt-2 rounded-lg border border-border px-2 py-1 text-muted hover:text-foreground">Reiniciar ensaio</button>
    </details>
  );
}
