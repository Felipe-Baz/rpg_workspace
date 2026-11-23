"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Dices, FileText, Map as MapIcon, Search, Table2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { CATEGORIAS, useFichas } from "@/lib/fichas";
import { useMapasJogador, useMapasMestre } from "@/lib/mapas";
import type { Mesa } from "@/lib/mesas";
import type { ItemNav } from "./navegacao";

type Resultado = { id: string; grupo: string; rotulo: string; detalhe?: string; icone: React.ReactNode; executar: () => void };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Busca global (⌘K / Ctrl+K): ferramentas, ações, outras mesas e conteúdo (fichas, mapas, imagens).
export default function PaletaComandos({ mesa, modo, base, itens, outrasMesas, onFechar, onRolador }: {
  mesa: Mesa;
  modo: "mestre" | "jogador";
  base: string; // raiz das rotas de conteúdo (mestre: /mesas/id · jogador: /mesas/id/jogador)
  itens: ItemNav[];
  outrasMesas: Mesa[];
  onFechar: () => void;
  onRolador: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mestre = modo === "mestre";

  // Conteúdo só é carregado enquanto a paleta está aberta.
  const { fichas } = useFichas(mesa.id, uid, true, mestre);
  const mapas = useMapasMestre(mesa.id, mestre, "mapas");
  const mapasJ = useMapasJogador(mesa.id, uid, !mestre, "mapas");
  const imagens = useMapasMestre(mesa.id, mestre, "imagens");
  const imagensJ = useMapasJogador(mesa.id, uid, !mestre, "imagens");

  const ir = (href: string) => () => { router.push(href); onFechar(); };

  const todos = useMemo<Resultado[]>(() => {
    const r: Resultado[] = [];
    itens.forEach((i) => r.push({ id: `nav:${i.href}`, grupo: "Ir para", rotulo: i.rotulo, icone: <i.icone size={16} />, executar: ir(i.href) }));
    r.push({ id: "acao:dados", grupo: "Ações", rotulo: "Abrir rolador de dados", icone: <Dices size={16} />, executar: () => { onFechar(); onRolador(); } });
    outrasMesas.forEach((m) => r.push({ id: `mesa:${m.id}`, grupo: "Trocar de mesa", rotulo: m.nome || "Sem nome", detalhe: m.sistema, icone: <Table2 size={16} />, executar: ir(modo === "jogador" ? `/mesas/${m.id}/jogador` : `/mesas/${m.id}`) }));
    fichas.forEach((f) => {
      const c = CATEGORIAS.find((x) => x.id === f.categoria);
      r.push({ id: `ficha:${f.id}`, grupo: "Fichas", rotulo: f.nome || "Sem nome", detalhe: c?.singular, icone: <FileText size={16} />, executar: ir(`${base}/fichas/${f.categoria}`) });
    });
    [...(mestre ? mapas.mapas : mapasJ.mapas)].forEach((m) => r.push({ id: `mapa:${m.id}`, grupo: "Mapas", rotulo: m.nome || "Mapa", icone: <MapIcon size={16} />, executar: ir(`${base}/mapas`) }));
    [...(mestre ? imagens.mapas : imagensJ.mapas)].forEach((m) => r.push({ id: `img:${m.id}`, grupo: "Imagens", rotulo: m.nome || "Imagem", icone: <MapIcon size={16} />, executar: ir(`${base}/imagens`) }));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, outrasMesas, fichas, mapas.mapas, mapasJ.mapas, imagens.mapas, imagensJ.mapas, mestre, base, modo]);

  const filtrados = useMemo(() => {
    const t = norm(q.trim());
    const lista = t ? todos.filter((x) => norm(`${x.rotulo} ${x.detalhe ?? ""} ${x.grupo}`).includes(t)) : todos.filter((x) => x.grupo === "Ir para" || x.grupo === "Ações");
    return lista.slice(0, 40);
  }, [q, todos]);

  const ativo = Math.min(sel, Math.max(0, filtrados.length - 1));

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { document.getElementById(`pal-${ativo}`)?.scrollIntoView({ block: "nearest" }); }, [ativo]);

  function tecla(e: React.KeyboardEvent) {
    if (e.key === "Escape") onFechar();
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((ativo + 1) % Math.max(1, filtrados.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((ativo - 1 + filtrados.length) % Math.max(1, filtrados.length)); }
    else if (e.key === "Enter") { e.preventDefault(); filtrados[ativo]?.executar(); }
  }

  let grupoAnterior = "";
  return (
    <div className="anim-surgir fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label="Busca global" onKeyDown={tecla} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Buscar ferramentas, fichas, mapas, mesas…"
            aria-label="Buscar"
            className="w-full bg-transparent py-4 text-base outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-border px-1.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {filtrados.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nada encontrado para “{q}”.</li>}
          {filtrados.map((r, i) => {
            const cabecalho = r.grupo !== grupoAnterior;
            grupoAnterior = r.grupo;
            return (
              <li key={r.id} role="presentation">
                {cabecalho && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{r.grupo}</p>}
                <button
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  onMouseMove={() => setSel(i)}
                  onClick={r.executar}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === ativo ? "bg-accent/15 text-accent-soft" : ""}`}
                >
                  <span className="text-muted">{r.icone}</span>
                  <span className="min-w-0 flex-1 truncate">{r.rotulo}</span>
                  {r.detalhe && <span className="text-xs text-muted">{r.detalhe}</span>}
                  {i === ativo && <CornerDownLeft size={14} className="text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-4 border-t border-border px-4 py-2 text-[11px] text-muted">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
}
