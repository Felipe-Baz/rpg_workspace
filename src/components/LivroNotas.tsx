"use client";

import { confirmar } from "@/components/ui/Dialogos";
import { useState } from "react";

/** Notas em páginas, no estilo do livro de anotações do Minecraft. */
export default function LivroNotas({
  paginas,
  onChange,
  desabilitado,
  placeholder,
  className = "",
}: {
  paginas: string[];
  onChange: (paginas: string[]) => void;
  desabilitado?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [atual, setAtual] = useState(0);
  const lista = paginas.length ? paginas : [""];
  const i = Math.min(atual, lista.length - 1);

  const editar = (texto: string) => onChange(lista.map((p, k) => (k === i ? texto : p)));
  const adicionar = () => {
    onChange([...lista, ""]);
    setAtual(lista.length);
  };
  const remover = async () => {
    if (lista.length === 1) return onChange([""]);
    if (lista[i].trim() && !(await confirmar({ texto: "Esta página tem conteúdo e será apagada.", confirmar: "Apagar", perigo: true }))) return;
    onChange(lista.filter((_, k) => k !== i));
    setAtual(Math.max(0, i - 1));
  };

  const botao =
    "rounded-md border border-amber-900/30 px-2 py-0.5 text-xs font-medium hover:bg-amber-900/10 disabled:opacity-40";

  return (
    <div className={`space-y-2 rounded-lg border border-amber-900/40 bg-amber-100/10 p-2 ${className}`}>
      <textarea
        value={lista[i]}
        onChange={(e) => editar(e.target.value)}
        disabled={desabilitado}
        rows={5}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-serif text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className={botao} disabled={i === 0} onClick={() => setAtual(i - 1)} aria-label="Página anterior">
            ◀
          </button>
          <span className="px-1 text-xs text-muted">
            Página {i + 1} de {lista.length}
          </span>
          <button type="button" className={botao} disabled={i >= lista.length - 1} onClick={() => setAtual(i + 1)} aria-label="Próxima página">
            ▶
          </button>
        </div>
        <div className="flex gap-1">
          <button type="button" className={botao} disabled={desabilitado} onClick={adicionar}>
            + Página
          </button>
          <button type="button" className={`${botao} hover:text-danger`} disabled={desabilitado} onClick={remover}>
            Apagar página
          </button>
        </div>
      </div>
    </div>
  );
}
