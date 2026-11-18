import type { Camada, Cena, Grid, ObjetoCena } from "./tipos.ts";

// Toda mutação da cena é um Comando. `aplicar` devolve a nova cena e o comando inverso;
// desfazer = aplicar o inverso. A IA (change 07) usa os mesmos comandos.

export type Comando =
  | { tipo: "adicionarObjeto"; objeto: ObjetoCena; indice?: number }
  | { tipo: "removerObjeto"; id: string }
  | { tipo: "atualizarObjeto"; id: string; patch: Partial<Omit<ObjetoCena, "id">> }
  | { tipo: "adicionarCamada"; camada: Camada; indice?: number }
  | { tipo: "restaurarCamada"; camada: Camada; indice: number; objetos: { objeto: ObjetoCena; indice: number }[] }
  | { tipo: "removerCamada"; id: string }
  | { tipo: "atualizarCamada"; id: string; patch: Partial<Omit<Camada, "id">> }
  | { tipo: "moverCamada"; id: string; indice: number }
  | { tipo: "definirGrid"; grid: Grid | undefined }
  | { tipo: "definirFundo"; fundo: string }
  | { tipo: "redimensionar"; largura: number; altura: number }
  | { tipo: "lote"; comandos: Comando[] };

export type Resultado = { cena: Cena; inverso: Comando };

/** Proporção do canvas (tolerância de 1 px de arredondamento). */
export function mesmaProporcao(a: { largura: number; altura: number }, b: { largura: number; altura: number }) {
  return Math.abs(a.largura * b.altura - b.largura * a.altura) <= Math.max(a.largura, b.largura, a.altura, b.altura);
}

export function validarResolucao(cena: Cena, largura: number, altura: number): string | null {
  if (!(largura > 0 && altura > 0)) return "Tamanho inválido.";
  if (!mesmaProporcao(cena, { largura, altura }))
    return "A proporção do canvas é travada depois de criada: altere só a resolução, mantendo a mesma proporção.";
  return null;
}

const idx = (lista: { id: string }[], id: string) => {
  const i = lista.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`Item não encontrado: ${id}`);
  return i;
};

function inserir<T>(lista: T[], item: T, indice?: number): T[] {
  const i = indice === undefined ? lista.length : Math.max(0, Math.min(lista.length, indice));
  return [...lista.slice(0, i), item, ...lista.slice(i)];
}

export function aplicar(cena: Cena, cmd: Comando): Resultado {
  switch (cmd.tipo) {
    case "adicionarObjeto": {
      if (!cena.camadas.some((c) => c.id === cmd.objeto.camadaId)) throw new Error("Camada inexistente.");
      return {
        cena: { ...cena, objetos: inserir(cena.objetos, cmd.objeto, cmd.indice) },
        inverso: { tipo: "removerObjeto", id: cmd.objeto.id },
      };
    }
    case "removerObjeto": {
      const i = idx(cena.objetos, cmd.id);
      const objeto = cena.objetos[i];
      return {
        cena: { ...cena, objetos: cena.objetos.filter((o) => o.id !== cmd.id) },
        inverso: { tipo: "adicionarObjeto", objeto, indice: i },
      };
    }
    case "atualizarObjeto": {
      const i = idx(cena.objetos, cmd.id);
      const atual = cena.objetos[i];
      const anterior: Record<string, unknown> = {};
      for (const k of Object.keys(cmd.patch)) anterior[k] = (atual as Record<string, unknown>)[k];
      const objetos = cena.objetos.slice();
      objetos[i] = { ...atual, ...cmd.patch };
      return { cena: { ...cena, objetos }, inverso: { tipo: "atualizarObjeto", id: cmd.id, patch: anterior as Partial<ObjetoCena> } };
    }
    case "adicionarCamada":
      return {
        cena: { ...cena, camadas: inserir(cena.camadas, cmd.camada, cmd.indice) },
        inverso: { tipo: "removerCamada", id: cmd.camada.id },
      };
    case "restaurarCamada": {
      let objetos = cena.objetos;
      for (const { objeto, indice } of [...cmd.objetos].sort((a, b) => a.indice - b.indice)) objetos = inserir(objetos, objeto, indice);
      return {
        cena: { ...cena, camadas: inserir(cena.camadas, cmd.camada, cmd.indice), objetos },
        inverso: { tipo: "removerCamada", id: cmd.camada.id },
      };
    }
    case "removerCamada": {
      const i = idx(cena.camadas, cmd.id);
      if (cena.camadas.length <= 1) throw new Error("A cena precisa de ao menos uma camada.");
      const camada = cena.camadas[i];
      const removidos = cena.objetos.flatMap((objeto, indice) => (objeto.camadaId === cmd.id ? [{ objeto, indice }] : []));
      return {
        cena: { ...cena, camadas: cena.camadas.filter((c) => c.id !== cmd.id), objetos: cena.objetos.filter((o) => o.camadaId !== cmd.id) },
        inverso: { tipo: "restaurarCamada", camada, indice: i, objetos: removidos },
      };
    }
    case "atualizarCamada": {
      const i = idx(cena.camadas, cmd.id);
      const atual = cena.camadas[i];
      const anterior: Record<string, unknown> = {};
      for (const k of Object.keys(cmd.patch)) anterior[k] = (atual as Record<string, unknown>)[k];
      const camadas = cena.camadas.slice();
      camadas[i] = { ...atual, ...cmd.patch };
      return { cena: { ...cena, camadas }, inverso: { tipo: "atualizarCamada", id: cmd.id, patch: anterior as Partial<Camada> } };
    }
    case "moverCamada": {
      const de = idx(cena.camadas, cmd.id);
      const camada = cena.camadas[de];
      const resto = cena.camadas.filter((c) => c.id !== cmd.id);
      return {
        cena: { ...cena, camadas: inserir(resto, camada, cmd.indice) },
        inverso: { tipo: "moverCamada", id: cmd.id, indice: de },
      };
    }
    case "definirGrid":
      return { cena: { ...cena, grid: cmd.grid, modo: cmd.grid ? "grid" : "cenario" }, inverso: { tipo: "definirGrid", grid: cena.grid } };
    case "definirFundo":
      return { cena: { ...cena, fundo: cmd.fundo }, inverso: { tipo: "definirFundo", fundo: cena.fundo } };
    case "redimensionar": {
      const erro = validarResolucao(cena, cmd.largura, cmd.altura);
      if (erro) throw new Error(erro);
      return {
        cena: { ...cena, largura: cmd.largura, altura: cmd.altura },
        inverso: { tipo: "redimensionar", largura: cena.largura, altura: cena.altura },
      };
    }
    case "lote": {
      let atual = cena;
      const inversos: Comando[] = [];
      for (const c of cmd.comandos) {
        const r = aplicar(atual, c);
        atual = r.cena;
        inversos.unshift(r.inverso);
      }
      return { cena: atual, inverso: { tipo: "lote", comandos: inversos } };
    }
  }
}

/** Pilha única de desfazer/refazer. Imutável: cada operação devolve a nova cena e o novo histórico. */
export type Historico = { passado: Comando[]; futuro: Comando[] };
export const historicoVazio = (): Historico => ({ passado: [], futuro: [] });

export function executar(cena: Cena, h: Historico, cmd: Comando): { cena: Cena; historico: Historico } {
  const r = aplicar(cena, cmd);
  return { cena: r.cena, historico: { passado: [...h.passado, r.inverso], futuro: [] } };
}

export function desfazer(cena: Cena, h: Historico): { cena: Cena; historico: Historico } {
  const inverso = h.passado[h.passado.length - 1];
  if (!inverso) return { cena, historico: h };
  const r = aplicar(cena, inverso);
  return { cena: r.cena, historico: { passado: h.passado.slice(0, -1), futuro: [...h.futuro, r.inverso] } };
}

export function refazer(cena: Cena, h: Historico): { cena: Cena; historico: Historico } {
  const cmd = h.futuro[h.futuro.length - 1];
  if (!cmd) return { cena, historico: h };
  const r = aplicar(cena, cmd);
  return { cena: r.cena, historico: { passado: [...h.passado, r.inverso], futuro: h.futuro.slice(0, -1) } };
}
