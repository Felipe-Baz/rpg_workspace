import type { Camada, Cena, Grid, ObjetoCena, Parede } from "./tipos.ts";
import { obterPerspectiva } from "../mapas-ia/perspectivas/registro.ts";

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
  | { tipo: "definirPerspectiva"; perspectiva: string }
  | { tipo: "definirTema"; temaId: string | undefined }
  | { tipo: "redimensionar"; largura: number; altura: number }
  | { tipo: "definirParedes"; paredes: Parede[] | undefined }
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
    case "definirPerspectiva": {
      const p = obterPerspectiva(cmd.perspectiva);
      if (!p) throw new Error("Perspectiva desconhecida.");
      if (cmd.perspectiva === cena.perspectiva) return { cena, inverso: cmd };
      if (cena.objetos.length > 0)
        throw new Error("A perspectiva não pode ser trocada depois que o mapa tem objetos: remova os objetos antes (os assets de outra perspectiva não combinam).");
      if (cena.modo === "grid" && !p.permiteGrid) throw new Error("Mapas em grid são sempre top-down.");
      return { cena: { ...cena, perspectiva: cmd.perspectiva }, inverso: { tipo: "definirPerspectiva", perspectiva: cena.perspectiva } };
    }
    case "definirTema": {
      const { temaId: _anterior, ...resto } = cena;
      void _anterior;
      return {
        cena: cmd.temaId ? { ...resto, temaId: cmd.temaId } : resto,
        inverso: { tipo: "definirTema", temaId: cena.temaId },
      };
    }
    case "redimensionar": {
      const erro = validarResolucao(cena, cmd.largura, cmd.altura);
      if (erro) throw new Error(erro);
      return {
        cena: { ...cena, largura: cmd.largura, altura: cmd.altura },
        inverso: { tipo: "redimensionar", largura: cena.largura, altura: cena.altura },
      };
    }
    case "definirParedes": {
      const { paredes: _anteriores, ...resto } = cena;
      void _anteriores;
      return {
        cena: cmd.paredes?.length ? { ...resto, paredes: cmd.paredes } : resto,
        inverso: { tipo: "definirParedes", paredes: cena.paredes },
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

/** Quem fez a alteração. Os comandos da IA podem ser destacados e revertidos em bloco. */
export type Autor = "humano" | "ia";

export type MetaComando = {
  autor: Autor;
  /** Passo da IA: cada passo é UMA entrada do histórico (um lote), expansível pelo `resumo`. */
  passo?: { id: string; titulo: string; resumo: string[]; objetos?: string[] };
  /** Esta entrada reverteu, fora de ordem, os passos com estes ids. */
  reverte?: string[];
};

export const HUMANO: MetaComando = { autor: "humano" };

/** `cmd` é o inverso (no passado) ou o comando a refazer (no futuro). */
export type Entrada = { cmd: Comando; meta: MetaComando };

/** Pilha única de desfazer/refazer. Imutável: cada operação devolve a nova cena e o novo histórico. */
export type Historico = { passado: Entrada[]; futuro: Entrada[] };
export const historicoVazio = (): Historico => ({ passado: [], futuro: [] });

export function executar(cena: Cena, h: Historico, cmd: Comando, meta: MetaComando = HUMANO): { cena: Cena; historico: Historico } {
  const r = aplicar(cena, cmd);
  return { cena: r.cena, historico: { passado: [...h.passado, { cmd: r.inverso, meta }], futuro: [] } };
}

export function desfazer(cena: Cena, h: Historico): { cena: Cena; historico: Historico } {
  const e = h.passado[h.passado.length - 1];
  if (!e) return { cena, historico: h };
  const r = aplicar(cena, e.cmd);
  return { cena: r.cena, historico: { passado: h.passado.slice(0, -1), futuro: [...h.futuro, { cmd: r.inverso, meta: e.meta }] } };
}

export function refazer(cena: Cena, h: Historico): { cena: Cena; historico: Historico } {
  const e = h.futuro[h.futuro.length - 1];
  if (!e) return { cena, historico: h };
  const r = aplicar(cena, e.cmd);
  return { cena: r.cena, historico: { passado: [...h.passado, { cmd: r.inverso, meta: e.meta }], futuro: h.futuro.slice(0, -1) } };
}

/**
 * Aplica o que ainda for aplicável e ignora o resto (ex.: o objeto já foi removido à mão).
 * Usado para reverter fora de ordem, quando a cena mudou depois do passo.
 */
export function aplicarTolerante(cena: Cena, cmd: Comando): { cena: Cena; inverso: Comando; ignorados: number } {
  if (cmd.tipo === "lote") {
    let atual = cena;
    let ignorados = 0;
    const inversos: Comando[] = [];
    for (const c of cmd.comandos) {
      const r = aplicarTolerante(atual, c);
      atual = r.cena;
      ignorados += r.ignorados;
      inversos.unshift(r.inverso);
    }
    return { cena: atual, inverso: { tipo: "lote", comandos: inversos }, ignorados };
  }
  try {
    return { ...aplicar(cena, cmd), ignorados: 0 };
  } catch {
    return { cena, inverso: { tipo: "lote", comandos: [] }, ignorados: 1 };
  }
}

/** Ids dos passos da IA revertidos por entradas que ainda estão no passado. */
export const passosRevertidos = (h: Historico) => new Set(h.passado.flatMap((e) => e.meta.reverte ?? []));

/**
 * Reverte só os passos indicados, sem tocar no que veio antes ou depois deles. Vira uma nova
 * entrada do histórico (desfazê-la reaplica os passos).
 */
export function reverterPassos(cena: Cena, h: Historico, ids: string[]): { cena: Cena; historico: Historico; ignorados: number } {
  const ja = passosRevertidos(h);
  const alvo = new Set(ids.filter((id) => !ja.has(id)));
  const entradas = h.passado.filter((e) => e.meta.passo && alvo.has(e.meta.passo.id)).reverse(); // mais recente primeiro
  if (!entradas.length) return { cena, historico: h, ignorados: 0 };
  const r = aplicarTolerante(cena, { tipo: "lote", comandos: entradas.map((e) => e.cmd) });
  const meta: MetaComando = { autor: "humano", reverte: entradas.map((e) => e.meta.passo!.id) };
  return { cena: r.cena, historico: { passado: [...h.passado, { cmd: r.inverso, meta }], futuro: [] }, ignorados: r.ignorados };
}

/** "Reverter ações da IA nesta sessão": desfaz só as entradas de autoria IA; as feitas à mão permanecem. */
export function reverterIa(cena: Cena, h: Historico) {
  const ids = h.passado.filter((e) => e.meta.autor === "ia" && e.meta.passo).map((e) => e.meta.passo!.id);
  return reverterPassos(cena, h, ids);
}
