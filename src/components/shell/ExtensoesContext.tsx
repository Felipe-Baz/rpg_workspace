"use client";

import { createContext, useContext } from "react";
import type { ExtensaoMesa } from "@/lib/extensoes/dados";
import type { Papel } from "@/lib/extensoes/manifesto";
import type { ConfigNativas } from "@/lib/extensoes/nativas";

// Extensões instaladas na mesa (já filtradas para o papel de quem vê) e o papel atual.
// Os shells fornecem; <Slot>, a sidebar e a busca (Ctrl+K) consomem.
type Valor = { extensoes: ExtensaoMesa[]; papel: Papel; base: string; nativas: ConfigNativas; nativasProntas: boolean; souMestre: boolean };
const Ctx = createContext<Valor>({ extensoes: [], papel: "mestre", base: "", nativas: {}, nativasProntas: true, souMestre: false });

export const ExtensoesProvider = Ctx.Provider;
export const useExtensoesContexto = () => useContext(Ctx);
