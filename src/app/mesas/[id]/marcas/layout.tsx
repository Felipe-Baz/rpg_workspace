import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "@/app/marcas/marcas.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "O Juramento de Cinzas — Marcas de Pacto",
  description: "Diário das Marcas para a mesa de O Juramento de Cinzas",
};

export default function MarcasLayout({ children }: LayoutProps<"/mesas/[id]/marcas">) {
  return <div className={`marcas ${cinzel.variable} ${garamond.variable}`}>{children}</div>;
}
