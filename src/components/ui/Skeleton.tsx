// Placeholders de carregamento (substituem o texto "Carregando…" e telas em branco).
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-card-2 ${className}`} />;
}

export function ListaSkeleton({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

// Tela cheia enquanto a sessão do usuário é verificada.
export function TelaCarregando() {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4">
      <span className="font-display text-xl tracking-wide text-gold" style={{ animation: "brilho 1.6s ease-in-out infinite" }}>
        ✦ RPG Workspace
      </span>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
