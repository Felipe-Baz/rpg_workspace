"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Mesa } from "@/lib/mesas";
import CamadaCobertura from "./CamadaCobertura";
import VisorMestre from "./VisorMestre";
import { enviarArquivo, excluirPorUrl, storageConfigurado } from "@/lib/storage";
import { atualizarMapa, comprimirImagem, criarMapa, desvincularCena, excluirMapa, useMapasMestre, type Colecao, type Mapa } from "@/lib/mapas";
import { ehMapaDeCena } from "@/lib/cena/compat";
import { excluirCena } from "@/lib/cena/cenas";
import NovaCena from "./cena/NovaCena";
import TemasMestre from "./cena/TemasMestre";
import ConverterCena from "./ConverterCena";

// O editor (e o PixiJS) só é baixado quando o mestre abre uma cena.
const EditorCena = dynamic(() => import("./cena/EditorCena"), { ssr: false, loading: () => null });

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
  const [novaCena, setNovaCena] = useState(false);
  const [temasAberto, setTemasAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pedidoInicial, setPedidoInicial] = useState<string | undefined>();
  const [convertendoId, setConvertendoId] = useState<string | null>(null);
  const editando = mapas.find((m) => m.id === editandoId);
  const convertendo = mapas.find((m) => m.id === convertendoId);

  async function subir(arquivo?: File) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      // Com Storage configurado, sobe o arquivo (até 15 MB); senão, data URL comprimida.
      let imagem: string;
      if (storageConfigurado()) {
        const ext = arquivo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        imagem = await enviarArquivo(mesa.id, "mapas", arquivo, ext);
      } else {
        imagem = await comprimirImagem(arquivo);
      }
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
        <div className="flex gap-2">
          <button
            onClick={() => input.current?.click()}
            disabled={enviando}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {enviando ? "Enviando…" : t.novo}
          </button>
          {colecao === "mapas" && storageConfigurado() && (
            <button
              onClick={() => setNovaCena(true)}
              className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent-hover hover:bg-accent/10"
            >
              + Nova cena
            </button>
          )}
          {colecao === "mapas" && storageConfigurado() && (
            <button onClick={() => setTemasAberto(true)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-border/50">
              Temas
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => subir(e.target.files?.[0])} />
      </div>
      <p className="text-sm text-muted">
        Jogadores só veem {colecao === "mapas" ? "os mapas" : "as imagens"} que você liberar e fazem anotações privadas sobre elas. As imagens são reduzidas automaticamente (~900 KB). Clique numa imagem para abri-la em tela cheia e cobrir áreas ainda não visitadas (os jogadores veem as áreas cobertas).
      </p>
      {erro && <p className="text-sm text-red-500">{erro}</p>}
      {carregado && mapas.length === 0 && <p className="text-muted">{t.vazio}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {mapas.map((m) => (
          <CartaoMapa key={m.id} mesa={mesa} mapa={m} colecao={colecao} onEditar={() => setEditandoId(m.id)} onConverter={() => setConvertendoId(m.id)} />
        ))}
      </div>
      {temasAberto && <TemasMestre mesaId={mesa.id} onFechar={() => setTemasAberto(false)} />}
      {novaCena && (
        <NovaCena
          mesaId={mesa.id}
          colecao={colecao}
          onCancelar={() => setNovaCena(false)}
          onCriado={(m, descricao) => {
            setNovaCena(false);
            setPedidoInicial(descricao);
            setEditandoId(m.id);
          }}
        />
      )}
      {convertendo && (
        <ConverterCena
          mesaId={mesa.id}
          mapa={convertendo}
          colecao={colecao}
          onFechar={() => setConvertendoId(null)}
          onConvertido={(id) => {
            setConvertendoId(null);
            setEditandoId(id);
          }}
        />
      )}
      {editando && ehMapaDeCena(editando) && (
        <EditorCena
          mesaId={mesa.id}
          mapa={editando}
          colecao={colecao}
          pedidoInicial={pedidoInicial}
          onFechar={() => {
            setEditandoId(null);
            setPedidoInicial(undefined);
          }}
        />
      )}
    </section>
  );
}

function CartaoMapa({ mesa, mapa, colecao, onEditar, onConverter }: { mesa: Mesa; mapa: Mapa; colecao: Colecao; onEditar: () => void; onConverter: () => void }) {
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
          {ehMapaDeCena(mapa) && (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-normal text-white">
              Cena
            </span>
          )}
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
      {ehMapaDeCena(mapa) && (
        <div className="flex gap-3 text-sm">
          <button onClick={onEditar} className="font-medium text-accent-hover hover:underline">
            Editar cena
          </button>
          <button
            onClick={async () => {
              if (!confirm("Desvincular a cena? O mapa fica só com a imagem atual e a cena é apagada.")) return;
              await desvincularCena(mesa.id, mapa.id, colecao);
              await excluirCena(mesa.id, mapa.cenaId!);
            }}
            className="text-muted hover:text-red-500"
          >
            Desvincular cena
          </button>
        </div>
      )}
      {colecao === "mapas" && !ehMapaDeCena(mapa) && storageConfigurado() && (
        <button onClick={onConverter} className="block text-sm font-medium text-accent-hover hover:underline" title="Cria um novo mapa de cena com os objetos separados; este mapa não muda">
          Converter em cena
        </button>
      )}
      <button
        onClick={async () => {
          if (!confirm(`Excluir ${t.item} "${mapa.nome}"?`)) return;
          await excluirMapa(mesa.id, mapa.id, colecao);
          if (ehMapaDeCena(mapa)) await excluirCena(mesa.id, mapa.cenaId!);
          await excluirPorUrl(mapa.imagem);
        }}
        className="text-sm text-muted hover:text-red-500"
      >
        Excluir
      </button>
      {aberto && <VisorMestre mesaId={mesa.id} mapa={mapa} colecao={colecao} onFechar={() => setAberto(false)} />}
    </article>
  );
}
