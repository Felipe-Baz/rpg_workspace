import { Suspense } from "react";
import VisaoMestre from "@/components/VisaoMestre";

export const instant = false;

async function Conteudo({ params }: { params: PageProps<"/mesas/[id]/mestre">["params"] }) {
  const { id } = await params;
  return <VisaoMestre id={id} />;
}

export default function Page(props: PageProps<"/mesas/[id]/mestre">) {
  return (
    <Suspense fallback={null}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
