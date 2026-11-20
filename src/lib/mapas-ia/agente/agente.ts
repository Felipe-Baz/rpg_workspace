// Laço do agente: conversa com o `ProvedorLlm` ativo, executa as ferramentas sobre uma cópia da cena
// e devolve um plano em passos com os comandos propostos. Não aplica nada na cena real: quem aplica
// é o cliente. Funciona com qualquer LLM que implemente a interface neutra.
import { aplicar } from "../../cena/comandos.ts";
import type { Asset, Cena } from "../../cena/tipos.ts";
import type { Tema } from "../temas/tipos.ts";
import type { ChamadaFerramenta, ContextoProvedor, MensagemLlm, ProvedorLlm } from "../tipos.ts";
import { promptSistema, resumirCena } from "./contexto.ts";
import { ferramentasNeutras, obterFerramenta } from "./ferramentas.ts";
import { validarSchema } from "./schema.ts";
import { ErroFerramenta, LIMITES_PADRAO, type EstadoAgente, type EventoAgente, type Limites, type Passo, type Plano } from "./tipos.ts";

export interface MensagemChat {
  papel: "usuario" | "assistente";
  texto: string;
}

export interface EntradaAgente {
  pedido: string;
  /** Conversa anterior no chat (só texto). */
  conversa?: MensagemChat[];
  cena: Cena;
  assets: Asset[];
  tema?: Tema;
  selecao: string[];
}

export interface DepsAgente {
  llm: ProvedorLlm;
  ctx: ContextoProvedor;
  novoId: () => string;
  limites?: Partial<Limites>;
  agora?: () => number;
  emitir?: (ev: EventoAgente) => void;
}

export const MAX_CONVERSA = 12;

const novoPasso = (id: string, titulo: string): Passo => ({ id, titulo, comandos: [], resumo: [], geracoes: [], avisos: [] });
const vazio = (p: Passo) => !p.comandos.length && !p.geracoes.length;

/** Executa UMA chamada de ferramenta. Devolve o texto para o LLM; em erro, a cena simulada não muda. */
export function executarChamada(estado: EstadoAgente, chamada: Pick<ChamadaFerramenta, "nome" | "argumentos">, limites: Limites = LIMITES_PADRAO): { ok: boolean; texto: string } {
  const erro = (m: string) => ({ ok: false, texto: JSON.stringify({ erro: m }) });
  const f = obterFerramenta(chamada.nome);
  if (!f) return erro(`Ferramenta desconhecida: ${chamada.nome}.`);
  const args = (chamada.argumentos ?? {}) as Record<string, unknown>;
  const invalidos = validarSchema(f.schemaArgs, args);
  if (invalidos.length) return erro(`Argumentos inválidos: ${invalidos.join(" ")}`);
  if (f.nome === "novo_passo" && estado.passos.filter((p) => !vazio(p)).length >= limites.maxPassos)
    return erro(`Limite de ${limites.maxPassos} passos por pedido. Termine o plano.`);

  let r;
  try {
    r = f.executar(estado, args);
  } catch (e) {
    return erro(e instanceof ErroFerramenta ? e.message : `Falha ao executar ${f.nome}.`);
  }
  if (f.consulta || f.nome === "novo_passo") return { ok: true, texto: JSON.stringify(r.resposta) };

  const comandos = r.comandos ?? [];
  if (!comandos.length && !r.geracoes?.length) return { ok: true, texto: JSON.stringify(r.resposta) }; // ex.: reuso em gerar_asset
  if (estado.totalComandos + comandos.length > limites.maxComandos)
    return erro(`Limite de ${limites.maxComandos} ações por pedido atingido. Termine o plano; o mestre pode pedir o resto depois.`);
  if (comandos.length) {
    try {
      estado.cena = aplicar(estado.cena, { tipo: "lote", comandos }).cena;
    } catch (e) {
      return erro(`A cena recusou a ação: ${(e as Error).message}`);
    }
  }
  if (!estado.passos.length) estado.passos.push(novoPasso(estado.novoId(), "Passo 1"));
  const passo = estado.passos[estado.passos.length - 1];
  passo.comandos.push(...comandos);
  passo.resumo.push(...(r.resumo ?? []));
  passo.geracoes.push(...(r.geracoes ?? []));
  for (const a of r.avisos ?? []) if (!passo.avisos.includes(a)) passo.avisos.push(a);
  estado.totalComandos += comandos.length;
  return { ok: true, texto: JSON.stringify(r.resposta) };
}

export async function executarAgente(deps: DepsAgente, entrada: EntradaAgente): Promise<Plano> {
  const limites = { ...LIMITES_PADRAO, ...deps.limites };
  const agora = deps.agora ?? Date.now;
  const emitir = deps.emitir ?? (() => {});
  const inicio = agora();
  const estado: EstadoAgente = {
    cena: entrada.cena,
    assets: [...entrada.assets],
    tema: entrada.tema,
    selecao: entrada.selecao.filter((id) => entrada.cena.objetos.some((o) => o.id === id)),
    passos: [],
    buscas: [],
    novoId: deps.novoId,
    totalComandos: 0,
  };

  const historico = (entrada.conversa ?? []).slice(-MAX_CONVERSA);
  while (historico[0]?.papel === "assistente") historico.shift(); // a conversa sempre começa pelo mestre
  const mensagens: MensagemLlm[] = historico.map((m) => ({ papel: m.papel, texto: m.texto }));
  mensagens.push({
    papel: "usuario",
    texto: `${resumirCena(entrada.cena, entrada.assets, estado.selecao, entrada.tema)}\n\n## Pedido do mestre\n${entrada.pedido}`,
  });

  const ferramentas = ferramentasNeutras();
  const sistema = promptSistema();
  let texto = "";
  let interrompido: string | undefined;
  let emitidos = 0;
  const emitirPassosFechados = (todos: boolean) => {
    const ate = todos ? estado.passos.length : estado.passos.length - 1;
    for (; emitidos < ate; emitidos++) if (!vazio(estado.passos[emitidos])) emitir({ tipo: "passo", passo: estado.passos[emitidos] });
  };

  for (let i = 0; ; i++) {
    if (i >= limites.maxIteracoes) {
      interrompido = "O agente atingiu o limite de rodadas; o plano pode estar incompleto.";
      break;
    }
    if (agora() - inicio > limites.tempoMaxMs) {
      interrompido = "Tempo máximo do pedido atingido; o plano pode estar incompleto.";
      break;
    }
    const r = await deps.llm.conversar(deps.ctx, { sistema, mensagens, ferramentas });
    if (r.texto) {
      texto += (texto ? "\n\n" : "") + r.texto;
      emitir({ tipo: "texto", texto: r.texto });
    }
    mensagens.push({ papel: "assistente", texto: r.texto || undefined, chamadas: r.chamadas.length ? r.chamadas : undefined });
    if (!r.chamadas.length) break;
    for (const c of r.chamadas) {
      const res = executarChamada(estado, c, limites);
      emitir({ tipo: "ferramenta", nome: c.nome, ok: res.ok, mensagem: res.ok ? undefined : (JSON.parse(res.texto).erro as string) });
      mensagens.push({ papel: "ferramenta", texto: res.texto, resultadoDe: { id: c.id, nome: c.nome } });
      emitirPassosFechados(false);
    }
  }
  emitirPassosFechados(true);

  const passos = estado.passos.filter((p) => !vazio(p));
  return { texto, passos, avisos: interrompido ? [interrompido] : [], ...(interrompido ? { interrompido } : {}) };
}
