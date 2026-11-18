import type { CapacidadesImagem, CapacidadesLlm, ImagemBase64 } from "./tipos.ts";

export interface PedidoAsset {
  /** O resultado precisa de fundo transparente (sprites). */
  precisaAlfa: boolean;
  referencias?: ImagemBase64[];
  /** Descrição textual do estilo (perfil), usada quando não há referências. */
  perfilEstiloTexto?: string;
}

export interface PlanoGeracao {
  /** Pedir fundo chapado de cor-chave e remover localmente depois. */
  removerFundoLocal: boolean;
  referencias: ImagemBase64[];
  /** O estilo só pode ir como texto (provedor sem imagens de referência). */
  estiloSoTexto: boolean;
  avisos: string[];
}

/** Compõe as etapas necessárias conforme as capacidades declaradas (degradação). */
export function planejarGeracao(cap: CapacidadesImagem, pedido: PedidoAsset): PlanoGeracao {
  const avisos: string[] = [];
  const refs = pedido.referencias ?? [];
  const aceitas = cap.imagensReferencia > 0 ? refs.slice(0, cap.imagensReferencia) : [];
  const estiloSoTexto = refs.length > 0 && cap.imagensReferencia === 0;
  if (estiloSoTexto) avisos.push("O provedor não aceita imagens de referência; o estilo vai só como texto.");
  if (refs.length > aceitas.length && cap.imagensReferencia > 0) avisos.push(`Usando ${aceitas.length} de ${refs.length} referências.`);
  const removerFundoLocal = pedido.precisaAlfa && !cap.alfaNativo;
  return { removerFundoLocal, referencias: aceitas, estiloSoTexto, avisos };
}

export type FuncaoLlm = "agente" | "analise-tema";

/** Verifica se o LLM ativo atende a função; devolve aviso + alternativa quando não. */
export function verificarLlm(cap: CapacidadesLlm, funcao: FuncaoLlm): { ok: true } | { ok: false; aviso: string; alternativa: string } {
  if (funcao === "analise-tema" && !cap.visao) {
    return { ok: false, aviso: "O LLM ativo não tem visão, necessária para analisar o tema.", alternativa: "Preencha o perfil de tema manualmente." };
  }
  if (funcao === "agente" && !cap.ferramentas) {
    return { ok: false, aviso: "O LLM ativo não suporta ferramentas.", alternativa: "Escolha outro LLM nas configurações de IA." };
  }
  return { ok: true };
}
