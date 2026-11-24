"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/lib/auth";

// Quando o mestre abre a visão do jogador com `?como=<uid>`, o shell fornece o uid
// do jogador visto. As telas do jogador leem o uid daqui em vez de `user.uid`.
export type VisaoJogador = { uid: string; vendoComo: boolean };
const Ctx = createContext<VisaoJogador | null>(null);
export const VisaoJogadorProvider = Ctx.Provider;

export function useUidJogador(): VisaoJogador {
  const { user } = useAuth();
  const v = useContext(Ctx);
  return v ?? { uid: user?.uid ?? "", vendoComo: false };
}
