import { Suspense } from "react";
import MarcasApp from "@/components/marcas/MarcasApp";

export const instant = false;

async function Conteudo({ params }: { params: PageProps<"/mesas/[id]/marcas">["params"] }) {
  const { id } = await params;
  return <MarcasApp mesaId={id} />;
}

export default function Page(props: PageProps<"/mesas/[id]/marcas">) {
  return (
    <Suspense fallback={null}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
