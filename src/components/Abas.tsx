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
  return (
    <div className="flex gap-1 border-b border-border" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id}
          role="tab"
          aria-selected={a.id === ativa}
          onClick={() => onChange(a.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            a.id === ativa ? "border-accent-hover text-accent-hover" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}
