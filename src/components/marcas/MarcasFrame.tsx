"use client";

import { Cinzel, EB_Garamond } from "next/font/google";
import "@/app/marcas/marcas.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"] });

/**
 * Moldura do tema sombrio das Marcas de Pacto (sangue e ouro). O tema fica isolado em `.marcas`:
 * o restante do app (sidebar, topbar, navegação) continua com a identidade do workspace.
 */
export default function MarcasFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`marcas ${cinzel.variable} ${garamond.variable} rounded-2xl border border-border p-4 sm:p-6`} style={{ minHeight: 0 }}>
      {children}
    </div>
  );
}
