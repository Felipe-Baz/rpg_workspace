export const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export default function Titulo({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-wide">{titulo}</h1>
        {texto && <p className="mt-1 text-sm text-muted">{texto}</p>}
      </div>
      {acao}
    </header>
  );
}
