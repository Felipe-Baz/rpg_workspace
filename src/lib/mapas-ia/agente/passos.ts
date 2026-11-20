// Lado do cliente (puro): prévia do plano, troca dos ids provisórios e aplicação de um passo como
// UMA entrada do histórico, de autoria IA.
import { aplicarTolerante, type Comando, type Historico } from "../../cena/comandos.ts";
import type { Cena } from "../../cena/tipos.ts";
import type { Passo } from "./tipos.ts";

/** Troca ids de assets provisórios pelos reais nos comandos (e remove ações cujo asset não foi gerado). */
export function substituirIds(comandos: Comando[], mapa: Record<string, string>, provisorio: (id: string) => boolean): Comando[] {
  const out: Comando[] = [];
  for (const c of comandos) {
    if (c.tipo === "lote") out.push({ tipo: "lote", comandos: substituirIds(c.comandos, mapa, provisorio) });
    else if (c.tipo === "adicionarObjeto" && provisorio(c.objeto.assetId)) {
      const real = mapa[c.objeto.assetId];
      if (real) out.push({ ...c, objeto: { ...c.objeto, assetId: real } });
    } else if (c.tipo === "atualizarObjeto" && c.patch.assetId && provisorio(c.patch.assetId)) {
      const real = mapa[c.patch.assetId];
      if (real) out.push({ ...c, patch: { ...c.patch, assetId: real } });
    } else out.push(c);
  }
  return out;
}

/** Cena como ficaria com os passos aplicados (sem histórico). */
export function previa(cena: Cena, passos: Pick<Passo, "comandos">[]): Cena {
  return passos.reduce((c, p) => aplicarTolerante(c, { tipo: "lote", comandos: p.comandos }).cena, cena);
}

/**
 * Aplica o passo como uma única entrada de undo, de autoria IA. Ações que não se aplicam mais (ex.: o
 * mestre apagou o objeto) são ignoradas e contadas.
 */
export function aplicarPasso(cena: Cena, h: Historico, passo: Pick<Passo, "id" | "titulo" | "resumo" | "comandos">): { cena: Cena; historico: Historico; ignorados: number } {
  const r = aplicarTolerante(cena, { tipo: "lote", comandos: passo.comandos });
  return {
    cena: r.cena,
    historico: {
      passado: [
        ...h.passado,
        { cmd: r.inverso, meta: { autor: "ia", passo: { id: passo.id, titulo: passo.titulo, resumo: passo.resumo, objetos: objetosDoPasso(passo) } } },
      ],
      futuro: [],
    },
    ignorados: r.ignorados,
  };
}

/** Ids provisórios de assets que os comandos usam (precisam de geração antes de aplicar). */
export function provisoriosUsados(comandos: Comando[], provisorio: (id: string) => boolean): string[] {
  const ids = new Set<string>();
  const visitar = (c: Comando) => {
    if (c.tipo === "lote") c.comandos.forEach(visitar);
    else if (c.tipo === "adicionarObjeto" && provisorio(c.objeto.assetId)) ids.add(c.objeto.assetId);
    else if (c.tipo === "atualizarObjeto" && c.patch.assetId && provisorio(c.patch.assetId)) ids.add(c.patch.assetId);
  };
  comandos.forEach(visitar);
  return [...ids];
}

/** Ids dos objetos que o passo cria ou altera (para destacar na prévia). */
export function objetosDoPasso(passo: Pick<Passo, "comandos">): string[] {
  const ids: string[] = [];
  const visitar = (c: Comando) => {
    if (c.tipo === "lote") c.comandos.forEach(visitar);
    else if (c.tipo === "adicionarObjeto") ids.push(c.objeto.id);
    else if (c.tipo === "atualizarObjeto") ids.push(c.id);
  };
  passo.comandos.forEach(visitar);
  return ids;
}
