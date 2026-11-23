"use client";

import Dialog from "./Dialog";

// Substitui window.confirm(): mensagem clara e botão de ação com o verbo da operação.
export default function ConfirmDialog({
  titulo,
  texto,
  confirmar,
  perigo = false,
  onConfirm,
  onClose,
}: {
  titulo: string;
  texto: string;
  confirmar: string;
  perigo?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog titulo={titulo} onClose={onClose} largura="max-w-sm">
      <p className="mb-6 text-sm text-muted">{texto}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancelar</button>
        <button
          data-foco
          onClick={() => { onConfirm(); onClose(); }}
          className={`rounded-lg px-4 py-2 font-medium text-white ${perigo ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-strong"}`}
        >
          {confirmar}
        </button>
      </div>
    </Dialog>
  );
}
