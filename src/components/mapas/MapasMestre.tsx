"use client";

import { useRef, useState } from "react";
import type { Mesa } from "@/lib/mesas";
import { atualizarMapa, comprimirImagem, criarMapa, excluirMapa, useMapasMestre, type Mapa } from "@/lib/mapas";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function MapasMestre({ mesa }: { mesa: Mesa }) {
  const { mapas, carregado } = useMapasMestre(mesa.id, true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function subir(arquivo?: File) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const imagem = await comprimirImagem(arquivo);
      await criarMapa(mesa.id, arquivo.name.replace(/\.[^.]+$/, ""), imagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar o mapa.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Mapas</h2>
        <button
          onClick={() => input.current?.click()}
          disabled={enviando}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "+ Subir mapa"}
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => subir(e.target.files?.[0])} />
      </div>
      <p className="text-sm text-muted">
        Jogadores só veem os mapas que você liberar. As imagens são reduzidas automaticamente (~900 KB).
      </p>
      {erro && <p className="text-sm text-red-500">{erro}</p>}
      {carregado && mapas.length === 0 && <p className="text-muted">Nenhum mapa ainda.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {mapas.map((m) => (
          <CartaoMapa key={m.id} mesa={mesa} mapa={m} />
        ))}
      </div>
    </section>
  );
}

function CartaoMapa({ mesa, mapa }: { mesa: Mesa; mapa: Mapa }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(mapa.nome);
  const jogadores = mesa.jogadores.filter((j) => j.uid);

  const alternar = (uid: string) =>
    atualizarMapa(mesa.id, mapa.id, {
      liberadoPara: mapa.liberadoPara.includes(uid)
        ? mapa.liberadoPara.filter((u) => u !== uid)
        : [...mapa.liberadoPara, uid],
    });

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapa.imagem}
        alt={mapa.nome}
        onClick={() => setAberto(true)}
        className="h-44 w-full cursor-zoom-in rounded-lg object-cover"
      />
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => nome !== mapa.nome && atualizarMapa(mesa.id, mapa.id, { nome })}
        className={campo}
        aria-label="Nome do mapa"
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={mapa.todos}
          onChange={(e) => atualizarMapa(mesa.id, mapa.id, { todos: e.target.checked })}
        />
        Liberar para todos
      </label>
      <div className="space-y-1 border-t border-border pt-2">
        <p className="text-xs uppercase tracking-wider text-muted">Liberar individualmente</p>
        {jogadores.length === 0 && <p className="text-sm text-muted">Nenhum jogador com personagem ainda.</p>}
        {jogadores.map((j) => (
          <label key={j.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mapa.liberadoPara.includes(j.uid!)} onChange={() => alternar(j.uid!)} />
            {j.personagem || j.nome || "Jogador"}
          </label>
        ))}
      </div>
      <button
        onClick={() => confirm(`Excluir o mapa "${mapa.nome}"?`) && excluirMapa(mesa.id, mapa.id)}
        className="text-sm text-muted hover:text-red-500"
      >
        Excluir
      </button>
      {aberto && (
        <div
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapa.imagem} alt={mapa.nome} className="max-h-full max-w-full" />
        </div>
      )}
    </article>
  );
}
