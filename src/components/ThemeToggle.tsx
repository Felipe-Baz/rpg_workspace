"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

// O tema vive em <html data-theme>; o script do layout o aplica antes da pintura.
function assinar(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => o.disconnect();
}
const atual = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const tema = useSyncExternalStore(assinar, atual, () => "dark");

  function alternar() {
    const novo = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem("tema", novo); } catch {}
  }

  return (
    <button
      onClick={alternar}
      aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={tema === "dark" ? "Tema claro" : "Tema escuro"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground ${className}`}
    >
      {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
