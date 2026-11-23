"use client";

import { useRef, useState } from "react";
import { comprimirImagem } from "@/lib/mapas";
import { definirFotoPersonagem } from "@/lib/mesas";

/** Foto redonda do personagem. Com `editavel`, permite enviar/trocar/remover a imagem. */
export default function AvatarPersonagem({
  mesaId,
  jogadorId,
  foto,
  nome,
  editavel = false,
  tamanho = 56,
}: {
  mesaId: string;
  jogadorId: string;
  foto?: string;
  nome: string;
  editavel?: boolean;
  tamanho?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(arquivo?: File) {
    if (!arquivo) return;
    setErro("");
    setOcupado(true);
    try {
      await definirFotoPersonagem(mesaId, jogadorId, await comprimirImagem(arquivo, 256, 40_000));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setOcupado(false);
      if (input.current) input.current.value = "";
    }
  }

  const imagem = (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-border/40 font-semibold text-muted"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho / 2.4 }}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt={nome} className="h-full w-full object-cover" />
      ) : (
        (nome.trim()[0] ?? "?").toUpperCase()
      )}
    </span>
  );

  if (!editavel) return imagem;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={ocupado}
        title={foto ? "Trocar foto" : "Adicionar foto"}
        className="rounded-full hover:opacity-80 disabled:opacity-50"
      >
        {imagem}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => enviar(e.target.files?.[0])}
      />
      <div className="flex gap-2 text-[11px]">
        <button type="button" onClick={() => input.current?.click()} disabled={ocupado} className="text-accent-hover hover:underline">
          {ocupado ? "Enviando…" : foto ? "Trocar" : "Foto"}
        </button>
        {foto && !ocupado && (
          <button
            type="button"
            onClick={() => definirFotoPersonagem(mesaId, jogadorId, "").catch(() => setErro("Não foi possível remover."))}
            className="text-muted hover:text-red-500"
          >
            Remover
          </button>
        )}
      </div>
      {erro && <p role="alert" className="max-w-24 text-center text-[11px] text-red-500">{erro}</p>}
    </div>
  );
}
