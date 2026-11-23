import { BookMarked, BookOpenText, Boxes, Calendar, Crown, Image as ImageIcon, LayoutDashboard, Lock, Map as MapIcon, PenLine, Scroll, type LucideIcon } from "lucide-react";
import { CATEGORIAS } from "@/lib/fichas";
import { ICONES_FICHA } from "../fichas/IconeCategoria";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon; ext?: boolean; troca?: boolean }; // troca = link para a outra visão (nunca "ativo")
export type GrupoNav = { titulo: string; itens: ItemNav[] };


// Sidebar agrupada por categoria (Mundo / Jogo / Extensões). `base` = /mesas/{id}.
export function gruposNav(base: string): { inicio: ItemNav; grupos: GrupoNav[] } {
  return {
    inicio: { href: base, rotulo: "Visão geral", icone: LayoutDashboard },
    grupos: [
      {
        titulo: "Mundo",
        itens: [
          { href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
          { href: `${base}/imagens`, rotulo: "Imagens", icone: ImageIcon },
          { href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
        ],
      },
      {
        titulo: "Jogo",
        itens: [
          { href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
          ...CATEGORIAS.map((c) => ({ href: `${base}/fichas/${c.id}`, rotulo: c.rotulo, icone: ICONES_FICHA[c.id] ?? Boxes })),
          { href: `${base}/jogadores`, rotulo: "Jogadores", icone: Crown },
          { href: `${base}/sessoes`, rotulo: "Sessões", icone: Calendar },
          { href: `${base}/segredos`, rotulo: "Segredos", icone: Lock },
        ],
      },
      {
        titulo: "Extensões",
        itens: [{ href: `${base}/marcas`, rotulo: "Marcas de Pacto", icone: Boxes, ext: true }],
      },
    ],
  };
}

// Visão do jogador: só o que o mestre libera. `base` = /mesas/{id}/jogador.
export function gruposNavJogador(base: string): { inicio: ItemNav; grupos: GrupoNav[] } {
  return {
    inicio: { href: base, rotulo: "Meu diário", icone: BookMarked },
    grupos: [
      {
        titulo: "Mundo",
        itens: [
          { href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
          { href: `${base}/imagens`, rotulo: "Imagens", icone: ImageIcon },
          { href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
          { href: `${base}/quadro`, rotulo: "Quadro", icone: PenLine },
        ],
      },
      {
        titulo: "Jogo",
        itens: [
          { href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
          ...CATEGORIAS.map((c) => ({ href: `${base}/fichas/${c.id}`, rotulo: c.rotulo, icone: ICONES_FICHA[c.id] ?? Boxes })),
        ],
      },
    ],
  };
}
