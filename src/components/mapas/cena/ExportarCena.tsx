"use client";

import { useState } from "react";
import type { OpcoesExport } from "@/lib/cena/render";
import { ASSET_LUZ, type Cena } from "@/lib/cena/tipos";
import { colunasSugeridas, montarUvtt, nomeArquivo, planoGrade } from "@/lib/cena/vtt";
import { tamanhoExport } from "@/lib/cena/geometria";

const btn = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50 disabled:opacity-40";
const campo = "w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground";

/** Lado maior do PNG exportado (o dobro do limite de render, para impressão e VTTs exigentes). */
const LADO_MAX_PNG = 8192;

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const paraBase64 = (b: Blob) =>
  new Promise<string>((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).replace(/^data:[^,]+,/, ""));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(b);
  });

export default function ExportarCena({
  cena,
  nome,
  exportar,
  onFechar,
}: {
  cena: Cena;
  nome: string;
  /** Render da cena no editor com as opções dadas. */
  exportar: (opc: OpcoesExport) => Promise<Blob>;
  onFechar: () => void;
}) {
  const [comGrade, setComGrade] = useState(!!cena.grid);
  const [colunas, setColunas] = useState(String(cena.grid?.colunas ?? colunasSugeridas(cena)));
  const [escala, setEscala] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const nColunas = Math.min(500, Math.max(1, Math.round(Number(colunas) || 1)));
  const plano = planoGrade(cena, nColunas);
  const base = tamanhoExport(cena, LADO_MAX_PNG);
  const largPng = Math.min(base.largura, Math.round(cena.largura * escala));
  // Cenário livre: a grade da exportação é quadrada, com `nColunas` células na largura.
  const gridExport = cena.grid ?? { tipo: "quadrado" as const, colunas: nColunas, linhas: Math.max(1, Math.round(plano.celulas.y)), noRender: false };

  async function rodar(f: () => Promise<void>) {
    setOcupado(true);
    setErro("");
    try {
      await f();
    } catch (e) {
      setErro(
        e instanceof Error && /taint|insecure|cors/i.test(e.message)
          ? "O navegador bloqueou a imagem (CORS). Configure o CORS do bucket do Storage (veja storage-cors.json)."
          : e instanceof Error ? e.message : "Falha ao exportar.",
      );
    } finally {
      setOcupado(false);
    }
  }

  const png = () =>
    rodar(async () => {
      const blob = await exportar({ formato: "png", grade: comGrade, grid: comGrade ? gridExport : undefined, largura: largPng });
      baixar(blob, nomeArquivo(`${nome}${comGrade ? "-grid" : ""}`, "png"));
    });

  // A imagem do VTT vai sem linhas (a mesa virtual desenha o próprio grid), na resolução do grid.
  const vtt = () =>
    rodar(async () => {
      const blob = await exportar({ formato: "png", grade: false, largura: plano.largura });
      const meta = montarUvtt(cena, plano, await paraBase64(blob));
      baixar(new Blob([JSON.stringify(meta)], { type: "application/json" }), nomeArquivo(nome, "dd2vtt"));
    });

  const paredes = cena.paredes?.length ?? 0;
  const luzes = cena.objetos.filter((o) => o.assetId === ASSET_LUZ).length;

  return (
    <div data-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Exportar mapa">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-4 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Exportar mapa</h2>
          <button className={btn} onClick={onFechar}>Fechar</button>
        </div>
        <p className="text-xs text-muted">Exporta o que está no editor (inclusive alterações ainda não salvas).</p>

        {!cena.grid && (
          <label className="flex items-center justify-between gap-2">
            <span>Células na largura <span className="text-muted">(grade da exportação)</span></span>
            <input className={campo} type="number" min={1} max={500} value={colunas} onChange={(e) => setColunas(e.target.value)} />
          </label>
        )}

        <section className="space-y-2 rounded-lg border border-border p-3">
          <h3 className="font-medium">Imagem PNG</h3>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={comGrade} onChange={(e) => setComGrade(e.target.checked)} /> Com grid
          </label>
          <div className="flex items-center gap-2">
            Resolução
            {[1, 2].map((k) => (
              <button key={k} className={`${btn} ${escala === k ? "border-accent bg-accent text-white" : ""}`} onClick={() => setEscala(k)}>{k}x</button>
            ))}
            <span className="text-xs text-muted">{largPng} × {Math.round((largPng * cena.altura) / cena.largura)} px</span>
          </div>
          <button className={btn} disabled={ocupado} onClick={png}>{ocupado ? "Exportando…" : "Baixar PNG"}</button>
        </section>

        <section className="space-y-2 rounded-lg border border-border p-3">
          <h3 className="font-medium">Universal VTT (.dd2vtt)</h3>
          <p className="text-xs text-muted">
            Foundry, Arkenforge e outros importam este formato. Grid de {plano.celulas.x} × {plano.celulas.y} células, {plano.ppg} px por célula
            ({plano.largura} × {plano.altura} px); {paredes} parede(s) e {luzes} luz(es).
          </p>
          {plano.aproximado && <p className="text-xs text-amber-500">O formato só tem grid quadrado: a célula vira a largura do hexágono.</p>}
          <button className={btn} disabled={ocupado} onClick={vtt}>{ocupado ? "Exportando…" : "Baixar .dd2vtt"}</button>
        </section>
        {erro && <p className="rounded-lg bg-red-500/10 p-2 text-red-500">{erro}</p>}
      </div>
    </div>
  );
}
