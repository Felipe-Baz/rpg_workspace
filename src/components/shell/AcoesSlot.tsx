"use client";

import { useState } from "react";
import { Puzzle } from "lucide-react";
import { encaixeDe, type SlotId } from "@/lib/extensoes/manifesto";
import PainelExtensao from "../extensoes/PainelExtensao";
import Dialog from "../ui/Dialog";
import { useExtensoesContexto } from "./ExtensoesContext";
import { useMesaAtual } from "./MesaContext";

/**
 * Encaixe com contexto: botões nas telas de missão e ficha do mestre. Cada extensão que declara o slot
 * ganha um botão que a abre num diálogo, recebendo o item em `window.RPG.contexto` (ex.: "Gerar tesouro" na missão).
 * Sem extensões, não renderiza nada.
 */
export default function AcoesSlot({ nome, contexto }: { nome: Extract<SlotId, "missao.acoes" | "ficha.acoes">; contexto: Record<string, unknown> }) {
  const mesa = useMesaAtual();
  const { extensoes, papel } = useExtensoesContexto();
  const [aberta, setAberta] = useState<string | null>(null);

  const itens = extensoes.flatMap((e) => {
    const enc = encaixeDe(e.manifesto, nome, papel);
    return enc ? [{ e, rotulo: enc.rotulo || e.titulo }] : [];
  });
  if (itens.length === 0) return null;
  const atual = itens.find((i) => i.e.id === aberta);

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot={nome}>
      {itens.map(({ e, rotulo }) => (
        <button key={e.id} onClick={() => setAberta(e.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-ext/40 px-3 py-1.5 text-sm text-ext hover:bg-ext/10">
          <Puzzle size={14} /> {rotulo}
        </button>
      ))}
      {atual && (
        <Dialog titulo={atual.rotulo} onClose={() => setAberta(null)} largura="max-w-3xl">
          <div className="h-[65vh] min-h-72">
            <PainelExtensao ext={atual.e} mesaId={mesa.id} mestre={papel === "mestre"} contexto={contexto} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
