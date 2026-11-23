// Manifesto de uma extensão: onde ela aparece no app ("encaixes"). Puro e sem dependências.
// Fonte única dos encaixes: a UI, a validação e o prompt da IA leem daqui.

import { normalizarPermissoes, type Permissao } from "./capacidades.ts";

export type Papel = "mestre" | "jogador";

export const SLOTS = {
  sidebar: { rotulo: "Menu lateral", descricao: "Item na sidebar que abre a extensão em tela cheia.", papeis: ["mestre", "jogador"] },
  "diario.jogador": { rotulo: "Meu diário (jogador)", descricao: "Seção dentro do Meu diário do jogador.", papeis: ["jogador"] },
  "visao-geral": { rotulo: "Visão geral da mesa", descricao: "Cartão na Visão geral do mestre.", papeis: ["mestre"] },
  "sessao.painel": { rotulo: "Sessão ao vivo", descricao: "Painel na tela de Sessão ao vivo do mestre.", papeis: ["mestre"] },
  ctrlk: { rotulo: "Busca (Ctrl+K)", descricao: "Comando na busca global que abre a extensão.", papeis: ["mestre", "jogador"] },
} as const satisfies Record<string, { rotulo: string; descricao: string; papeis: readonly Papel[] }>;

export type SlotId = keyof typeof SLOTS;
export const SLOT_IDS = Object.keys(SLOTS) as SlotId[];
/** Encaixes que exibem o painel dentro de outra tela (os demais só levam à tela da extensão). */
export const SLOTS_INLINE: readonly SlotId[] = ["diario.jogador", "visao-geral", "sessao.painel"];

export type Encaixe = {
  slot: SlotId;
  rotulo: string; // texto exibido; vazio = título da extensão
  papeis: Papel[]; // quem vê (sempre dentro do que o slot permite)
  altura: number; // px, para encaixes inline
};

/** `permissoes` = o que a extensão PEDE; só vale o que o mestre aprovar ao instalar (ver capacidades.ts). */
export type Manifesto = { versao: 1; encaixes: Encaixe[]; permissoes: Permissao[] };

export const ALTURA_PADRAO = 360;
const ALTURA_MIN = 160;
const ALTURA_MAX = 900;
const MAX_ROTULO = 40;

const ehSlot = (s: unknown): s is SlotId => typeof s === "string" && Object.hasOwn(SLOTS, s);

/** Manifesto das extensões antigas (e novas sem manifesto): só o item na sidebar, como sempre foi. */
export const manifestoPadrao = (): Manifesto => ({ versao: 1, permissoes: [], encaixes: [{ slot: "sidebar", rotulo: "", papeis: ["mestre", "jogador"], altura: ALTURA_PADRAO }] });

/**
 * Normaliza qualquer valor para um manifesto válido: descarta slots desconhecidos, repetidos,
 * papéis que o slot não aceita e limita tamanhos. Sem manifesto (ausente/inválido) = padrão.
 */
export function normalizarManifesto(bruto: unknown): Manifesto {
  const lista = bruto && typeof bruto === "object" ? (bruto as { encaixes?: unknown }).encaixes : undefined;
  const permissoes = normalizarPermissoes(bruto && typeof bruto === "object" ? (bruto as { permissoes?: unknown }).permissoes : undefined);
  if (!Array.isArray(lista)) return { ...manifestoPadrao(), permissoes };

  const vistos = new Set<SlotId>();
  const encaixes: Encaixe[] = [];
  for (const e of lista) {
    if (!e || typeof e !== "object") continue;
    const { slot, rotulo, papeis, altura } = e as Record<string, unknown>;
    if (!ehSlot(slot) || vistos.has(slot)) continue;
    const permitidos: readonly Papel[] = SLOTS[slot].papeis;
    const pedidos = Array.isArray(papeis) ? papeis.filter((p): p is Papel => p === "mestre" || p === "jogador") : [];
    const efetivos = (pedidos.length ? pedidos : [...permitidos]).filter((p) => permitidos.includes(p));
    if (efetivos.length === 0) continue;
    vistos.add(slot);
    encaixes.push({
      slot,
      rotulo: typeof rotulo === "string" ? rotulo.trim().slice(0, MAX_ROTULO) : "",
      papeis: [...new Set(efetivos)],
      altura: typeof altura === "number" && Number.isFinite(altura) ? Math.round(Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, altura))) : ALTURA_PADRAO,
    });
  }
  return { versao: 1, encaixes, permissoes };
}

/** Encaixe da extensão neste slot visível para o papel, se houver. */
export function encaixeDe(manifesto: unknown, slot: SlotId, papel: Papel): Encaixe | undefined {
  return normalizarManifesto(manifesto).encaixes.find((e) => e.slot === slot && e.papeis.includes(papel));
}

/** Liga ou desliga um slot, mantendo os demais (usado pelo painel "Encaixes" do criador). */
export function alternarEncaixe(m: Manifesto, slot: SlotId, ligado: boolean): Manifesto {
  const sem = m.encaixes.filter((e) => e.slot !== slot);
  if (!ligado) return { ...m, encaixes: sem };
  return { ...m, encaixes: [...sem, { slot, rotulo: "", papeis: [...SLOTS[slot].papeis], altura: ALTURA_PADRAO }] };
}

export const descricaoDosSlots = () => SLOT_IDS.map((id) => `- "${id}": ${SLOTS[id].descricao} (visível para: ${SLOTS[id].papeis.join(", ")})`).join("\n");
