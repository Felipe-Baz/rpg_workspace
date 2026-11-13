import { Suspense } from "react";
import VisaoJogador from "@/components/VisaoJogador";

export const instant = false;

async function Conteudo({ params }: { params: PageProps<"/mesas/[id]/jogador">["params"] }) {
  const { id } = await params;
  return <VisaoJogador id={id} />;
}

export default function Page(props: PageProps<"/mesas/[id]/jogador">) {
  return (
    <Suspense fallback={null}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
