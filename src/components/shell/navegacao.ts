import { BookMarked, BookOpenText, Boxes, Calendar, Crown, GitBranch, IdCard, Image as ImageIcon, LayoutDashboard, Library, Lock, Map as MapIcon, PenLine, Puzzle, Scroll, type LucideIcon } from "lucide-react";
import { CATEGORIAS } from "@/lib/fichas";
import { nativasVisiveis, type ConfigNativas } from "@/lib/extensoes/nativas";
import { ICONES_FICHA } from "../fichas/IconeCategoria";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon; ext?: boolean; troca?: boolean; chave?: string }; // troca = link para a outra visão (nunca "ativo")
export type GrupoNav = { titulo: string; itens: ItemNav[] };

const FICHAS = (base: string, ids: string[]): ItemNav[] =>
  CATEGORIAS.filter((c) => ids.includes(c.id)).map((c) => ({ chave: `fichas.${c.id}`, href: `${base}/fichas/${c.id}`, rotulo: c.rotulo, icone: ICONES_FICHA[c.id] ?? Boxes }));
const PESSOAS = ["npc", "importante", "inimigo"];

// Sidebar agrupada pelo que se consulta junto na mesa, e cada grupo pode ser recolhido. `base` = /mesas/{id}.
export function gruposNav(base: string, extensoes: ItemNav[] = [], dnd = false): { inicio: ItemNav; grupos: GrupoNav[] } {
  return {
    inicio: { href: base, rotulo: "Visão geral", icone: LayoutDashboard },
    grupos: [
      {
        titulo: "Aventura",
        itens: [
          { chave: "mundo", href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
          { chave: "missoes", href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
          { chave: "mapas", href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
          { chave: "imagens", href: `${base}/imagens`, rotulo: "Imagens", icone: ImageIcon },
        ],
      },
      { titulo: "Elenco e itens", itens: FICHAS(base, [...PESSOAS, "item"]) },
      {
        titulo: "Mesa",
        itens: [
          { chave: "jogadores", href: `${base}/jogadores`, rotulo: "Jogadores", icone: Crown },
          ...(dnd ? [{ href: `${base}/personagens`, rotulo: "Fichas D&D", icone: IdCard }] : []),
          { chave: "sessoes", href: `${base}/sessoes`, rotulo: "Sessões", icone: Calendar },
          { href: `${base}/timeline`, rotulo: "Timeline", icone: GitBranch },
          { chave: "segredos", href: `${base}/segredos`, rotulo: "Segredos", icone: Lock },
          ...(dnd ? [{ href: `${base}/livros`, rotulo: "Livros", icone: Library }] : []),
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
export function gruposNavJogador(base: string, extensoes: ItemNav[] = [], dnd = false): { inicio: ItemNav; grupos: GrupoNav[] } {
  return {
    inicio: { href: base, rotulo: "Meu diário", icone: BookMarked },
    grupos: [
      // Quem olha a ficha logo confere o que carrega.
      { titulo: "Personagem", itens: [...(dnd ? [{ href: `${base}/ficha`, rotulo: "Minha ficha", icone: IdCard }] : []), ...FICHAS(base, ["item"])] },
      {
        titulo: "Aventura",
        itens: [
          { chave: "missoes", href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
          { chave: "quadro", href: `${base}/quadro`, rotulo: "Quadro", icone: PenLine },
          { chave: "mundo", href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
        ],
      },
      { titulo: "Pessoas", itens: FICHAS(base, PESSOAS) },
      {
        titulo: "Mapas e imagens",
        itens: [
          { chave: "mapas", href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
          { chave: "imagens", href: `${base}/imagens`, rotulo: "Imagens", icone: ImageIcon },
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
