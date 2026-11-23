"use client";

import Link from "next/link";
import { useRef } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Download, Eye, EyeOff, Pencil, Plus, Power, Puzzle, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { arquivarExtensao, definirAtiva, definirVisibilidadeNativa, excluirDaBiblioteca, publicarNaMesa, reordenarExtensoes, salvarNaBiblioteca, useBiblioteca, useExtensoesMesa, useNativasMesa } from "@/lib/extensoes/dados";
import { nativasDaMesa } from "@/lib/extensoes/nativas";
import { textoConsentimento } from "@/lib/extensoes/capacidades";
import { combinarEfeitos, resumoEfeitos } from "@/lib/extensoes/efeitos";
import { normalizarManifesto } from "@/lib/extensoes/manifesto";
import { MAX_PACOTE, criarPacote, lerPacote, nomeDoArquivo } from "@/lib/extensoes/pacote";
import { PERMISSOES } from "@/lib/extensoes/capacidades";
import { EVENTOS } from "@/lib/extensoes/eventos";
import { uid as novoId } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import { confirmar } from "../ui/Dialogos";
import { ListaSkeleton } from "../ui/Skeleton";
import { toast } from "../ui/Toasts";
import PedidosPendentes from "../extensoes/PedidosPendentes";
import Titulo from "./Titulo";

// "Minhas extensões": o que está instalado nesta mesa + a biblioteca do mestre (reaproveitável em outras mesas).
export default function ListaExtensoes() {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const base = `/mesas/${mesa.id}`;
  const { extensoes: naMesa, carregado: mesaOk } = useExtensoesMesa(mesa.id, true);
  const { extensoes: biblioteca, carregado: bibOk } = useBiblioteca(user?.uid ?? "");
  const { config: nativasCfg } = useNativasMesa(mesa.id);
  const instaladas = new Set(naMesa.map((e) => e.id));
  // Prioridade = ordem desta lista (a última vence conflitos de tema e de nomes). Desativadas não entram.
  const combinados = combinarEfeitos(naMesa.filter((e) => e.ativa !== false).map((e) => ({ id: e.id, titulo: e.titulo, efeitos: normalizarManifesto(e.manifesto).mesa })));
  async function mover(id: string, delta: -1 | 1) {
    const ids = naMesa.map((e) => e.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reordenarExtensoes(mesa.id, ids);
  }
  const ativas = biblioteca.filter((e) => !e.arquivada);
  const arquivadas = biblioteca.filter((e) => e.arquivada);

  const arquivoRef = useRef<HTMLInputElement>(null);

  // Exporta só o código e o manifesto (nunca estado, permissões aprovadas, conversa ou visibilidade).
  function exportar(e: (typeof biblioteca)[number]) {
    const pacote = criarPacote({ titulo: e.titulo, descricao: e.descricao, html: e.html, manifesto: e.manifesto });
    const url = URL.createObjectURL(new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeDoArquivo(e.titulo);
    a.click();
    URL.revokeObjectURL(url);
    toast("Arquivo da extensão gerado");
  }

  // Importar não libera nada: vai para a biblioteca, e as permissões ainda são aprovadas ao instalar numa mesa.
  async function importar(arquivo: File | undefined) {
    if (!arquivo || !user) return;
    if (arquivo.size > MAX_PACOTE) return toast("Arquivo grande demais para ser uma extensão.", "erro");
    const r = lerPacote(await arquivo.text());
    if (!r.ok) return toast(r.erro, "erro");
    const { titulo, descricao, html, manifesto } = r.pacote;
    const pede = [...manifesto.permissoes.map((p) => PERMISSOES[p].rotulo), ...manifesto.eventos.map((e) => `reagir a: ${EVENTOS[e].rotulo.toLowerCase()}`), ...resumoEfeitos(manifesto.mesa)];
    const ok = await confirmar({
      titulo: "Importar extensão",
      texto: `“${titulo}” vai para a sua biblioteca.\n${pede.length ? `Ela pede: ${pede.join("; ")}.` : "Ela não pede permissões."}\n\nNada é liberado agora: você revisa e aprova as permissões ao instalá-la numa mesa. Importe apenas arquivos de quem você confia.`,
      confirmar: "Importar",
    });
    if (!ok) return;
    await salvarNaBiblioteca(user.uid, { id: novoId(), donoUid: user.uid, titulo, descricao, html, manifesto, conversa: [], criadoEm: Date.now(), arquivada: false });
    toast("Extensão importada para a sua biblioteca");
  }

  async function usarAqui(id: string) {
    const e = biblioteca.find((x) => x.id === id);
    if (!e) return;
    const manifesto = normalizarManifesto(e.manifesto);
    const pedidas = manifesto.permissoes;
    const efeitosTxt = resumoEfeitos(manifesto.mesa);
    if ((pedidas.length || manifesto.eventos.length || efeitosTxt.length) && !(await confirmar({ titulo: "Aprovar permissões", texto: textoConsentimento(pedidas, false, manifesto.eventos, efeitosTxt), confirmar: "Aprovar e instalar" }))) return;
    await publicarNaMesa(mesa.id, { id: e.id, titulo: e.titulo, html: e.html, manifesto, permissoesAprovadas: pedidas });
    toast("Extensão adicionada a esta mesa");
  }

  async function excluir(id: string, titulo: string) {
    if (await confirmar({ perigo: true, titulo: "Excluir da biblioteca", texto: `"${titulo}" será apagada da sua biblioteca. Mesas onde ela já está instalada mantêm a cópia.`, confirmar: "Excluir" })) await excluirDaBiblioteca(id);
  }

  if (!mesaOk || !bibOk) return <ListaSkeleton />;

  return (
    <div className="space-y-10">
      <Titulo
        titulo="Extensões"
        texto="Ferramentas feitas por você, em conversa com a IA, que vivem ao lado das nativas."
        acao={<Link href={`${base}/extensoes/criar`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white shadow-lg shadow-accent/25 hover:bg-accent-strong"><Plus size={16} /> Criar extensão</Link>}
      />

      <PedidosPendentes />

      {combinados.conflitos.length > 0 && (
        <section className="rounded-xl border border-warn/50 bg-warn/10 p-4 text-sm" aria-label="Conflitos entre extensões">
          <p className="mb-2 flex items-center gap-2 font-semibold text-warn"><TriangleAlert size={15} /> Conflitos entre extensões</p>
          <ul className="space-y-1 text-muted">
            {combinados.conflitos.map((c) => (
              <li key={`${c.tipo}:${c.chave}`}>
                {c.tipo === "contraste" ? `As cores de texto e fundo (${c.chave}) ficariam ilegíveis; foram ignoradas e a mesa usa as cores padrão.` : `${c.tipo === "tema" ? "Cor" : "Nome"} “${c.chave.replace(/^escuro:|^claro:/, "")}”: definida por ${[...c.perdedoras, c.vencedora].join(" e ")}; vale a de ${c.vencedora} (a última da lista). Use as setas para mudar a prioridade.`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Nesta mesa</h2>
        {nativasDaMesa(mesa.id).map((n) => {
          const liberada = nativasCfg[n.id]?.visivelJogadores !== false;
          return (
            <div key={n.id} className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-ext/40 bg-card p-4">
              <Link href={`${base}/${n.rota}`} className="elevar flex min-w-0 flex-1 items-center gap-3 rounded-lg">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ext/15 text-ext"><Puzzle size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{n.titulo}</span><span className="flex items-center gap-1 text-xs text-muted">Extensão nativa · exclusiva desta mesa · {liberada ? <><Eye size={12} /> visível aos jogadores</> : <><EyeOff size={12} /> só você</>}</span></span>
              </Link>
              <button onClick={() => definirVisibilidadeNativa(mesa.id, n.id, !liberada)} aria-pressed={liberada} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent-hover">
                {liberada ? <EyeOff size={15} /> : <Eye size={15} />} {liberada ? "Ocultar dos jogadores" : "Liberar para jogadores"}
              </button>
            </div>
          );
        })}
        {naMesa.length === 0 && nativasDaMesa(mesa.id).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Nenhuma extensão instalada nesta mesa ainda. Crie uma nova ou use uma da sua biblioteca.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {naMesa.map((e, idx) => {
              const efeitos = resumoEfeitos(normalizarManifesto(e.manifesto).mesa);
              const ativa = e.ativa !== false;
              return (
                <li key={e.id} className={`elevar flex items-center gap-2 rounded-xl border border-border bg-card p-4 ${ativa ? "" : "opacity-60"}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ext/15 text-ext"><Puzzle size={18} /></span>
                  <Link href={`${base}/extensoes/${e.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.titulo}{!ativa && <span className="ml-2 rounded border border-border px-1.5 text-[10px] font-normal text-muted">desativada</span>}</p>
                    <p className="flex items-center gap-1 text-xs text-muted">{e.visivelJogadores ? <><Eye size={12} /> visível aos jogadores</> : <><EyeOff size={12} /> só você</>}</p>
                    {efeitos.length > 0 && <p className="mt-1 text-xs text-gold">Muda a mesa: {efeitos.join(" · ")}</p>}
                  </Link>
                  <div className="flex shrink-0 flex-col">
                    <button disabled={idx === 0} onClick={() => mover(e.id, -1)} aria-label={`Subir prioridade de ${e.titulo}`} className="p-0.5 text-muted hover:text-foreground disabled:opacity-30"><ArrowUp size={13} /></button>
                    <button disabled={idx === naMesa.length - 1} onClick={() => mover(e.id, 1)} aria-label={`Descer prioridade de ${e.titulo}`} className="p-0.5 text-muted hover:text-foreground disabled:opacity-30"><ArrowDown size={13} /></button>
                  </div>
                  <button onClick={() => definirAtiva(mesa.id, e.id, !ativa)} aria-pressed={ativa} aria-label={ativa ? `Desativar ${e.titulo}` : `Ativar ${e.titulo}`} title={ativa ? "Desativar (some do menu e desfaz os efeitos na mesa)" : "Ativar"} className={`p-2 ${ativa ? "text-ok" : "text-muted"} hover:text-foreground`}><Power size={15} /></button>
                  <Link href={`${base}/extensoes/${e.id}/editar`} aria-label={`Editar ${e.titulo}`} className="p-2 text-muted hover:text-foreground"><Pencil size={15} /></Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Minha biblioteca</h2>
          <button onClick={() => arquivoRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent-hover"><Upload size={14} /> Importar arquivo</button>
          <input ref={arquivoRef} type="file" accept=".json,application/json" className="hidden" aria-label="Importar extensão" onChange={(ev) => { importar(ev.target.files?.[0]); ev.target.value = ""; }} />
        </div>
        {ativas.length === 0 ? (
          <p className="text-sm text-muted">Sua biblioteca está vazia. Toda extensão que você salvar aparece aqui e pode ser usada em qualquer uma das suas mesas.</p>
        ) : (
          <ul className="space-y-2">
            {ativas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span className="min-w-0 flex-1 truncate font-medium">{e.titulo}</span>
                {instaladas.has(e.id) ? (
                  <span className="rounded-full bg-ok/15 px-2.5 py-0.5 text-xs text-ok">instalada nesta mesa</span>
                ) : (
                  <button onClick={() => usarAqui(e.id)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent-hover">Usar nesta mesa</button>
                )}
                <Link href={`${base}/extensoes/${e.id}/editar`} className="rounded-lg px-2 py-1.5 text-sm text-muted hover:text-foreground">Editar</Link>
                <button onClick={() => exportar(e)} aria-label={`Exportar ${e.titulo}`} title="Baixar arquivo para compartilhar" className="p-1.5 text-muted hover:text-foreground"><Download size={15} /></button>
                <button onClick={() => arquivarExtensao(e.id, true)} aria-label={`Arquivar ${e.titulo}`} className="p-1.5 text-muted hover:text-foreground"><Archive size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        {arquivadas.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-foreground">Arquivadas ({arquivadas.length})</summary>
            <ul className="mt-2 space-y-2">
              {arquivadas.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 opacity-80">
                  <span className="min-w-0 flex-1 truncate">{e.titulo}</span>
                  <button onClick={() => arquivarExtensao(e.id, false)} className="inline-flex items-center gap-1 text-muted hover:text-foreground"><ArchiveRestore size={14} /> Restaurar</button>
                  <button onClick={() => excluir(e.id, e.titulo)} aria-label={`Excluir ${e.titulo}`} className="p-1 text-muted hover:text-danger"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
