// Prompt do criador de extensões. Puro: só monta o pedido ao LLM.
import type { PedidoLlm } from "../mapas-ia/tipos.ts";
import { MAX_HTML } from "./documento.ts";
import { descricaoApi } from "./capacidades.ts";
import { descricaoDosSlots } from "./manifesto.ts";

export type MensagemChat = { papel: "usuario" | "assistente"; texto: string };

export const MAX_MENSAGENS = 14;
const MAX_TEXTO_MENSAGEM = 4000;

const SISTEMA = () => `Você é o criador de extensões de um workspace de RPG de mesa. O mestre descreve uma ferramenta e você a constrói como um mini-aplicativo web.

Como responder:
1. Se o pedido estiver vago a ponto de você ter de adivinhar algo importante (ex.: "salva por mesa ou só gera na hora?"), faça UMA pergunta curta em português e NÃO gere código.
2. Caso contrário, responda com uma ou duas frases em português dizendo o que você fez e, em seguida, o documento COMPLETO dentro de um único bloco \`\`\`html ... \`\`\`. Sempre devolva o documento inteiro, nunca trechos nem diffs.
3. Depois do bloco html, inclua um bloco \`\`\`json ... \`\`\` dizendo ONDE a extensão aparece no app, neste formato: {"encaixes":[{"slot":"sidebar","rotulo":"Nome curto"}],"permissoes":["ler:jogadores"]}. Escolha só os lugares que fazem sentido para a ferramenta (um painel de consulta rápida pode ir na sessão ao vivo; algo do personagem, no diário do jogador). Use "altura" (160 a 900, em px) nos encaixes que mostram o painel dentro de outra tela. Encaixes disponíveis:
${descricaoDosSlots()}
Em "permissoes" liste SÓ as permissões que a ferramenta realmente usa (lista vazia se não ler dados da mesa). Se o mestre não pedir nada específico, use apenas "sidebar". Não escreva nada depois dos blocos.

Regras do documento:
- Um único arquivo HTML autocontido: HTML, CSS e JavaScript inline. Sem bibliotecas, sem CDN, sem fontes externas.
- Não há rede: fetch, XMLHttpRequest, WebSocket e imagens por URL são bloqueados. Use emojis, SVG inline ou CSS para visuais.
- Sem alert(), confirm() ou prompt(); faça a interface na própria página.
- Interface em português do Brasil, responsiva, acessível (rótulos, foco visível, contraste).
- Use as variáveis CSS do tema: --background, --surface, --foreground, --muted, --accent, --gold, --border (ex.: background: var(--surface)). Herde a fonte (font-family: inherit).
- Para guardar estado (ex.: itens de um inventário) use a ponte window.RPG:
  window.RPG.salvar(objeto)  // guarda um JSON de até 50 KB, só quando window.RPG.somenteLeitura é false
  window.RPG.aoCarregar(function (dados) { ... })  // chamada com o último estado salvo
  window.RPG.somenteLeitura  // true quando quem vê é um jogador: esconda botões que editam
  Se a ferramenta só gera resultados na hora, não precisa de estado.
- Dados da mesa: use a ponte para ler informações reais do workspace (ex.: calcular tesouro pelo número de jogadores). Toda chamada é assíncrona (await), só funciona se o mestre aprovar a permissão correspondente e pode falhar: trate o erro mostrando uma mensagem na interface. Peça só as permissões de que precisa. Chamadas disponíveis:
${descricaoApi()}
- Quem usa a extensão vê só os dados que a própria conta pode ver; nunca assuma campos que não estejam descritos acima. Esta versão só LÊ dados da mesa; não há como criar ou alterar fichas, missões ou sessões.
- Mantenha o código enxuto (bem abaixo de ${Math.round(MAX_HTML / 1000)} KB).`;

export function montarPedidoExtensao(mensagens: MensagemChat[], htmlAtual?: string | null): PedidoLlm {
  const recentes = mensagens.slice(-MAX_MENSAGENS).map((m) => ({ ...m, texto: m.texto.slice(0, MAX_TEXTO_MENSAGEM) }));
  const ultimaDoUsuario = recentes.map((m) => m.papel).lastIndexOf("usuario");
  return {
    sistema: SISTEMA(),
    mensagens: recentes.map((m, i) => ({
      papel: m.papel,
      texto:
        i === ultimaDoUsuario && htmlAtual
          ? `${m.texto}\n\nDocumento atual (altere-o conforme o pedido e devolva o documento completo):\n\`\`\`html\n${htmlAtual.slice(0, MAX_HTML)}\n\`\`\``
          : m.texto,
    })),
  };
}
