"use client";

import { createContext, useContext } from "react";
import type { Mesa } from "@/lib/mesas";

// A mesa já validada (existe e o usuário é o mestre) é fornecida pelo shell às páginas do workspace.
const Ctx = createContext<Mesa | null>(null);
export const MesaProvider = Ctx.Provider;

export function useMesaAtual(): Mesa {
  const m = useContext(Ctx);
  if (!m) throw new Error("useMesaAtual fora do workspace da mesa");
  return m;
}
