"use client";

import { useEffect, useState } from "react";
import { Check, Info, TriangleAlert } from "lucide-react";

// Avisos rápidos e não bloqueantes. Uso: toast("Código copiado") ou toast("Falhou", "erro").
type Tipo = "ok" | "info" | "erro";
type Item = { id: number; texto: string; tipo: Tipo };

let seq = 0;
let empurrar: ((i: Item) => void) | null = null;
export const toast = (texto: string, tipo: Tipo = "ok") => empurrar?.({ id: ++seq, texto, tipo });

export function ToastHost() {
  const [itens, setItens] = useState<Item[]>([]);

  useEffect(() => {
    empurrar = (i) => {
      setItens((l) => [...l.slice(-3), i]);
      setTimeout(() => setItens((l) => l.filter((x) => x.id !== i.id)), 3200);
    };
    return () => {
      empurrar = null;
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[110] flex flex-col items-center gap-2 px-4">
      {itens.map((t) => (
        <div key={t.id} className="anim-surgir pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm shadow-2xl">
          {t.tipo === "ok" ? <Check size={16} className="text-ok" /> : t.tipo === "erro" ? <TriangleAlert size={16} className="text-danger" /> : <Info size={16} className="text-accent-hover" />}
          {t.texto}
        </div>
      ))}
    </div>
  );
}
