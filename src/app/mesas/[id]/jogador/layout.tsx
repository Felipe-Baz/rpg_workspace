import { Suspense } from "react";
import { Carregando } from "@/components/shell/ShellBase";
import ShellJogador from "@/components/shell/ShellJogador";

export const instant = false;

async function Conteudo({ params, children }: { params: LayoutProps<"/mesas/[id]/jogador">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  return <ShellJogador id={id}>{children}</ShellJogador>;
}

export default function Layout(props: LayoutProps<"/mesas/[id]/jogador">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={props.params}>{props.children}</Conteudo>
    </Suspense>
  );
}
