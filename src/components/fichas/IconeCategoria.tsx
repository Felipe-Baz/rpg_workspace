import { Backpack, Skull, Star, Users, type LucideIcon } from "lucide-react";
import type { CategoriaFicha } from "@/lib/fichas";

// Ícone de cada categoria de ficha (substitui os emojis de CATEGORIAS na interface).
export const ICONES_FICHA: Record<CategoriaFicha, LucideIcon> = { npc: Users, inimigo: Skull, importante: Star, item: Backpack };

export default function IconeCategoria({ categoria, size = 32 }: { categoria: CategoriaFicha; size?: number }) {
  const I = ICONES_FICHA[categoria];
  return <I size={size} strokeWidth={1.5} className="text-muted" aria-hidden />;
}
