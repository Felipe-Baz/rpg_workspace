import { Suspense } from "react";
import ShellMesa, { Carregando } from "@/components/shell/ShellMesa";

export const instant = false;

async function Conteudo({ params, children }: { params: LayoutProps<"/mesas/[id]">["params"]; children: React.ReactNode }) {
  const { id } = await params;
  return <ShellMesa id={id}>{children}</ShellMesa>;
}

export default function Layout(props: LayoutProps<"/mesas/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={props.params}>{props.children}</Conteudo>
    </Suspense>
  );
}
