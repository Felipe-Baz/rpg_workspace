"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Send, Trash2 } from "lucide-react";
import { ATRIBUTOS, ATRIBUTO_NOME, PERICIAS, ehDnd5e, type Atributo } from "@/lib/dnd5e";
import { assinarPedidosDaMesa, pedirTeste, removerPedido, tituloPedido, type PedidoTeste, type TipoPedido, type Vantagem } from "@/lib/pedidosTeste";
import { useMesaAtual } from "../shell/MesaContext";
import { campo } from "../telas/Titulo";

// Painel do mestre na sessão ao vivo: pede um teste a um jogador (aparece na tela dele) e acompanha as respostas.
export default function PedirTeste() {
  const mesa = useMesaAtual();
  const dnd = ehDnd5e(mesa.sistema);
  const alvos = mesa.jogadores.filter((j) => j.uid);
  const [paraUid, setParaUid] = useState("");
  const [tipo, setTipo] = useState<TipoPedido>(dnd ? "pericia" : "livre");
  const [chave, setChave] = useState<string>(dnd ? "sobrevivencia" : "");
  const [vantagem, setVantagem] = useState<Vantagem>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [pedidos, setPedidos] = useState<PedidoTeste[]>([]);

  useEffect(() => assinarPedidosDaMesa(mesa.id, setPedidos), [mesa.id]);

  const alvo = alvos.find((j) => j.uid === paraUid) ?? alvos[0];

  function mudarTipo(t: TipoPedido) {
    setTipo(t);
    setChave(t === "pericia" ? "sobrevivencia" : t === "livre" ? "" : "for");
  }

  async function enviar() {
    if (!alvo?.uid || !chave.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      await pedirTeste(mesa.id, { paraUid: alvo.uid, paraNome: alvo.personagem || alvo.nome, tipo, chave: chave.trim(), vantagem, motivo: motivo.trim() });
      setMotivo("");
    } catch (e) {
      console.error(e);
      setErro("Não foi possível enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  if (alvos.length === 0) {
    return <p className="text-sm text-muted">Nenhum jogador com conta vinculada ainda. Os pedidos vão para quem já entrou na mesa e assumiu um personagem.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">Jogador
          <select value={alvo?.uid ?? ""} onChange={(e) => setParaUid(e.target.value)} className={`${campo} mt-1`}>
            {alvos.map((j) => <option key={j.id} value={j.uid}>{j.personagem || j.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Tipo
          <select value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoPedido)} className={`${campo} mt-1`}>
            {dnd && <option value="pericia">Perícia</option>}
            {dnd && <option value="atributo">Atributo (só o modificador)</option>}
            {dnd && <option value="salvaguarda">Salvaguarda</option>}
            <option value="livre">Teste livre</option>
          </select>
        </label>
      </div>

      {tipo === "pericia" && (
        <select aria-label="Perícia" value={chave} onChange={(e) => setChave(e.target.value)} className={campo}>
          {PERICIAS.map((p) => <option key={p.id} value={p.id}>{p.nome} ({ATRIBUTO_NOME[p.atr]})</option>)}
        </select>
      )}
      {(tipo === "atributo" || tipo === "salvaguarda") && (
        <select aria-label="Atributo" value={chave} onChange={(e) => setChave(e.target.value)} className={campo}>
          {ATRIBUTOS.map((a: Atributo) => <option key={a} value={a}>{ATRIBUTO_NOME[a]}</option>)}
        </select>
      )}
      {tipo === "livre" && <input aria-label="Nome do teste" value={chave} onChange={(e) => setChave(e.target.value)} maxLength={60} placeholder="Nome do teste (o jogador informa o bônus)" className={campo} />}

      <input aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Contexto para o jogador (opcional): “Vocês tentam seguir o rastro…”" className={campo} />

      <div className="flex flex-wrap items-center gap-2">
        {([["v", "Vantagem"], ["d", "Desvantagem"]] as const).map(([k, r]) => (
          <button key={k} type="button" aria-pressed={vantagem === k} onClick={() => setVantagem(vantagem === k ? null : k)}
            className={`rounded-full border px-3 py-1 text-xs ${vantagem === k ? "border-accent bg-accent/15 text-accent-soft" : "border-border text-muted hover:text-foreground"}`}>{r}</button>
        ))}
        <button type="button" onClick={enviar} disabled={enviando || !chave.trim()} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60">
          <Send size={14} /> Pedir teste
        </button>
      </div>
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}

      {pedidos.length > 0 && (
        <ul className="space-y-1.5 border-t border-border pt-3">
          {pedidos.slice(0, 8).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-background px-3 py-2 text-sm">
              {p.status === "pendente" ? <Clock size={14} className="shrink-0 text-muted" aria-label="Aguardando" /> : <Check size={14} className="shrink-0 text-ok" aria-label="Respondido" />}
              <span className="min-w-[8rem] flex-1">
                <strong>{p.paraNome}</strong> · {tituloPedido(p)}
                {p.vantagem && <span className="text-muted"> ({p.vantagem === "v" ? "vantagem" : "desvantagem"})</span>}
              </span>
              {p.status === "respondido" ? (
                <span className="shrink-0 text-right">
                  <strong className={`text-lg ${p.natural === 20 ? "text-gold" : p.natural === 1 ? "text-danger" : ""}`}>{p.total}</strong>
                  <span className="ml-1 text-xs text-muted">d20: {p.natural}{p.origem === "mesa" ? " · na mesa" : ""}</span>
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted">aguardando</span>
              )}
              <button type="button" onClick={() => removerPedido(mesa.id, p.id)} aria-label="Remover pedido" className="shrink-0 text-muted hover:text-danger"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
