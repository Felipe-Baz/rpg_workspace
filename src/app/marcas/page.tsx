import { redirect } from "next/navigation";
import { MESA_PADRAO } from "@/lib/marcas-const";

// Atalho: as Marcas pertencem à mesa de "O Juramento de Cinzas".
export default function Page() {
  redirect(`/mesas/${MESA_PADRAO}/marcas`);
}
