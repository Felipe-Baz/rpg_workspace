"use client";

import { useState } from "react";
import { uid } from "@/lib/mesas";
import { criarMapa, type Colecao, type Mapa } from "@/lib/mapas";
import { enviarArquivo } from "@/lib/storage";
import { salvarCena } from "@/lib/cena/cenas";
import { criarCenaVazia, type OpcoesCena } from "@/lib/cena/criar";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));

/** Imagem inicial (cor de fundo) para o mapa de cena já nascer com um `imagem` válido. */
function renderVazio(largura: number, altura: number, cor: string): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, largura, altura);
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar a imagem."))), "image/jpeg", 0.9));
}

export default function NovaCena({
  mesaId,
  colecao,
  onCriado,
  onCancelar,
}: {
  mesaId: string;
  colecao: Colecao;
  onCriado: (mapa: Mapa) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState<"grid" | "cenario">("grid");
  const [tipoGrid, setTipoGrid] = useState<"quadrado" | "hex">("quadrado");
  const [colunas, setColunas] = useState("30");
  const [linhas, setLinhas] = useState("20");
  const [largura, setLargura] = useState("1920");
  const [altura, setAltura] = useState("1080");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  async function criar() {
    setCriando(true);
    setErro("");
    try {
      const nomeFinal = nome.trim() || "Mapa de cena";
      const op: OpcoesCena =
        modo === "grid"
          ? { nome: nomeFinal, modo, tipoGrid, colunas: num(colunas, 2, 100), linhas: num(linhas, 2, 100) }
          : { nome: nomeFinal, modo, largura: num(largura, 256, 4096), altura: num(altura, 256, 4096) };
      const cena = criarCenaVazia(op, uid);
      const mapaId = uid();
      const blob = await renderVazio(cena.largura, cena.altura, cena.fundo);
      const url = await enviarArquivo(mesaId, "mapas", blob, "jpg");
      await salvarCena(mesaId, { ...cena, mapaId });
      const mapa = await criarMapa(mesaId, nomeFinal, url, colecao, { id: mapaId, origem: "cena", cenaId: cena.id });
      onCriado(mapa);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar a cena.");
      setCriando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Novo mapa de cena</h3>
        <input className={campo} placeholder="Nome do mapa" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="flex gap-2">
          {(["grid", "cenario"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${modo === m ? "border-violet-600 bg-violet-600 text-white" : "border-border"}`}
            >
              {m === "grid" ? "Com grid" : "Cenário livre"}
            </button>
          ))}
        </div>
        {modo === "grid" ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="col-span-2">
              Tipo de célula
              <select className={campo} value={tipoGrid} onChange={(e) => setTipoGrid(e.target.value as "quadrado" | "hex")}>
                <option value="quadrado">Quadrada</option>
                <option value="hex">Hexagonal</option>
              </select>
            </label>
            <label>
              Colunas
              <input className={campo} type="number" min={2} max={100} value={colunas} onChange={(e) => setColunas(e.target.value)} />
            </label>
            <label>
              Linhas
              <input className={campo} type="number" min={2} max={100} value={linhas} onChange={(e) => setLinhas(e.target.value)} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>
              Largura (px)
              <input className={campo} type="number" min={256} max={4096} value={largura} onChange={(e) => setLargura(e.target.value)} />
            </label>
            <label>
              Altura (px)
              <input className={campo} type="number" min={256} max={4096} value={altura} onChange={(e) => setAltura(e.target.value)} />
            </label>
          </div>
        )}
        <p className="text-xs text-muted">A proporção do canvas fica travada depois de criada. O lado maior é limitado a 4096 px.</p>
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border border-border px-3 py-2 text-sm" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={criar} disabled={criando}>
            {criando ? "Criando…" : "Criar e abrir editor"}
          </button>
        </div>
      </div>
    </div>
  );
}
