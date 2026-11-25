import Link from "next/link";

export const instant = false;

const CENARIOS = [
  { href: "/dev/nao-encontrado", titulo: "404", texto: "Dispara notFound() de dentro de uma página." },
  { href: "/dev/erro-cliente", titulo: "Erro de rota (cliente)", texto: "Botão que faz um componente lançar erro ao renderizar." },
  { href: "/dev/erro-servidor", titulo: "Erro de rota (servidor)", texto: "Server component que lança erro. O overlay do dev pode cobrir a tela: feche com X." },
  { href: "/dev/carregando", titulo: "Carregando", texto: "Página que demora 6 s para aparecer e mostra o loading." },
  { href: "/dev/offline", titulo: "Sem internet", texto: "Força o aviso offline com o minijogo, sem desligar a rede." },
];

export default function DevIndex() {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Cenários de teste</h1>
      <p className="mt-1 text-sm text-muted">Só existem em desenvolvimento (em produção retornam 404). O erro grave (<code>global-error</code>) não tem página: precisa quebrar o layout raiz.</p>
      <ul className="mt-6 space-y-3">
        {CENARIOS.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block rounded-xl border border-border bg-card p-4 transition hover:bg-card-2">
              <span className="font-medium text-foreground">{c.titulo}</span>
              <span className="mt-1 block text-xs text-muted">{c.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
