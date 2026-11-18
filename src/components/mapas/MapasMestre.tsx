"use client";

import { useRef, useState } from "react";
import type { Mesa } from "@/lib/mesas";
import CamadaCobertura from "./CamadaCobertura";
import VisorMestre from "./VisorMestre";
import { atualizarMapa, comprimirImagem, criarMapa, excluirMapa, useMapasMestre, type Colecao, type Mapa } from "@/lib/mapas";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

const TEXTOS = {
  mapas: { titulo: "Mapas", novo: "+ Subir mapa", vazio: "Nenhum mapa ainda.", nome: "Nome do mapa", item: "o mapa" },
  imagens: { titulo: "Imagens", novo: "+ Subir imagem", vazio: "Nenhuma imagem ainda.", nome: "Nome da imagem", item: "a imagem" },
};

export default function MapasMestre({ mesa, colecao = "mapas" }: { mesa: Mesa; colecao?: Colecao }) {
  const t = TEXTOS[colecao];
  const { mapas, carregado } = useMapasMestre(mesa.id, true, colecao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function subir(arquivo?: File) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const imagem = await comprimirImagem(arquivo);
      await criarMapa(mesa.id, arquivo.name.replace(/\.[^.]+$/, ""), imagem, colecao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t.titulo}</h2>
        <button
          onClick={() => input.current?.click()}
          disabled={enviando}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : t.novo}
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => subir(e.target.files?.[0])} />
      </div>
      <p className="text-sm text-muted">
        Jogadores só veem {colecao === "mapas" ? "os mapas" : "as imagens"} que você liberar e fazem anotações privadas sobre elas. As imagens são reduzidas automaticamente (~900 KB). Clique numa imagem para abri-la em tela cheia e cobrir áreas ainda não visitadas (os jogadores veem as áreas cobertas).
      </p>
      {erro && <p className="text-sm text-red-500">{erro}</p>}
      {carregado && mapas.length === 0 && <p className="text-muted">{t.vazio}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {mapas.map((m) => (
          <CartaoMapa key={m.id} mesa={mesa} mapa={m} colecao={colecao} />
        ))}
      </div>
    </section>
  );
}

function CartaoMapa({ mesa, mapa, colecao }: { mesa: Mesa; mapa: Mapa; colecao: Colecao }) {
  const t = TEXTOS[colecao];
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(mapa.nome);
  const jogadores = mesa.jogadores.filter((j) => j.uid);

  const alternar = (uid: string) =>
    atualizarMapa(
      mesa.id,
      mapa.id,
      { liberadoPara: mapa.liberadoPara.includes(uid) ? mapa.liberadoPara.filter((u) => u !== uid) : [...mapa.liberadoPara, uid] },
      colecao,
    );

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex justify-center rounded-lg bg-black/60">
        <div onClick={() => setAberto(true)} className="relative cursor-zoom-in leading-[0]" title="Abrir / cobrir salas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapa.imagem} alt={mapa.nome} className="block max-h-44 w-auto max-w-full rounded-lg" />
          <CamadaCobertura cobertas={mapa.cobertas} modo="mostrar" />
        </div>
      </div>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => nome !== mapa.nome && atualizarMapa(mesa.id, mapa.id, { nome }, colecao)}
        className={campo}
        aria-label={t.nome}
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={mapa.todos}
          onChange={(e) => atualizarMapa(mesa.id, mapa.id, { todos: e.target.checked }, colecao)}
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
        onClick={() => confirm(`Excluir ${t.item} "${mapa.nome}"?`) && excluirMapa(mesa.id, mapa.id, colecao)}
        className="text-sm text-muted hover:text-red-500"
      >
        Excluir
      </button>
      {aberto && <VisorMestre mesaId={mesa.id} mapa={mapa} colecao={colecao} onFechar={() => setAberto(false)} />}
    </article>
  );
}
