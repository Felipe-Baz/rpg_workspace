"use client";

import { useRef, useState } from "react";
import { Database, Download, Pencil, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { definirEstadoAprovado, type ExtensaoMesa } from "@/lib/extensoes/dados";
import { ESCOPOS, ESCOPO_IDS, MAX_ESTADO, criarBackup, idDocEstado, lerBackup, linhasConsentimentoEstado, type Escopo } from "@/lib/extensoes/estado";
import { apagarDocEstado, apagarEstado, gravarDocEstado, limparCompartilhado, useEstadoExtensao, type ItemEstado } from "@/lib/extensoes/estado-firestore";
import { normalizarManifesto } from "@/lib/extensoes/manifesto";
import { useMesaAtual } from "../shell/MesaContext";
import { confirmar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";

const quando = (t: number) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const kb = (n: number) => `${(n / 1000).toFixed(1)} KB`;
const bonito = (json: string) => { try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; } };

type Alvo = { escopo: Escopo; uid: string | null; json: string; editavel: boolean; titulo: string };

/**
 * Painel "Dados" (só o mestre): o que a extensão guarda em cada escopo, por jogador. Ver e editar o JSON, limpar,
 * backup/restauração e aprovar ou revogar escopos. As regras do Firestore valem igual: o mestre nunca grava `doJogador`.
 */
export default function PainelDadosExtensao({ ext, abertoInicial = false }: { ext: ExtensaoMesa; abertoInicial?: boolean }) {
  const mesa = useMesaAtual();
  const { itens } = useEstadoExtensao(mesa.id, ext.id);
  const [editando, setEditando] = useState<Alvo | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  const pedidos = normalizarManifesto(ext.manifesto).estado;
  const aprovados = ext.estadoAprovado ?? [];
  const nomePorConta = (uid: string | null) => {
    const j = mesa.jogadores.find((x) => x.uid === uid);
    return j ? j.personagem || j.nome || "jogador" : "conta que não está mais na mesa";
  };
  const jogadorPorConta = (uid: string | null) => mesa.jogadores.find((x) => x.uid === uid)?.id ?? null;
  const doEscopo = (e: Escopo) => itens.filter((i) => i.escopo === e);
  const mestreDoc = itens.find((i) => i.escopo === "mestre");

  function abrir(a: Alvo) {
    setEditando(a);
    setTexto(bonito(a.json));
    setErro("");
  }

  async function salvar() {
    if (!editando) return;
    let json: string;
    try { json = JSON.stringify(JSON.parse(texto)); } catch { return setErro("JSON inválido: confira vírgulas, aspas e chaves."); }
    if (json.length > MAX_ESTADO) return setErro(`Passa do limite de ${kb(MAX_ESTADO)} (${kb(json.length)}).`);
    try {
      await gravarDocEstado(mesa.id, ext.id, editando.escopo, editando.uid, json);
      toast("Dados salvos");
      setEditando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  async function limparJogador(uid: string) {
    if (!(await confirmar({ perigo: true, titulo: "Limpar dados do jogador", texto: `Apaga o que esta extensão guarda de ${nomePorConta(uid)} (o que você entregou a ele e o que ele mesmo gravou). Não dá para desfazer.`, confirmar: "Apagar" }))) return;
    const n = await apagarEstado(mesa.id, ext.id, (id) => id === idDocEstado("porJogador", uid) || id === idDocEstado("doJogador", uid));
    toast(`${n} documento(s) apagado(s)`);
  }

  async function limparEscopo(e: Escopo) {
    if (!(await confirmar({ perigo: true, titulo: `Limpar “${ESCOPOS[e].rotulo}”`, texto: `Apaga todos os dados deste escopo${ESCOPOS[e].porJogador ? ", de todos os jogadores" : ""}. Não dá para desfazer (faça um backup antes, se quiser).`, confirmar: "Apagar tudo" }))) return;
    if (e === "compartilhado") await limparCompartilhado(mesa.id, ext.id);
    else await apagarEstado(mesa.id, ext.id, (id) => (e === "mestre" ? id === "mestre" : id.startsWith(e === "porJogador" ? "para_" : "de_")));
    toast("Escopo limpo");
  }

  async function alternarEscopo(e: Escopo, aprovar: boolean) {
    if (aprovar && !(await confirmar({ titulo: "Aprovar escopo", texto: `Esta extensão passa a poder:\n${linhasConsentimentoEstado([e]).join("\n")}`, confirmar: "Aprovar" }))) return;
    if (!aprovar && !(await confirmar({ titulo: "Revogar escopo", texto: `A extensão deixa de acessar “${ESCOPOS[e].rotulo}”. Os dados guardados continuam aqui (você pode apagá-los ou reaprovar depois).`, confirmar: "Revogar" }))) return;
    await definirEstadoAprovado(mesa.id, ext.id, ESCOPO_IDS.filter((x) => x !== "compartilhado" && (x === e ? aprovar : aprovados.includes(x))));
  }

  function exportar() {
    const mapa = (e: Escopo) => Object.fromEntries(doEscopo(e).flatMap((i) => { const j = jogadorPorConta(i.uid); return j ? [[j, i.json]] : []; }));
    const b = criarBackup({ extId: ext.id, compartilhado: ext.dadosJson || null, mestre: mestreDoc?.json ?? null, porJogador: mapa("porJogador"), doJogador: mapa("doJogador") });
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados-${ext.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "extensao"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup gerado. Ele contém dados privados (gabaritos, respostas dos jogadores): guarde com cuidado.");
  }

  async function restaurar(f: File | undefined) {
    if (!f) return;
    const r = lerBackup(await f.text());
    if (!r.ok) return toast(r.erro, "erro");
    const { backup } = r;
    if (!(await confirmar({ perigo: true, titulo: "Restaurar backup", texto: "Substitui os dados “Compartilhado”, “Só do mestre” e “Entregue a cada jogador” pelos do arquivo. Os dados escritos pelos jogadores não são restaurados (só o próprio jogador grava esse escopo); eles ficam no arquivo apenas para consulta.", confirmar: "Restaurar" }))) return;
    const avisos: string[] = [];
    if (backup.compartilhado) await gravarDocEstado(mesa.id, ext.id, "compartilhado", null, backup.compartilhado);
    if (backup.mestre) await gravarDocEstado(mesa.id, ext.id, "mestre", null, backup.mestre);
    for (const [jogador, json] of Object.entries(backup.porJogador)) {
      const conta = mesa.jogadores.find((j) => j.id === jogador)?.uid;
      if (!conta) { avisos.push(jogador); continue; }
      await gravarDocEstado(mesa.id, ext.id, "porJogador", conta, json);
    }
    toast(avisos.length ? `Backup restaurado. Ignorados (jogador não está na mesa ou sem conta): ${avisos.join(", ")}` : "Backup restaurado");
  }

  const linhaDoc = (i: ItemEstado | { json: string; atualizadoEm: number }, a: Alvo, apagar?: () => void) => (
    <li key={`${a.escopo}:${a.uid ?? ""}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
      <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
      <span className="text-xs text-muted">{kb(i.json.length)} · {quando(i.atualizadoEm)}</span>
      <button onClick={() => abrir(a)} aria-label={`${a.editavel ? "Editar" : "Ver"} ${a.titulo}`} className="p-1 text-muted hover:text-foreground">{a.editavel ? <Pencil size={14} /> : <Database size={14} />}</button>
      {apagar && <button onClick={apagar} aria-label={`Apagar ${a.titulo}`} className="p-1 text-muted hover:text-danger"><Trash2 size={14} /></button>}
    </li>
  );

  const contasComDados = [...new Set(itens.filter((i) => i.uid).map((i) => i.uid!))];

  return (
    <details id="dados" open={abertoInicial} className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-muted"><Database size={14} /> Dados guardados pela extensão ({itens.length + (ext.dadosJson ? 1 : 0)})</summary>

      <div className="mt-3 space-y-5">
        <section>
          <h4 className="mb-2 flex items-center gap-2 font-medium"><ShieldCheck size={14} /> Escopos</h4>
          <ul className="space-y-1.5">
            {ESCOPO_IDS.map((e) => {
              const aprovado = e === "compartilhado" || aprovados.includes(e);
              const pedido = e === "compartilhado" || pedidos.includes(e);
              const comDados = e === "compartilhado" ? !!ext.dadosJson : e === "mestre" ? !!mestreDoc : doEscopo(e).length > 0;
              return (
                <li key={e} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1"><b>{ESCOPOS[e].rotulo}</b> <span className="text-muted">· lê: {ESCOPOS[e].le} · grava: {ESCOPOS[e].grava}</span></span>
                  {!aprovado && comDados && <span className="rounded border border-warn/50 px-1.5 text-[10px] text-warn">não aprovado, com dados</span>}
                  {e === "compartilhado" ? (
                    <span className="text-xs text-muted">sempre ativo</span>
                  ) : (
                    <button onClick={() => alternarEscopo(e, !aprovado)} className={`rounded-lg border px-2.5 py-1 text-xs ${aprovado ? "border-ok/50 text-ok" : "border-border text-muted"} hover:border-accent-hover`}>
                      {aprovado ? "Aprovado · revogar" : pedido ? "Pedido · aprovar" : "Aprovar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h4 className="font-medium">Da extensão</h4>
          <ul className="space-y-1.5">
            {linhaDoc({ json: ext.dadosJson || "null", atualizadoEm: ext.atualizadaEm }, { escopo: "compartilhado", uid: null, json: ext.dadosJson || "null", editavel: true, titulo: "Compartilhado (todos que veem a extensão)" }, ext.dadosJson ? () => limparEscopo("compartilhado") : undefined)}
            {mestreDoc
              ? linhaDoc(mestreDoc, { escopo: "mestre", uid: null, json: mestreDoc.json, editavel: true, titulo: "Só do mestre" }, () => limparEscopo("mestre"))
              : <li className="flex items-center gap-2 px-3 text-muted">Só do mestre: vazio <button onClick={() => abrir({ escopo: "mestre", uid: null, json: "{}", editavel: true, titulo: "Só do mestre" })} className="underline">preencher</button></li>}
          </ul>
        </section>

        <section className="space-y-2">
          <h4 className="font-medium">Por jogador</h4>
          {mesa.jogadores.filter((j) => j.uid).length === 0 && contasComDados.length === 0 && <p className="text-muted">Nenhum jogador com conta nesta mesa ainda.</p>}
          <ul className="space-y-3">
            {[...new Set([...mesa.jogadores.filter((j) => j.uid).map((j) => j.uid!), ...contasComDados])].map((uid) => {
              const para = itens.find((i) => i.escopo === "porJogador" && i.uid === uid);
              const de = itens.find((i) => i.escopo === "doJogador" && i.uid === uid);
              return (
                <li key={uid} className="rounded-lg border border-border/60 p-2">
                  <p className="mb-1.5 flex items-center gap-2 px-1 font-medium">{nomePorConta(uid)}{(para || de) && <button onClick={() => limparJogador(uid)} className="ml-auto text-xs font-normal text-muted hover:text-danger">limpar dados deste jogador</button>}</p>
                  <ul className="space-y-1.5">
                    {para ? linhaDoc(para, { escopo: "porJogador", uid, json: para.json, editavel: true, titulo: "Entregue a ele" }, () => apagarDocEstado(mesa.id, ext.id, para.id)) : <li className="flex items-center gap-2 px-3 text-muted">Entregue a ele: vazio <button onClick={() => abrir({ escopo: "porJogador", uid, json: "{}", editavel: true, titulo: `Entregue a ${nomePorConta(uid)}` })} className="underline">preencher</button></li>}
                    {de ? linhaDoc(de, { escopo: "doJogador", uid, json: de.json, editavel: false, titulo: "Escrito por ele (somente leitura)" }, () => apagarDocEstado(mesa.id, ext.id, de.id)) : <li className="px-3 text-muted">Escrito por ele: nada ainda</li>}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-wrap gap-2">
          <button onClick={exportar} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 hover:border-accent-hover"><Download size={14} /> Backup</button>
          <button onClick={() => arquivo.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 hover:border-accent-hover"><Upload size={14} /> Restaurar</button>
          <input ref={arquivo} type="file" accept=".json,application/json" className="hidden" aria-label="Restaurar backup de dados" onChange={(ev) => { restaurar(ev.target.files?.[0]); ev.target.value = ""; }} />
        </section>

        {editando && (
          <section className="rounded-xl border border-accent/50 bg-background p-3" aria-label="Editor de dados">
            <div className="mb-2 flex items-center gap-2">
              <b className="min-w-0 flex-1 truncate">{editando.titulo}</b>
              <button onClick={() => setEditando(null)} aria-label="Fechar" className="p-1 text-muted hover:text-foreground"><X size={14} /></button>
            </div>
            <textarea value={texto} readOnly={!editando.editavel} onChange={(e) => setTexto(e.target.value)} rows={12} spellCheck={false} aria-label="JSON" className="w-full rounded-lg border border-border bg-card p-2 font-mono text-xs" />
            {!editando.editavel && <p className="mt-1 text-xs text-muted">Dado escrito pelo jogador: trate como não confiável. Você pode apagá-lo, mas não alterá-lo.</p>}
            {erro && <p role="alert" className="mt-1 text-xs text-danger">{erro}</p>}
            {editando.editavel && <button onClick={salvar} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong">Salvar</button>}
          </section>
        )}
      </div>
    </details>
  );
}
