"use client";

export default function Abas<T extends string>({
  abas,
  ativa,
  onChange,
}: {
  abas: { id: T; rotulo: string }[];
  ativa: T;
  onChange: (id: T) => void;
}) {
  // Setas ← → (e Home/End) trocam de aba, como em qualquer tablist acessível.
  function tecla(e: React.KeyboardEvent, i: number) {
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const alvo = e.key === "Home" ? 0 : e.key === "End" ? abas.length - 1 : passo ? (i + passo + abas.length) % abas.length : -1;
    if (alvo < 0) return;
    e.preventDefault();
    onChange(abas[alvo].id);
    (e.currentTarget.parentElement?.children[alvo] as HTMLElement | undefined)?.focus();
  }

  return (
    <div className="flex gap-1 border-b border-border" role="tablist">
      {abas.map((a, i) => (
        <button
          key={a.id}
          role="tab"
          aria-selected={a.id === ativa}
          tabIndex={a.id === ativa ? 0 : -1}
          onKeyDown={(e) => tecla(e, i)}
          onClick={() => onChange(a.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            a.id === ativa ? "border-accent text-accent-hover" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}
