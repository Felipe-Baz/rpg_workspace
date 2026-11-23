"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Modal acessível: fecha com Esc ou clique fora, foca o primeiro campo, anima a entrada.
export default function Dialog({
  titulo,
  onClose,
  children,
  largura = "max-w-md",
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const primeiro = ref.current?.querySelector<HTMLElement>("input, textarea, select, button[data-foco]");
    primeiro?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !ref.current) return;
      // Prende o foco dentro do diálogo (Tab / Shift+Tab circulam entre os controles).
      const focaveis = ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focaveis.length) return;
      const [a, z] = [focaveis[0], focaveis[focaveis.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); anterior?.focus?.(); };
  }, [onClose]);

  return (
    <div className="anim-surgir fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${largura} rounded-2xl border border-border bg-card p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-wide">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-muted hover:text-foreground"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
