import PaginaEstado from "@/components/ui/PaginaEstado";
import DadoD20 from "@/components/ui/DadoD20";
import CacaCorvos from "@/components/ui/CacaCorvos";

export const metadata = { title: "Página não encontrada · RPG Workspace" };

export default function NotFound() {
  return (
    <PaginaEstado
      codigo="404"
      titulo="Falha crítica de navegação"
      texto="Você rolou 1 no teste de Orientação e se perdeu nas ruínas. Esta página não existe, ou a mesa foi removida."
      topo={<DadoD20 final={1} legenda="Clique para tentar a sorte" />}
    >
      <p className="mb-3 text-sm text-muted">Enquanto isso, derrube uns corvos:</p>
      <CacaCorvos />
    </PaginaEstado>
  );
}
