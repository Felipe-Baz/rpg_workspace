"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Dices, X } from "lucide-react";
import type { Rolagem } from "@/lib/dados";
import { useRolagem } from "../dados/RolagemProvider";
import { expressaoParaRolar, formatarExpressao, totalFixo, type Teste } from "@/lib/dnd5e";

// Mostra a conta "1d20 + 5 (Carisma) + 2 (Proficiência)". Não rola sozinho: o jogador pode rolar no site
// ou com dados de verdade e só informar o resultado do dado para conferir o total.
export default function PainelRolagem({ teste, onFechar, aoAplicar }: { teste: Teste; onFechar: () => void; aoAplicar?: (total: number) => void }) {
  const [vantagem, setVantagem] = useState<"v" | "d" | null>(null);
  const [critico, setCritico] = useState(false);
  const [manual, setManual] = useState("");
  const [copiado, setCopiado] = useState(false);

  const dado = teste.d20 ? (vantagem ? (vantagem === "v" ? "2d20 (melhor)" : "2d20 (pior)") : "1d20") : critico ? expressaoParaRolar(teste.dado, [], { critico: true }) : teste.dado;
  const texto = formatarExpressao(dado, teste.partes);
  const fixo = totalFixo(teste.partes);
  const { rolar, rolando } = useRolagem();
  const [resultado, setResultado] = useState<Rolagem | null>(null);
  const [erro, setErro] = useState(false);

  async function rolarAqui() {
    setResultado(null);
    const r = await rolar(expressaoParaRolar(teste.dado, teste.partes, { vantagem: teste.d20 ? vantagem : null, critico: teste.dano ? critico : false }), teste.titulo);
    setErro(!r);
    setResultado(r);
    setManual("");
  }
  const manualNum = manual.trim() === "" ? null : Number(manual);
  const totalManual = manualNum !== null && Number.isFinite(manualNum) ? manualNum + fixo : null;

  // Portal no body: ancestrais com transform/animação prenderiam o "fixed" ao fim da página.
  if (typeof document === "undefined") return null;
  return createPortal(
    <aside role="dialog" aria-label={teste.titulo} className="anim-surgir fixed inset-x-3 bottom-3 z-40 mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-2xl border-2 border-gold/60 bg-card p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-gold">{teste.titulo}</h3>
        <button onClick={onFechar} aria-label="Fechar" className="text-muted hover:text-foreground"><X size={18} /></button>
      </div>
      <p className="mt-2 rounded-lg bg-background px-3 py-2 font-mono text-base">{texto}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {teste.d20 && (
          <>
            {([["v", "Vantagem"], ["d", "Desvantagem"]] as const).map(([k, r]) => (
              <button key={k} onClick={() => { setVantagem(vantagem === k ? null : k); setResultado(null); }} aria-pressed={vantagem === k}
                className={`rounded-full border px-3 py-1 text-xs ${vantagem === k ? "border-accent bg-accent/15 text-accent-soft" : "border-border text-muted hover:text-foreground"}`}>{r}</button>
            ))}
          </>
        )}
        {teste.dano && (
          <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={critico} onChange={(e) => { setCritico(e.target.checked); setResultado(null); }} /> Crítico (dobra os dados)</label>
        )}
        <button onClick={rolarAqui} disabled={rolando} className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-semibold text-white hover:bg-accent-strong disabled:opacity-60"><Dices size={15} /> Rolar aqui</button>
        <button
          onClick={() => { navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }).catch(() => {}); }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-muted hover:text-foreground"><Copy size={14} /> {copiado ? "Copiado" : "Copiar"}</button>
      </div>

      {erro && <p role="alert" className="mt-2 text-sm text-danger">Dados inválidos. Confira o campo de dano.</p>}
      {resultado && (
        <p className="mt-3 text-sm">
          {resultado.grupos.map((g) => `${g.rotulo}: [${g.dados.join(", ")}]${g.mantidos.length !== g.dados.length ? ` → ${g.mantidos.join(", ")}` : ""}`).join(" · ")}
          {fixo !== 0 && <> {fixo > 0 ? "+" : "−"} {Math.abs(fixo)}</>} = <strong className="text-xl text-gold">{resultado.total}</strong>
          {resultado.critico === "acerto" && <span className="ml-2 text-ok">20 natural!</span>}
          {resultado.critico === "falha" && <span className="ml-2 text-danger">1 natural</span>}
        </p>
      )}
      {aoAplicar && (resultado || totalManual !== null) && (
        <button
          onClick={() => { aoAplicar(Math.max(0, resultado?.total ?? totalManual ?? 0)); onFechar(); }}
          className="mt-3 rounded-lg border border-ok/50 px-3 py-1.5 text-sm font-semibold text-ok hover:bg-ok/10"
        >
          Aplicar {Math.max(0, resultado?.total ?? totalManual ?? 0)} PV de cura
        </button>
      )}
      <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        Rolei na mesa. {teste.d20 ? "Dado:" : "Soma dos dados:"}
        <input type="number" value={manual} onChange={(e) => { setManual(e.target.value); setResultado(null); }} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-foreground" />
        {totalManual !== null && <span>→ total <strong className="text-lg text-gold">{totalManual}</strong></span>}
      </label>
    </aside>,
    document.body,
  );
}
