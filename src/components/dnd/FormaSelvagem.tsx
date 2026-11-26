"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { comSinal, modificador, type FichaDnd, type Teste } from "@/lib/dnd5e";
import { curaDeCombate, custoDaForma, ehCirculoDaLua, feraPermitida, fmtNd, limiteDaForma, motivoSemConjurar, type Fera, type LimiteForma } from "@/lib/regras/dnd5e/formaSelvagem";

const botao = "rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-sm font-semibold text-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50";
const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ATR = [["for", "FOR"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]] as const;

function Estatisticas({ fera, mantidos }: { fera: Fera; mantidos?: FichaDnd["atributos"] }) {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted">{fera.tamanho} · ND {fera.nd} · CA {fera.caTexto} · PV {fera.pvTexto} · {fera.deslocamento}</p>
      <div className="grid grid-cols-6 gap-1 text-center">
        {ATR.map(([k, r]) => {
          const doDruida = !!mantidos && (k === "int" || k === "sab" || k === "car");
          const v = doDruida ? mantidos![k] : fera.atributos[k];
          return (
            <div key={k} className={`rounded border px-1 py-0.5 ${doDruida ? "border-border text-muted" : "border-gold/40"}`} title={doDruida ? "Mantido do druida" : "Da fera"}>
              <span className="block text-[10px] uppercase tracking-wider">{r}</span>
              <strong className="font-mono">{v}</strong> <span className="font-mono text-muted">({comSinal(modificador(v))})</span>
            </div>
          );
        })}
      </div>
      {fera.sentidos && <p><strong>Sentidos</strong> {fera.sentidos}</p>}
      {fera.defesasTexto?.map((t) => <p key={t}>{t}</p>)}
      {fera.tracos.map((t) => <p key={t.nome}><strong>{t.nome}.</strong> {t.texto}</p>)}
      {fera.acoes.map((a) => <p key={a.nome}><strong>{a.nome}.</strong> {a.texto}</p>)}
      {fera.ataques.map((a) => (
        <p key={a.nome}><strong>{a.nome}.</strong> {comSinal(a.bonus)} para atingir, {a.alcance}. {a.dano}{a.bonusDano ? ` ${a.bonusDano > 0 ? "+" : "−"} ${Math.abs(a.bonusDano)}` : ""} de dano {a.tipoDano}.{a.nota ? ` ${a.nota}` : ""}</p>
      ))}
    </div>
  );
}

/** Escolha da fera (Forma Selvagem): só as que o nível e o círculo do druida permitem, com as estatísticas do bestiário. */
export function EscolherForma({ ficha, feras, onEscolher, onFechar }: { ficha: FichaDnd; feras: Fera[]; onEscolher: (f: Fera) => void; onFechar: () => void }) {
  const lim = limiteDaForma(ficha) as LimiteForma;
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Fera | null>(null);
  const lista = useMemo(() => {
    const q = semAcento(busca.trim());
    return feras
      .filter((x) => feraPermitida(x, lim))
      .filter((x) => !q || semAcento(x.nome).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }, [feras, lim, busca]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Escolher a forma de fera">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border-2 border-gold/50 bg-card p-4 shadow-xl">
        <div className="flex items-start gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-gold">Forma Selvagem</h2>
            <p className="text-xs text-muted">
              Bestas que você já viu, com ND até {fmtNd(lim.ndMax)}{lim.semVoo ? ", sem voo" : ""}{lim.semNatacao ? " nem natação" : ""}{lim.elemental ? ", ou um elemental (gasta 2 usos)" : ""}. Dura {lim.horas} {lim.horas === 1 ? "hora" : "horas"}. Gasta um uso da característica.
            </p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="ml-auto text-muted hover:text-foreground"><X size={18} /></button>
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fera…" aria-label="Buscar fera" className={`${campo} mt-3`} />
        <div className="mt-3 grid min-h-0 flex-1 gap-3 sm:grid-cols-[14rem_1fr]">
          <ul className="max-h-64 space-y-1 overflow-y-auto sm:max-h-none">
            {lista.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSel(x)} aria-pressed={sel?.id === x.id}
                  className={`flex w-full items-center justify-between rounded-md border px-2 py-1 text-left text-sm ${sel?.id === x.id ? "border-gold bg-gold/15" : "border-border hover:border-gold/60"}`}>
                  <span>{x.nome}</span><span className="font-mono text-xs text-muted">{x.elemental ? "elemental · " : ""}ND {x.nd}</span>
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="text-sm text-muted">Nenhuma fera permitida com esse filtro.</li>}
          </ul>
          <div className="min-h-0 overflow-y-auto rounded-lg border border-border p-3">
            {sel ? (
              <>
                <h3 className="font-display text-base font-bold">{sel.nome}</h3>
                <Estatisticas fera={sel} mantidos={ficha.atributos} />
                <button className={`${botao} mt-3`} onClick={() => onEscolher(sel)}>Transformar-se em {sel.nome}{custoDaForma(sel) > 1 ? ` (${custoDaForma(sel)} usos)` : ""}</button>
              </>
            ) : <p className="text-sm text-muted">Escolha uma fera para ver as estatísticas.</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Cartão da forma ativa: estatísticas da fera, PV dela, volta à forma normal e (Círculo da Lua) a cura gastando espaço. */
export function CartaoForma({ ficha, fera, onSair, onMudar, onRolar }: { ficha: FichaDnd; fera: Fera; onSair: () => void; onMudar: (f: FichaDnd) => void; onRolar: (t: Teste) => void }) {
  const lim = limiteDaForma(ficha);
  const lua = ehCirculoDaLua(ficha);
  const livres = ficha.espacos.map((e, i) => ({ circulo: i + 1, livres: e.total - e.usados })).filter((e) => e.livres > 0);
  const [circulo, setCirculo] = useState(0);
  const escolhido = livres.find((e) => e.circulo === circulo)?.circulo ?? livres[0]?.circulo ?? 0;
  const aviso = motivoSemConjurar(ficha);
  return (
    <div className="space-y-2 rounded-lg border border-gold/50 bg-gold/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-bold text-gold">Em forma de {fera.nome}</h3>
        <span className="font-mono text-sm">PV {ficha.pv}/{fera.pv}</span>
        {lim && <span className="text-xs text-muted">dura até {lim.horas} {lim.horas === 1 ? "hora" : "horas"}</span>}
        <button className={`${botao} ml-auto`} onClick={onSair} title="Ação bônus. Você volta aos PV que tinha antes de se transformar.">Voltar à forma normal</button>
      </div>
      {aviso && <p className="text-xs text-danger">{aviso}</p>}
      {lua && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold">Forma Selvagem de Combate (ação bônus):</span>
          {livres.length === 0 ? <span className="text-muted">sem espaços de magia livres</span> : (
            <>
              <select aria-label="Círculo do espaço a gastar" value={escolhido} onChange={(e) => setCirculo(Number(e.target.value))} className={`${campo} !py-0.5`}>
                {livres.map((e) => <option key={e.circulo} value={e.circulo}>{e.circulo}º círculo ({e.livres})</option>)}
              </select>
              <button className={botao} title="Gasta um espaço de magia e dá 1d8 PV por círculo do espaço, aos PV da fera." onClick={() => {
                const r = curaDeCombate(ficha, escolhido);
                if (!r.ok) return window.alert(r.motivo);
                onMudar(r.ficha);
                onRolar({ titulo: `Cura de Combate (espaço do ${escolhido}º círculo)`, dado: r.dado, d20: false, cura: true, partes: [] });
              }}>Gastar espaço e curar</button>
            </>
          )}
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-muted">Estatísticas da fera</summary>
        <div className="mt-2"><Estatisticas fera={fera} mantidos={ficha.atributos} /></div>
      </details>
    </div>
  );
}
