import { notFound } from "next/navigation";

// Páginas de teste das telas de exceção: só existem fora de produção.
// Sem validação de navegação instantânea (o layout chama notFound() em produção).
export const instant = false;

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
