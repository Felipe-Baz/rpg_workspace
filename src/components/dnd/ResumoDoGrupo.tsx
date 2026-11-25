"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Heart, Shield } from "lucide-react";
import { atualizarEstadoDaFicha, useFichaEfetiva } from "@/lib/fichaPersonagem";
import { CONDICOES, TIPOS_DE_DANO, condicaoDe } from "@/lib/regras/dnd5e/combate";
import { alternarCondicaoDoMestre, curaDoMestre, danoDoMestre, linhaDoGrupo, resumoDoGrupo, type LinhaGrupo } from "@/lib/regras/dnd5e/grupo";
import type { OpcoesMesa } from "@/lib/regras/sistema";

const campo = "rounded-lg border border-border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export type JogadorDoGrupo = { uid: string; nome: string };

/**
 * Painel do mestre: uma linha por jogador (valores já calculados pelo livro, ao vivo), resumo do grupo para planejar
 * encontros, filtro "preciso conferir" e dano, cura e condições aplicados por campo (sem regravar a ficha inteira).
 */
export default function ResumoDoGrupo({ mesaId, jogadores, opcoes, aoAbrir }: { mesaId: string; jogadores: JogadorDoGrupo[]; opcoes?: OpcoesMesa; aoAbrir: (uid: string) => void }) {
  const [linhas, setLinhas] = useState<Record<string, LinhaGrupo>>({});
  const [soConferir, setSoConferir] = useState(false);
  const lista = useMemo(() => jogadores.map((j) => linhas[j.uid]).filter((l): l is LinhaGrupo => !!l), [jogadores, linhas]);
  const resumo = useMemo(() => resumoDoGrupo(lista), [lista]);
  const informar = (uid: string, l: LinhaGrupo) => setLinhas((x) => (JSON.stringify(x[uid]) === JSON.stringify(l) ? x : { ...x, [uid]: l }));

  return (
    <section className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-4" aria-label="Resumo do grupo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold">O grupo</h2>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted" title="Mostra só as fichas com algo fora do livro: ficha manual, ajustes, escolhas pendentes, alertas de armadura/carga/sintonização ou magias acima do limite.">
          <input type="checkbox" checked={soConferir} onChange={(e) => setSoConferir(e.target.checked)} />
          Só quem preciso conferir {resumo.aConferir > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-gold">{resumo.aConferir}</span>}
        </label>
      </div>

      {lista.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <Dado rotulo="PV do grupo" valor={`${resumo.pvAtual}/${resumo.pvMax}`} />
          <Dado rotulo="CA (mín–máx · média)" valor={`${resumo.ca.min}–${resumo.ca.max} · ${String(resumo.ca.media).replace(".", ",")}`} />
          <Dado rotulo="Percepção passiva" valor={`${resumo.percepcao.min}–${resumo.percepcao.max}`} />
          <Dado rotulo="CD de magia" valor={resumo.cds.length ? resumo.cds.map((c) => `${c.nome.split(" ")[0]} ${c.cd}`).join(", ") : "—"} />
        </dl>
      )}
      {lista.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted hover:text-foreground">Perícias, idiomas e condições do grupo</summary>
          <div className="mt-2 space-y-2">
            <p><strong className="text-gold">Cobertas:</strong> {resumo.periciasCobertas.map((p) => <span key={p.id} title={p.quem.join(", ")} className="mr-2">{p.nome}{p.quem.length > 1 ? ` ×${p.quem.length}` : ""}</span>)}</p>
            <p><strong className="text-danger">Sem ninguém:</strong> {resumo.periciasSemCobertura.length ? resumo.periciasSemCobertura.join(", ") : "nenhuma"}</p>
            <p><strong className="text-gold">Idiomas:</strong> {resumo.idiomas.length ? resumo.idiomas.map((i) => <span key={i.nome} title={i.quem.join(", ")} className="mr-2">{i.nome}</span>) : "só das fichas com construção pelo livro"}</p>
            <p><strong className="text-gold">Condições:</strong> {resumo.condicoes.length ? resumo.condicoes.map((c) => `${c.nome} (${c.quem.join(", ")})`).join("; ") : "nenhuma"}</p>
            {resumo.podemSubir.length > 0 && <p className="text-gold">XP para subir de nível: {resumo.podemSubir.join(", ")}.</p>}
          </div>
        </details>
      )}

      <ul className="space-y-2">
        {jogadores.map((j) => <Linha key={j.uid} mesaId={mesaId} jogador={j} opcoes={opcoes} oculta={soConferir} informar={informar} aoAbrir={aoAbrir} />)}
      </ul>
      {soConferir && lista.length > 0 && resumo.aConferir === 0 && <p className="text-sm text-muted">Nenhuma ficha precisa de conferência agora.</p>}
    </section>
  );
}

const Dado = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div><dt className="text-[10px] uppercase tracking-wider text-muted">{rotulo}</dt><dd className="font-semibold">{valor}</dd></div>
);

function Linha({ mesaId, jogador, opcoes, oculta, informar, aoAbrir }: { mesaId: string; jogador: JogadorDoGrupo; opcoes?: OpcoesMesa; oculta: boolean; informar: (uid: string, l: LinhaGrupo) => void; aoAbrir: (uid: string) => void }) {
  const { ficha, bruta, calc, catalogo, carregado } = useFichaEfetiva(mesaId, jogador.uid, opcoes);
  const [valor, setValor] = useState(1);
  const [tipo, setTipo] = useState("");
  const [critico, setCritico] = useState(false);
  const [aviso, setAviso] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const aplicando = useRef(false);

  const l = useMemo(() => (carregado ? linhaDoGrupo(jogador.uid, jogador.nome, bruta, ficha, calc, catalogo, opcoes) : null), [carregado, jogador, bruta, ficha, calc, catalogo, opcoes]);
  useEffect(() => { if (l) informar(jogador.uid, l); }, [l, jogador.uid, informar]);

  if (!l) return <li className="rounded-xl border border-dashed border-border p-3 text-sm text-muted">Abrindo a ficha de {jogador.nome}…</li>;
  if (oculta && l.conferir.length === 0) return null;
  const semFicha = !bruta.nome && !bruta.build && bruta.pvMax === 10 && bruta.pv === 10 && bruta.xp === 0;

  async function aplicar(r: { patch: Parameters<typeof atualizarEstadoDaFicha>[2]; texto: string[] }) {
    if (aplicando.current) return;
    aplicando.current = true;
    setOcupado(true);
    try { await atualizarEstadoDaFicha(mesaId, jogador.uid, r.patch); setAviso(r.texto); } catch (e) { console.error(e); setAviso(["Não foi possível atualizar a ficha."]); } finally { aplicando.current = false; setOcupado(false); }
  }
  const pct = Math.min(100, Math.max(0, (l.pv / Math.max(1, l.pvMax)) * 100));

  return (
    <li className="rounded-xl border border-border bg-background/50 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button onClick={() => aoAbrir(jogador.uid)} className="font-display text-base font-semibold text-gold hover:underline" title="Abrir a ficha">{l.nome}</button>
        <span className={`rounded-full border px-2 text-[10px] ${l.publicada ? "border-ok/50 text-ok" : "border-border text-muted"}`} title={l.publicada ? "Ficha publicada: o jogador não edita identidade, atributos e proficiências" : "Ficha em rascunho: o jogador ainda pode editar tudo"}>{l.publicada ? "publicada" : "rascunho"}</span>
        <span className="text-xs text-muted">{l.classe ? `${l.classe} · ` : ""}nível {l.nivel}{semFicha ? " · ficha ainda não preenchida" : ""}</span>
        <span className="flex items-center gap-1 text-sm" title="Classe de armadura"><Shield size={13} className="text-gold" aria-hidden /> CA {l.ca}</span>
        {l.cd !== null && <span className="text-sm text-muted" title="CD de magia">CD {l.cd}</span>}
        <span className="text-sm text-muted" title="Percepção passiva">Perc. {l.percepcao}</span>
        <span className="text-sm text-muted" title="Deslocamento">Desl. {l.deslocamento}</span>
        {l.vital !== "vivo" && <span className="rounded-full border border-danger/60 px-2 text-xs text-danger">{l.vital === "morto" ? "Morto" : l.vital === "estavel" ? "Estável" : "Inconsciente"}</span>}
        {l.podeSubir && <span className="rounded-full border border-gold px-2 text-xs text-gold">pode subir de nível</span>}
        {l.conferir.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-warn/60 px-2 text-xs text-warn" title={l.conferir.join("\n")}><AlertTriangle size={12} aria-hidden /> conferir ({l.conferir.length})</span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Heart size={14} className={l.pv <= 0 ? "text-danger" : "text-danger/70"} aria-hidden />
        <div className="barra-pv h-2.5 flex-1" role="meter" aria-label={`PV de ${l.nome}`} aria-valuemin={0} aria-valuemax={l.pvMax} aria-valuenow={l.pv}>
          <div className="barra-pv-cheia" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-24 text-right font-mono text-sm">{l.pv}/{l.pvMax}{l.pvTemp > 0 ? <span className="text-sky-400"> +{l.pvTemp}</span> : null}</span>
      </div>

      {(l.condicoes.length > 0 || l.concentracao) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {l.condicoes.map((c) => <span key={c} title={condicaoDe(c)?.resumo} className="rounded-full border border-danger/50 bg-danger/10 px-2 text-[11px] text-danger">{condicaoDe(c)?.nome ?? c}</span>)}
          {l.concentracao && <span className="rounded-full border border-gold/50 bg-gold/10 px-2 text-[11px] text-gold">Concentrando: {l.concentracao}</span>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-muted">
          Valor (dano ou cura)
          <input type="number" min={1} value={valor} onChange={(e) => setValor(Math.max(1, Number(e.target.value) || 1))} aria-label={`Valor de dano ou cura para ${l.nome}`} className={`${campo} !w-24 text-center normal-case tracking-normal text-foreground`} />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-muted">
          Tipo de dano
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo do dano" className={`${campo} !w-auto text-xs normal-case tracking-normal text-foreground`}>
            <option value="">sem tipo</option>
            {TIPOS_DE_DANO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-1.5 text-xs text-muted" title="Dobra os dados do dano"><input type="checkbox" checked={critico} onChange={(e) => setCritico(e.target.checked)} />acerto crítico</label>
        <button disabled={ocupado} onClick={() => aplicar(danoDoMestre(ficha, calc, { valor, tipo: tipo || undefined, critico }))} className="rounded-lg border border-danger/50 px-3 py-1 text-danger hover:bg-danger/10 disabled:opacity-50" title="Tira o valor dos PV (passa por resistências e PV temporários)">Aplicar dano</button>
        <button disabled={ocupado} onClick={() => aplicar(curaDoMestre(ficha, valor))} className="rounded-lg border border-ok/50 px-3 py-1 text-ok hover:bg-ok/10 disabled:opacity-50" title="Soma o valor aos PV">Aplicar cura</button>
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-muted">
          Condição
          <select value="" onChange={(e) => e.target.value && aplicar({ patch: alternarCondicaoDoMestre(ficha, e.target.value), texto: [`${CONDICOES.find((c) => c.id === e.target.value)?.nome} alternada em ${l.nome}.`] })} aria-label="Alternar condição" className={`${campo} !w-auto text-xs normal-case tracking-normal text-foreground`}>
            <option value="">adicionar/remover…</option>
            {CONDICOES.map((c) => <option key={c.id} value={c.id}>{(ficha.condicoes ?? []).includes(c.id) ? "✓ " : ""}{c.nome}</option>)}
          </select>
        </label>
      </div>
      {aviso.length > 0 && <ul role="status" className="mt-1 space-y-0.5 text-xs text-gold">{aviso.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      {l.conferir.length > 0 && <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">Por que conferir</summary><ul className="mt-1 list-disc pl-5">{l.conferir.map((c, i) => <li key={i}>{c}</li>)}</ul></details>}
    </li>
  );
}

