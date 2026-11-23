"use client";

import { useMemo, useState } from "react";
import { adotarAssetPublico, atualizarAsset, excluirAsset, useAssetsPublicos } from "@/lib/cena/cenas";
import type { Asset, Cena, TipoAsset } from "@/lib/cena/tipos";
import { TIPOS_ASSET, filtrarAssets, normalizarTags, tipoDe, type UsoEmCena } from "@/lib/mapas-ia/assets/biblioteca";
import type { Tema } from "@/lib/mapas-ia/temas/tipos";
import GerarAsset from "./GerarAsset";

const campo = "w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted";
const btn = "rounded-lg border border-border px-2 py-1 text-xs hover:bg-border/50 disabled:opacity-40";

type Gerador = { base?: Asset; modo?: "variacoes" | "regenerar"; instrucao?: string } | null;

const INSTRUCAO_COMPLETAR =
  "Complete this object: it was cut out of a map and parts of it are missing or hidden. Redraw it whole, with the same shape, colors, view and art style.";

export default function BibliotecaAssets({
  mesaId,
  cena,
  assets,
  temas,
  assetSel,
  onSelecionar,
  onUpload,
  enviando,
  onErro,
}: {
  mesaId: string;
  cena: Cena | null;
  assets: Asset[];
  temas: Tema[];
  assetSel: string | null;
  onSelecionar: (id: string | null) => void;
  onUpload: () => void;
  enviando: boolean;
  onErro: (msg: string) => void;
}) {
  const [escopo, setEscopo] = useState<"mesa" | "publica">("mesa");
  const publicos = useAssetsPublicos();
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoAsset | "">("");
  const [temaId, setTemaId] = useState("");
  const [soPerspectiva, setSoPerspectiva] = useState(true);
  const [gerador, setGerador] = useState<Gerador>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [tagsEdit, setTagsEdit] = useState("");
  const [exclusao, setExclusao] = useState<{ asset: Asset; usos: UsoEmCena[]; substituto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const visiveis = useMemo(
    () => filtrarAssets(escopo === "mesa" ? assets : publicos, { busca, tipo, temaId: temaId || undefined, perspectivaId: soPerspectiva && cena ? cena.perspectiva : undefined }),
    [assets, publicos, escopo, busca, tipo, temaId, soPerspectiva, cena],
  );
  const selecionado = assets.find((a) => a.id === detalhe) ?? null;
  const assetAtual = assetSel ? assets.find((a) => a.id === assetSel) : null;

  async function tentarExcluir(a: Asset, substitutoId?: string) {
    setOcupado(true);
    try {
      const r = await excluirAsset(mesaId, a, substitutoId);
      if (r.ok) {
        setExclusao(null);
        setDetalhe(null);
        if (assetSel === a.id) onSelecionar(null);
      } else {
        // em uso: mostra as cenas e pede um substituto (ou cancela)
        setExclusao({ asset: a, usos: r.usos, substituto: "" });
      }
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Falha ao excluir o asset.");
    } finally {
      setOcupado(false);
    }
  }

  async function salvarTags() {
    if (!selecionado) return;
    try {
      await atualizarAsset(mesaId, selecionado.id, { tags: normalizarTags(tagsEdit) });
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Falha ao salvar as tags.");
    }
  }

  const candidatosSubstituto = exclusao ? assets.filter((x) => x.id !== exclusao.asset.id && tipoDe(x) === tipoDe(exclusao.asset)) : [];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button className={`${btn} flex-1`} onClick={onUpload} disabled={enviando}>{enviando ? "Enviando…" : "+ Enviar PNG"}</button>
        <button className={`${btn} flex-1 border-accent text-accent-soft`} onClick={() => setGerador({})} disabled={!cena}>✨ Gerar</button>
      </div>

      <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Biblioteca">
        {([["mesa", "Da mesa"], ["publica", "Pública (IA)"]] as const).map(([k, rot]) => (
          <button key={k} role="tab" aria-selected={escopo === k} className={`${btn} ${escopo === k ? "border-accent bg-accent text-white" : ""}`} onClick={() => { setEscopo(k); setDetalhe(null); }}>{rot}</button>
        ))}
      </div>
      {escopo === "publica" && <p className="text-xs text-muted">Assets gerados por IA em qualquer mesa. Ao escolher um, ele vem para a biblioteca desta mesa. PNGs enviados nunca são públicos.</p>}
      <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por tag ou nome" aria-label="Buscar assets" />
      <div className="grid grid-cols-2 gap-1">
        <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAsset | "")} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {TIPOS_ASSET.map((t) => <option key={t.tipo} value={t.tipo}>{t.nome}</option>)}
        </select>
        <select className={campo} value={temaId} onChange={(e) => setTemaId(e.target.value)} aria-label="Tema">
          <option value="">Todos os temas</option>
          {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-1 text-xs text-muted">
        <input type="checkbox" checked={soPerspectiva} onChange={(e) => setSoPerspectiva(e.target.checked)} /> Só da perspectiva da cena
      </label>

      <p className="text-xs text-muted">
        {assetAtual ? `Carimbo: ${assetAtual.nome}. Clique no mapa (Esc cancela).` : "Escolha um asset e clique no mapa para carimbar."}
      </p>
      {visiveis.length === 0 && <p className="text-xs text-muted">{(escopo === "mesa" ? assets : publicos).length === 0 ? "A biblioteca está vazia." : "Nenhum asset com esses filtros."}</p>}
      <div className="grid grid-cols-3 gap-1.5 md:grid-cols-2">
        {visiveis.map((a) => (
          <div key={a.id} className={`relative rounded-lg border p-1 ${assetSel === a.id ? "border-accent bg-accent/20" : "border-border"}`}>
            <button
              className="block w-full"
              onClick={async () => {
                if (escopo === "mesa") return onSelecionar(assetSel === a.id ? null : a.id);
                try {
                  await adotarAssetPublico(mesaId, a);
                  setEscopo("mesa");
                  onSelecionar(a.id);
                } catch (e) {
                  onErro(e instanceof Error ? e.message : "Falha ao trazer o asset para a mesa.");
                }
              }}
              title={a.nome}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.nome} className="mx-auto h-14 w-full object-contain" />
            </button>
            {escopo === "mesa" && <button
              className="absolute right-0.5 top-0.5 rounded bg-background/80 px-1 text-[10px] leading-4 hover:bg-border"
              aria-label={`Detalhes de ${a.nome}`}
              title="Detalhes"
              onClick={() => { setDetalhe(detalhe === a.id ? null : a.id); setTagsEdit((a.tags ?? []).join(", ")); }}
            >
              ⋯
            </button>}
            {a.origem === "ia" && <span className="absolute bottom-0.5 left-0.5 rounded bg-accent/80 px-1 text-[9px] leading-4 text-white">IA</span>}
            {a.incompleto && <span className="absolute bottom-0.5 right-0.5 rounded bg-warn/90 px-1 text-[9px] leading-4 text-white" title="Cortado ou encoberto no mapa original">incompleto</span>}
            {a.naoRepetivel && <span className="absolute bottom-0.5 right-0.5 rounded bg-warn/90 px-1 text-[9px] leading-4 text-white" title="A emenda é visível ao repetir">emenda</span>}
          </div>
        ))}
      </div>

      {selecionado && (
        <div className="space-y-1.5 rounded-lg border border-border p-2 text-xs">
          <p className="truncate font-medium">{selecionado.nome}</p>
          <p className="text-muted">
            {TIPOS_ASSET.find((t) => t.tipo === tipoDe(selecionado))?.nome} · {selecionado.origem === "ia" ? "gerado por IA" : selecionado.convertidoDe ? "recortado de um mapa" : "enviado"}
            {selecionado.temaId ? ` · ${temas.find((t) => t.id === selecionado.temaId)?.nome ?? "tema removido"}` : ""}
          </p>
          <label className="block text-muted">
            Tags
            <input className={campo} value={tagsEdit} onChange={(e) => setTagsEdit(e.target.value)} onBlur={salvarTags} placeholder="árvore, carvalho" />
          </label>
          <div className="flex flex-wrap gap-1">
            {selecionado.origem === "ia" && (
              <>
                <button className={btn} onClick={() => setGerador({ base: selecionado, modo: "variacoes" })}>Variações</button>
                <button className={btn} onClick={() => setGerador({ base: selecionado, modo: "regenerar" })}>Regenerar</button>
              </>
            )}
            {selecionado.incompleto && (
              <button className={`${btn} border-warn text-warn`} onClick={() => setGerador({ base: selecionado, modo: "regenerar", instrucao: INSTRUCAO_COMPLETAR })} title="Gera uma versão inteira do objeto; a atual fica até você descartá-la">
                Completar por IA
              </button>
            )}
            <button className={`${btn} text-danger`} disabled={ocupado} onClick={() => tentarExcluir(selecionado)}>🗑 Excluir</button>
          </div>
        </div>
      )}

      {exclusao && (
        <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Asset em uso">
          <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-background p-4 text-sm">
            <h2 className="text-base font-semibold">“{exclusao.asset.nome}” está em uso</h2>
            <p className="text-muted">Estas cenas usam o asset:</p>
            <ul className="list-inside list-disc">
              {exclusao.usos.map((u) => <li key={u.cenaId}>{u.nome} ({u.objetos} objeto{u.objetos > 1 ? "s" : ""})</li>)}
            </ul>
            <label className="block text-xs text-muted">
              Substituir por
              <select className={campo} value={exclusao.substituto} onChange={(e) => setExclusao({ ...exclusao, substituto: e.target.value })}>
                <option value="">Escolha um asset…</option>
                {candidatosSubstituto.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger disabled:opacity-50" disabled={!exclusao.substituto || ocupado} onClick={() => tentarExcluir(exclusao.asset, exclusao.substituto)}>
                {ocupado ? "Substituindo…" : "Substituir e excluir"}
              </button>
              <button className={btn} onClick={() => setExclusao(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {gerador && cena && (
        <GerarAsset
          mesaId={mesaId}
          assets={assets}
          temas={temas}
          perspectivaId={cena.perspectiva}
          temaIdInicial={cena.temaId}
          base={gerador.base}
          modoBase={gerador.modo}
          instrucaoInicial={gerador.instrucao}
          onUsar={(id) => onSelecionar(id)}
          onFechar={() => setGerador(null)}
        />
      )}
    </div>
  );
}
