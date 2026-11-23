// Extensões nativas: módulos completos (código React + dados próprios) que o app entrega,
// mas que só aparecem nas mesas autorizadas. Usam os mesmos "encaixes" das extensões criadas com IA
// (sidebar, Diário do jogador…), então são o primeiro exemplo de extensão que muda outras telas.
import { MESA_PADRAO } from "../marcas-const.ts";

export type IdNativa = "marcas-de-pacto";

export type ExtensaoNativa = {
  id: IdNativa;
  titulo: string;
  /** Mesas onde a extensão existe. Fora delas ela não aparece em lugar nenhum. */
  mesas: readonly string[];
  /** Rota (relativa a /mesas/{id}) da tela principal. */
  rota: string;
};

export const NATIVAS: readonly ExtensaoNativa[] = [
  // "O Juramento de Cinzas": as Marcas pertencem somente a esta mesa.
  { id: "marcas-de-pacto", titulo: "Marcas de Pacto", mesas: [MESA_PADRAO], rota: "marcas" },
];

export const nativasDaMesa = (mesaId: string): ExtensaoNativa[] => NATIVAS.filter((n) => n.mesas.includes(mesaId));
export const nativaAtiva = (mesaId: string, id: IdNativa): boolean => nativasDaMesa(mesaId).some((n) => n.id === id);

/** Escolhas do mestre por mesa (mesas/{id}/extensoesNativas/{idNativa}). Sem registro = visível aos jogadores (como sempre foi); o mestre pode ocultar. */
export type ConfigNativas = Record<string, { visivelJogadores: boolean } | undefined>;

export type PapelNativa = "mestre" | "jogador";

/** O mestre sempre vê as nativas da mesa; o jogador vê, a menos que o mestre as tenha ocultado (`visivelJogadores: false`). */
export const nativaVisivel = (mesaId: string, id: IdNativa, papel: PapelNativa, config: ConfigNativas): boolean =>
  nativaAtiva(mesaId, id) && (papel === "mestre" || config[id]?.visivelJogadores !== false);

export const nativasVisiveis = (mesaId: string, papel: PapelNativa, config: ConfigNativas): ExtensaoNativa[] =>
  nativasDaMesa(mesaId).filter((n) => nativaVisivel(mesaId, n.id, papel, config));
