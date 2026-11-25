"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dices, Swords } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useFichaEfetiva } from "@/lib/fichaPersonagem";
import { modoDaJogada, type Jogada } from "@/lib/regras/dnd5e/combate";
import type { OpcoesMesa } from "@/lib/regras/sistema";
import { PERICIAS, ehDnd5e, expressaoParaRolar, formatarExpressao, testeAtributo, testeIniciativa, testePericia, testeSalvaguarda, totalFixo, type Atributo, type ParteRolagem } from "@/lib/dnd5e";
import { assinarMeusPedidos, periciaValida, responderPedido, tituloPedido, type PedidoTeste } from "@/lib/pedidosTeste";
import { useRolagem } from "../dados/RolagemProvider";
import { useMesaAtual } from "../shell/MesaContext";

// Lado do jogador: quando o mestre pede um teste, um cartão aparece na tela com a conta já montada pela ficha.
// O jogador rola no site (dados 3D para a mesa toda) ou informa o d20 que rolou na mesa; a resposta volta ao mestre.
export default function PedidoTesteJogador() {
  const mesa = useMesaAtual();
  const { user } = useAuth();
  const meuUid = user?.uid ?? "";
  const [fila, setFila] = useState<PedidoTeste[]>([]);

  useEffect(() => (meuUid ? assinarMeusPedidos(mesa.id, meuUid, setFila) : undefined), [mesa.id, meuUid]);

  const pedido = fila[0];
  if (!pedido || typeof document === "undefined") return null;
  return createPortal(<Cartao key={pedido.id} pedido={pedido} restantes={fila.length - 1} mesaId={mesa.id} meuUid={meuUid} sistema={mesa.sistema} opcoes={mesa.opcoesRegras} />, document.body);
}

function Cartao({ pedido, restantes, mesaId, meuUid, sistema, opcoes }: { pedido: PedidoTeste; restantes: number; mesaId: string; meuUid: string; sistema: string; opcoes?: OpcoesMesa }) {
  const dnd = ehDnd5e(sistema);
  // ficha com os valores calculados pelo livro (a gravada tem números defasados quando há construção)
  const { ficha, calc, carregado } = useFichaEfetiva(mesaId, meuUid, opcoes, dnd);
  const { rolar, rolando } = useRolagem();
  const [bonusLivre, setBonusLivre] = useState("");
  const [manual, setManual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const titulo = tituloPedido(pedido);
  const partes = useMemo<ParteRolagem[]>(() => {
    if (pedido.tipo === "livre" || !dnd) {
      const n = Number(bonusLivre);
      return [{ rotulo: "Bônus", valor: bonusLivre.trim() !== "" && Number.isFinite(n) ? Math.trunc(n) : 0 }];
    }
    if (pedido.tipo === "iniciativa") return testeIniciativa(ficha).partes;
    if (pedido.tipo === "pericia") return periciaValida(pedido.chave) ? testePericia(ficha, pedido.chave).partes : [];
    if (pedido.tipo === "atributo") return testeAtributo(ficha, pedido.chave as Atributo).partes;
    return testeSalvaguarda(ficha, pedido.chave as Atributo).partes;
  }, [pedido, dnd, ficha, bonusLivre]);

  // o que as condições e características da ficha sugerem (o mestre decide a vantagem do pedido; isto é um aviso)
  const sugestao = useMemo(() => {
    if (!dnd || pedido.tipo === "livre") return null;
    const atr = (pedido.tipo === "pericia" ? PERICIAS.find((p) => p.id === pedido.chave)?.atr : pedido.chave) as Atributo | undefined;
    const jogada: Jogada | null = pedido.tipo === "iniciativa" ? { tipo: "iniciativa" } : !atr ? null : pedido.tipo === "salvaguarda" ? { tipo: "salvaguarda", atributo: atr } : { tipo: "teste", atributo: atr };
    return jogada ? modoDaJogada({ ...ficha, armaduraSemProf: calc?.armaduraSemProf }, jogada) : null;
  }, [dnd, pedido, ficha, calc]);

  const pronto = !dnd || pedido.tipo === "livre" || carregado;
  const fixo = totalFixo(partes);
  const vantagemTxt = pedido.vantagem === "v" ? "2d20 (melhor)" : pedido.vantagem === "d" ? "2d20 (pior)" : "1d20";
  const manualNum = manual.trim() === "" ? null : Number(manual);
  const manualValido = manualNum !== null && Number.isInteger(manualNum) && manualNum >= 1 && manualNum <= 20;

  async function enviar(total: number, natural: number, origem: "site" | "mesa") {
    setEnviando(true);
    setErro("");
    try {
      await responderPedido(mesaId, pedido.id, { total, natural, origem });
    } catch (e) {
      console.error(e);
      setErro("Não foi possível enviar a resposta. Tente de novo.");
      setEnviando(false);
    }
  }

  async function rolarAqui() {
    if (rolando || enviando) return;
    const r = await rolar(expressaoParaRolar("1d20", partes, { vantagem: pedido.vantagem }), dnd && ficha.nome ? `${ficha.nome} — ${titulo}` : titulo);
    if (!r) { setErro("Não foi possível rolar."); return; }
    const natural = r.grupos[0]?.mantidos[0] ?? r.total - fixo;
    await enviar(r.total, natural, "site");
  }

  return (
    <aside role="dialog" aria-label={`Teste pedido pelo mestre: ${titulo}`} className="anim-surgir fixed inset-x-3 bottom-3 z-[60] mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-2xl border-2 border-accent bg-card p-4 shadow-2xl">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft">
        <Swords size={14} /> O mestre pediu um teste{restantes > 0 ? ` · +${restantes} na fila` : ""}
      </p>
      <h3 className="mt-1 font-display text-xl font-semibold text-gold">{titulo}</h3>
      {pedido.motivo && <p className="mt-1 text-sm text-muted">{pedido.motivo}</p>}
      <p className="mt-2 rounded-lg bg-background px-3 py-2 font-mono text-base">{formatarExpressao(vantagemTxt, partes)}</p>
      {sugestao && (sugestao.vantagens.length > 0 || sugestao.desvantagens.length > 0 || sugestao.falhaAutomatica) && (
        <p role="note" className="mt-2 text-xs">
          <span className="text-muted">Pela sua ficha: </span>
          {sugestao.falhaAutomatica && <strong className="mr-2 text-danger">{sugestao.falhaAutomatica}.</strong>}
          {sugestao.vantagens.length > 0 && <span className="mr-2 text-ok">vantagem ({sugestao.vantagens.join(", ")})</span>}
          {sugestao.desvantagens.length > 0 && <span className="mr-2 text-danger">desvantagem ({sugestao.desvantagens.join(", ")})</span>}
          {!sugestao.modo && sugestao.vantagens.length > 0 && sugestao.desvantagens.length > 0 && <span className="text-muted">— se anulam.</span>}
          <span className="text-muted"> Combine com o mestre.</span>
        </p>
      )}

      {(pedido.tipo === "livre" || !dnd) && (
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          Seu bônus:
          <input type="number" value={bonusLivre} onChange={(e) => setBonusLivre(e.target.value)} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-foreground" />
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={rolarAqui} disabled={!pronto || rolando || enviando} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong disabled:opacity-60">
          <Dices size={16} /> Rolar aqui
        </button>
        <label className="ml-auto flex flex-wrap items-center gap-2 text-muted">
          Rolei na mesa. Dado:
          <input type="number" min={1} max={20} value={manual} onChange={(e) => setManual(e.target.value)} className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-foreground" />
          {manualValido && <span>→ <strong className="text-lg text-gold">{(manualNum as number) + fixo}</strong></span>}
          <button onClick={() => manualValido && enviar((manualNum as number) + fixo, manualNum as number, "mesa")} disabled={!pronto || !manualValido || enviando} className="rounded-lg border border-border px-3 py-1.5 text-foreground hover:border-accent-hover disabled:opacity-50">Enviar</button>
        </label>
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-danger">{erro}</p>}
    </aside>
  );
}
