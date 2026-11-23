"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CATEGORIAS, useFichas } from "@/lib/fichas";
import { useMapasJogador } from "@/lib/mapas";
import { gravarVistos, lerVistos, useVersaoVistos } from "@/lib/vistos";
import type { Aviso } from "./ShellBase";

type Secao = { chave: string; href: string; rotulo: string; itens: { id: string; nome: string }[]; pronto: boolean };

/**
 * Conteúdo liberado pelo mestre que o jogador ainda não abriu (mapas, imagens e fichas do mestre).
 * Na primeira visita tudo vira "visto" (baseline) para não avisar do que já existia.
 */
export function useNovidades(mesaId: string, uid: string, base: string) {
  const pathname = usePathname();
  useVersaoVistos(); // re-renderiza quando algum "visto" é gravado
  const mapas = useMapasJogador(mesaId, uid, true, "mapas");
  const imagens = useMapasJogador(mesaId, uid, true, "imagens");
  const fichas = useFichas(mesaId, uid, true);

  const secoes: Secao[] = [
    { chave: "mapas", href: `${base}/mapas`, rotulo: "Novo mapa", itens: mapas.mapas.map((m) => ({ id: m.id, nome: m.nome || "Mapa" })), pronto: mapas.carregado },
    { chave: "imagens", href: `${base}/imagens`, rotulo: "Nova imagem", itens: imagens.mapas.map((m) => ({ id: m.id, nome: m.nome || "Imagem" })), pronto: imagens.carregado },
    ...CATEGORIAS.map((c) => ({
      chave: `fichas-${c.id}`,
      href: `${base}/fichas/${c.id}`,
      rotulo: `Nova ficha (${c.singular})`,
      itens: fichas.fichas.filter((f) => f.categoria === c.id && f.donoUid !== uid).map((f) => ({ id: f.id, nome: f.nome || c.singular })),
      pronto: fichas.carregado,
    })),
  ];

  const chaveDe = (s: Secao) => `vistos:${mesaId}:${uid}:${s.chave}`;

  useEffect(() => {
    for (const s of secoes) {
      if (!s.pronto || !uid) continue;
      const k = chaveDe(s);
      const vistos = lerVistos(k);
      const ids = s.itens.map((i) => i.id);
      const estaNaSecao = pathname === s.href || pathname.startsWith(`${s.href}/`);
      if (vistos === null) gravarVistos(k, ids); // baseline
      else if (estaNaSecao && ids.some((id) => !vistos.includes(id))) gravarVistos(k, [...new Set([...vistos, ...ids])]);
    }
  });

  const badges: Record<string, number> = {};
  const avisos: Aviso[] = [];
  for (const s of secoes) {
    if (!s.pronto || !uid) continue;
    const vistos = lerVistos(chaveDe(s));
    if (!vistos) continue;
    const novos = s.itens.filter((i) => !vistos.includes(i.id));
    if (novos.length) badges[s.href] = novos.length;
    novos.forEach((n) => avisos.push({ texto: `${s.rotulo}: ${n.nome}`, href: s.href }));
  }
  return { badges, avisos };
}
