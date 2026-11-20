// O que o LLM enxerga: resumo textual da cena, seleção, perfil do tema e assets (nome e tags).
// Nunca imagens nem chaves, e nada de outras mesas.
import type { Asset, Cena } from "../../cena/tipos.ts";
import { ASSET_LUZ, ASSET_ROTULO } from "../../cena/tipos.ts";
import { assetServe, obterPerspectiva } from "../perspectivas/registro.ts";
import type { Tema } from "../temas/tipos.ts";
import { tipoDe } from "../assets/biblioteca.ts";
import { deEscala, deFracao, descreverUnidades } from "./coords.ts";

export const MAX_OBJETOS_LISTADOS = 120;
export const MAX_ASSETS_LISTADOS = 80;

const nome = (assets: Map<string, Asset>, id: string) =>
  id === ASSET_LUZ ? "luz" : id === ASSET_ROTULO ? "rótulo" : (assets.get(id)?.nome ?? "(asset ausente)");

export function resumirCena(cena: Cena, assets: Asset[], selecao: string[], tema?: Tema): string {
  const porId = new Map(assets.map((a) => [a.id, a]));
  const persp = obterPerspectiva(cena.perspectiva);
  const l: string[] = [];
  l.push(`# Cena "${cena.nome}"`);
  l.push(
    cena.grid
      ? `Modo: grid ${cena.grid.tipo} ${cena.grid.colunas}x${cena.grid.linhas} células (top-down). Canvas ${cena.largura}x${cena.altura}px.`
      : `Modo: cenário livre ${cena.largura}x${cena.altura}px, perspectiva ${persp?.nome ?? cena.perspectiva}.`,
  );
  l.push(`Unidades das ferramentas: ${descreverUnidades(cena)}. Tamanhos: ${cena.grid ? "largura em células" : "% da largura do mapa"}.`);
  if (persp?.ordenacao === "porY") l.push("Ordenação isométrica: quem está mais abaixo (y maior) aparece na frente; não gire objetos.");
  l.push(`Fundo: ${cena.fundo}.`);
  l.push(`Camadas (de baixo para cima): ${cena.camadas.map((c) => `${c.nome}${c.visivel ? "" : " [oculta]"}${c.travada ? " [travada]" : ""}`).join(", ")}.`);

  // Contagem por asset.
  const contagem = new Map<string, number>();
  for (const o of cena.objetos) contagem.set(o.assetId, (contagem.get(o.assetId) ?? 0) + 1);
  l.push(`Objetos: ${cena.objetos.length}${contagem.size ? ` (${[...contagem].map(([id, n]) => `${nome(porId, id)}: ${n}`).join("; ")})` : ""}.`);

  const fmt = (o: Cena["objetos"][number]) => {
    const p = deFracao(cena, o);
    const camada = cena.camadas.find((c) => c.id === o.camadaId)?.nome ?? "?";
    return `- ${o.id} | ${nome(porId, o.assetId)}${o.rotulo ? ` "${o.rotulo.texto}"` : ""} | ${camada} | (${p.x}, ${p.y}) | tamanho ${deEscala(cena, o.escala)}`;
  };
  const sel = cena.objetos.filter((o) => selecao.includes(o.id));
  if (sel.length) {
    l.push(`\n## Seleção atual do mestre (${sel.length}) — "isto/essa/esse" se refere a ela; use ids=["selecao"]`);
    l.push(...sel.map(fmt));
  } else l.push("\nNenhum objeto selecionado.");
  if (cena.objetos.length) {
    const lista = cena.objetos.slice(0, MAX_OBJETOS_LISTADOS);
    l.push(`\n## Objetos (id | asset | camada | posição | tamanho)${cena.objetos.length > lista.length ? ` — primeiros ${lista.length}; use listar_objetos para o resto` : ""}`);
    l.push(...lista.map(fmt));
  }

  if (tema) {
    l.push(`\n## Tema da mesa: ${tema.nome}`);
    if (tema.descricao) l.push(tema.descricao);
    if (tema.paleta.length) l.push(`Paleta: ${tema.paleta.join(", ")}`);
    if (tema.regras.length) l.push(`Regras: ${tema.regras.join("; ")}`);
    if (tema.proibidos.length) l.push(`Evitar: ${tema.proibidos.join("; ")}`);
  } else l.push("\nA cena não tem tema.");

  const disponiveis = assets.filter((a) => assetServe(a, cena.perspectiva) && (!cena.temaId || a.temaId === cena.temaId));
  l.push(`\n## Assets do tema nesta perspectiva (${disponiveis.length}; use buscar_asset para filtrar)`);
  for (const a of disponiveis.slice(0, MAX_ASSETS_LISTADOS)) l.push(`- ${a.id} | ${a.nome} | ${tipoDe(a)} | tags: ${(a.tags ?? []).join(", ") || "—"}`);
  return l.join("\n");
}

export function promptSistema(): string {
  return [
    "Você é o assistente de criação de mapas de RPG de um mestre. Você monta e ajusta a cena SOMENTE chamando ferramentas.",
    "Regras:",
    "- Organize o trabalho em passos com novo_passo (ex.: 'Piso', 'Paredes', 'Mobília', 'Detalhes'). Cada passo deve ser revisável sozinho.",
    "- Edição pontual: altere apenas os objetos afetados. Nunca refaça o mapa inteiro para um ajuste.",
    "- Pedidos sobre 'isto', 'essa árvore' etc. se referem à seleção atual: use ids=[\"selecao\"].",
    "- Reuso primeiro: use buscar_asset antes de gerar_asset. Gere só o que falta; cada geração custa créditos e o mestre confirma.",
    "- Use apenas assets do tema da cena. Se precisar de outro tema, diga isso explicitamente ao mestre.",
    "- Em grid, alinhe objetos às células (coordenadas inteiras) e trace paredes nas bordas (x.5).",
    "- Se uma ferramenta devolver erro, corrija os argumentos; não repita a mesma chamada.",
    "- Termine com um resumo curto, em português, do que o plano faz.",
  ].join("\n");
}
