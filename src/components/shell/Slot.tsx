"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { encaixeDe, type SlotId } from "@/lib/extensoes/manifesto";
import PainelExtensao from "../extensoes/PainelExtensao";
import { useMesaAtual } from "./MesaContext";
import { useExtensoesContexto } from "./ExtensoesContext";

/**
 * Encaixe: ponto de uma tela do app onde extensões ativas na mesa podem exibir um painel.
 * Só desenha extensões cujo manifesto declara este slot para o papel de quem está vendo.
 * Sem extensões, não renderiza nada (a tela continua idêntica).
 */
export default function Slot({ nome, className = "" }: { nome: Extract<SlotId, "diario.jogador" | "visao-geral" | "sessao.painel">; className?: string }) {
  const mesa = useMesaAtual();
  const { extensoes, papel, base } = useExtensoesContexto();
  const itens = extensoes.flatMap((e) => {
    const enc = encaixeDe(e.manifesto, nome, papel);
    return enc ? [{ e, enc }] : [];
  });
  if (itens.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`} data-slot={nome}>
      {itens.map(({ e, enc }) => (
        <section key={e.id} className="overflow-hidden rounded-2xl border border-ext/30 bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {enc.rotulo || e.titulo}
              <span className="rounded border border-ext/40 px-1.5 text-[10px] font-normal text-ext">Extensão</span>
            </h2>
            <Link href={`${base}/extensoes/${e.id}`} aria-label={`Abrir ${e.titulo} em tela cheia`} className="text-muted hover:text-foreground"><ExternalLink size={14} /></Link>
          </header>
          <div className="p-2">
            <PainelExtensao ext={e} mesaId={mesa.id} mestre={papel === "mestre"} altura={enc.altura} />
          </div>
        </section>
      ))}
    </div>
  );
}
