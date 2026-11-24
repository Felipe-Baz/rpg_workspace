"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { uid } from "@/lib/mesas";
import type { Item } from "@/lib/dnd5e";
import type { Catalogo, ItemCat, Preco } from "@/lib/regras/dnd5e/catalogo";
import { precoEmCobre } from "@/lib/regras/dnd5e/equipamento";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const kg = (n: number) => `${String(n).replace(".", ",")} kg`;
const precoTxt = (p?: Preco) => (p ? `${p.valor.toLocaleString("pt-BR")} ${p.moeda}` : "—");

const FILTROS = [["", "Tudo"], ["arma", "Armas"], ["armadura", "Armaduras"], ["escudo", "Escudos"], ["item", "Aventura"], ["ferramenta", "Ferramentas"], ["pacote", "Pacotes"]] as const;

/** Resumo de regra mostrado na lista e guardado na descrição do item. */
export function resumoDoItem(i: ItemCat): string {
  switch (i.tipo) {
    case "arma": {
      const p = i.propriedades;
      const props = [p.acuidade && "acuidade", p.leve && "leve", p.pesada && "pesada", p.alcance && "alcance", p.duasMaos && "duas mãos", p.recarga && "recarga", p.especial && "especial", p.versatil && `versátil (${p.versatil})`, p.arremesso && `arremesso ${p.arremesso.normal}/${p.arremesso.longo} m`, p.municao && `munição ${p.municao.normal}/${p.municao.longo} m`].filter(Boolean).join(", ");
      return `${i.dado ?? "—"} ${i.tipoDano ?? ""}${props ? ` · ${props}` : ""}`.trim();
    }
    case "armadura": return `CA ${i.caBase}${i.somaDes ? ` + Des${i.maxDes !== undefined ? ` (máx. +${i.maxDes})` : ""}` : ""}${i.forca ? ` · For ${i.forca}` : ""}${i.furtividadeDesv ? " · desv. em Furtividade" : ""}`;
    case "escudo": return `+${i.bonusCa} na CA`;
    case "pacote": return i.itens.map((x) => `${x.qtd > 1 ? `${x.qtd}× ` : ""}${x.nome}`).join(", ");
    default: return i.grupo ?? "";
  }
}

const pesoDe = (i: ItemCat) => ("peso" in i ? i.peso : 0);

function itemDaFicha(i: ItemCat, qtd = 1): Item {
  return { id: uid(), nome: i.nome, quantidade: qtd, peso: pesoDe(i), equipado: false, descricao: resumoDoItem(i), catalogoId: i.id };
}

/** Itens da ficha que um item do catálogo gera (pacotes viram vários itens). */
export function itensParaAdicionar(i: ItemCat, cat: Catalogo): Item[] {
  if (i.tipo !== "pacote") return [itemDaFicha(i)];
  return i.itens.map((x) => {
    const ref = x.ref ? cat.item(x.ref) : undefined;
    return ref ? itemDaFicha(ref, x.qtd) : { id: uid(), nome: x.nome, quantidade: x.qtd, peso: 0, equipado: false, descricao: `Do ${i.nome}` };
  });
}

/**
 * Catálogo de equipamento do livro: busca, filtro por tipo e botões de adicionar (grátis, para o equipamento inicial) ou
 * comprar (desconta o preço das moedas). Pacotes viram os itens que os compõem.
 */
export default function CatalogoEquipamento({ cat, podePagar, onAdicionar, onFechar }: {
  cat: Catalogo;
  /** Diz se as moedas cobrem o preço (em peças de cobre). */
  podePagar: (custoCobre: number) => boolean;
  onAdicionar: (itens: Item[], custoCobre: number) => void;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const lista = useMemo(() => {
    const q = semAcento(texto).trim();
    return cat.equipamento().filter((i) => (!tipo || i.tipo === tipo) && (!q || semAcento(i.nome).includes(q)));
  }, [cat, texto, tipo]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Catálogo de equipamento">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-gold/50 bg-card shadow-xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold text-gold">Catálogo de equipamento</h2>
          <span className="text-xs text-muted">{lista.length} itens</span>
          <button onClick={onFechar} aria-label="Fechar" className="ml-auto rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar pelo nome…" aria-label="Buscar item" className={`${campo} min-w-40 flex-1`} autoFocus />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo} aria-label="Tipo">
            {FILTROS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto text-sm">
          {lista.slice(0, 120).map((i) => {
            const custo = precoEmCobre("preco" in i ? i.preco : undefined);
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.nome} <span className="text-xs font-normal text-muted">{precoTxt("preco" in i ? i.preco : undefined)}{pesoDe(i) ? ` · ${kg(pesoDe(i))}` : ""}</span></p>
                  <p className="truncate text-xs text-muted" title={resumoDoItem(i)}>{resumoDoItem(i)}</p>
                </div>
                <button onClick={() => onAdicionar(itensParaAdicionar(i, cat), 0)} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold hover:bg-gold/20" title="Adiciona sem cobrar (equipamento inicial, tesouro)">Adicionar</button>
                {custo > 0 && (
                  <button disabled={!podePagar(custo)} onClick={() => onAdicionar(itensParaAdicionar(i, cat), custo)} className="rounded-md border border-border px-2 py-0.5 text-xs hover:border-gold disabled:opacity-40" title={podePagar(custo) ? "Adiciona e desconta o preço das moedas" : "Moedas insuficientes"}>Comprar</button>
                )}
              </li>
            );
          })}
          {lista.length > 120 && <li className="px-4 py-2 text-xs text-muted">Mostrando 120; refine a busca.</li>}
          {lista.length === 0 && <li className="px-4 py-3 text-muted">Nada encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
