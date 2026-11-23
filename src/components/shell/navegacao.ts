import { BookMarked, BookOpenText, Boxes, Calendar, Crown, Image as ImageIcon, LayoutDashboard, Lock, Map as MapIcon, PenLine, Puzzle, Scroll, type LucideIcon } from "lucide-react";
import { CATEGORIAS } from "@/lib/fichas";
import { nativasVisiveis, type ConfigNativas } from "@/lib/extensoes/nativas";
import { ICONES_FICHA } from "../fichas/IconeCategoria";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon; ext?: boolean; troca?: boolean; chave?: string }; // troca = link para a outra visão (nunca "ativo")
export type GrupoNav = { titulo: string; itens: ItemNav[] };


// Sidebar agrupada por categoria (Mundo / Jogo / Extensões). `base` = /mesas/{id}.
export function gruposNav(base: string, extensoes: ItemNav[] = []): { inicio: ItemNav; grupos: GrupoNav[] } {
  return {
    inicio: { href: base, rotulo: "Visão geral", icone: LayoutDashboard },
    grupos: [
      {
        titulo: "Mundo",
        itens: [
          { chave: "mapas", href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
          { chave: "imagens", href: `${base}/imagens`, rotulo: "Imagens", icone: ImageIcon },
          { chave: "mundo", href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
        ],
      },
      {
        titulo: "Jogo",
        itens: [
          { chave: "missoes", href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
          ...CATEGORIAS.map((c) => ({ chave: `fichas.${c.id}`, href: `${base}/fichas/${c.id}`, rotulo: c.rotulo, icone: ICONES_FICHA[c.id] ?? Boxes })),
          { chave: "jogadores", href: `${base}/jogadores`, rotulo: "Jogadores", icone: Crown },
          { chave: "sessoes", href: `${base}/sessoes`, rotulo: "Sessões", icone: Calendar },
          { chave: "segredos", href: `${base}/segredos`, rotulo: "Segredos", icone: Lock },
        ],
      },
      {
        titulo: "Extensões",
        itens: [
          ...extensoes,
          { href: `${base}/extensoes`, rotulo: "Gerenciar extensões", icone: Puzzle },
        ],
      },
    ],
  };
}

// Visão do jogador: só o que o mestre libera. `base` = /mesas/{id}/jogador.
export function gruposNavJogador(base: string, extensoes: ItemNav[] = []): { inicio: ItemNav; grupos: GrupoNav[] } {
  return {
    inicio: { href: base, rotulo: "Meu diário", icone: BookMarked },
    grupos: [
      {
        titulo: "Mundo",
        itens: [
          { chave: "mapas", href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
          { chave: "imagens", href: `${base}/imagens`, rotulo: "Imagens", icone: ImageIcon },
          { chave: "mundo", href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
          { chave: "quadro", href: `${base}/quadro`, rotulo: "Quadro", icone: PenLine },
        ],
      },
      {
        titulo: "Jogo",
        itens: [
          { chave: "missoes", href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
          ...CATEGORIAS.map((c) => ({ chave: `fichas.${c.id}`, href: `${base}/fichas/${c.id}`, rotulo: c.rotulo, icone: ICONES_FICHA[c.id] ?? Boxes })),
        ],
      },
      ...(extensoes.length ? [{ titulo: "Extensões", itens: extensoes }] : []),
    ],
  };
}

/**
 * Encaixe "sidebar": itens das extensões nativas desta mesa. `rota` define o shell do link; o mestre vê sempre
 * (`verTudo`), o jogador só o que o mestre liberou (Marcas de Pacto nasce privada).
 */
export function itensNativos(mesaId: string, rota: "mestre" | "jogador" = "mestre", config: ConfigNativas = {}, verTudo = rota === "mestre"): ItemNav[] {
  return nativasVisiveis(mesaId, verTudo ? "mestre" : "jogador", config).map((n) => ({
    href: rota === "jogador" ? `/mesas/${mesaId}/jogador/${n.rota}` : `/mesas/${mesaId}/${n.rota}`,
    rotulo: n.titulo,
    icone: Boxes,
    ext: true,
  }));
}
