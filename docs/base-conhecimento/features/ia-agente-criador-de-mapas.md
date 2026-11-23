# IA: agente criador de mapas

## O que é
Chat dentro do editor de cena em que o mestre pede ("monte uma taverna com lareira", "espalhe árvores ao norte") e um **agente LLM** devolve um **plano em passos** de comandos para a cena. O mestre revisa e aplica passo a passo; tudo é desfazível.

## Por que existe
Montar um mapa objeto por objeto é lento. A IA acelera, mas **não pode ser uma caixa-preta**: o agente só propõe **comandos já suportados** pelo editor, o mestre vê o que vai mudar e pode reverter cada passo.

## Como funciona
- **Rota:** `POST /api/ia/agente` com `{ mesaId, pedido, cena, selecao?, conversa? }`. Resposta em **streaming NDJSON**: uma linha por `EventoAgente` (`texto`, `ferramenta`, `passo`, `fim`, `erro`). Usa o LLM ativo do mestre.
- **Laço (`agente/agente.ts`):** conversa com o `ProvedorLlm` (Gemini ou Claude), executa as **ferramentas sobre uma cópia da cena** e devolve um `Plano`. **Nada é aplicado no servidor**; o cliente aplica.
- **O que o LLM enxerga (`contexto.ts`):** resumo textual da cena, objetos selecionados, perfil do tema e assets (nome e tags). Nunca imagens nem chaves, nem outras mesas.
- **Ferramentas (`agente/ferramentas.ts`):** `buscar_asset`, `listar_objetos`, `novo_passo`, `colocar_objeto`, `editar_objeto`, `remover`, `pintar_terreno`, `tracar_caminho`, `espalhar` (amostragem de Poisson em disco, determinística por semente), `definir_grid`, `rotular`, `adicionar_luz`, `gerar_asset`. Cada uma valida argumentos contra o **mesmo schema enviado ao LLM** (`schema.ts`) e devolve só comandos válidos.
- **Unidades:** em grid, células (coluna/linha, inteiros = centro da célula); em cenário, % do canvas (0–100). A cena guarda frações (`coords.ts` converte).
- **Limites por pedido (`LIMITES_PADRAO`):** 12 passos, 1500 comandos, 16 iterações, 240 s. Chamadas com erro não alteram a cena simulada; o LLM recebe o erro e corrige.
- **Colisões:** interseção acima de 50 % do menor objeto conta como colisão (`LIMITE_COLISAO`).
- **Passos no cliente (`passos.ts`):** prévia, troca dos **ids provisórios** (`pendente-…`) pelos reais, e cada passo vira **uma entrada do histórico** com autoria IA, desfazível como qualquer comando.
- **Assets durante o plano:** o agente **busca na biblioteca antes de gerar** (`buscar_asset`); `gerar_asset` só **propõe** (até 8 por chamada) e a geração real exige **estimativa e confirmação** do mestre.
- **Modo "apenas sugerir":** o mestre pode pedir só o plano, sem aplicar.
- **Seleção:** o mestre pode selecionar objetos; `["selecao"]` nas ferramentas refere-se a eles (edição pontual sem refazer o mapa).
- Conversa anterior limitada a 12 mensagens de texto.

## Regras e limites
- Só o mestre; chave do mestre; passa pelo teto de uso quando gera assets.
- Funciona com **qualquer LLM** que implemente a interface neutra e declare `ferramentas: true`.

## Onde está no código
`src/lib/mapas-ia/agente/*`, `provedores/{google-llm,anthropic-llm}.ts`, `src/app/api/ia/agente`, `src/components/mapas/cena/ChatIA.tsx`. Specs: `chat-de-criacao-de-mapa`, `composicao-de-cena-por-ia`, `ferramentas-do-agente`.

## Relações
[editor-de-cena](editor-de-cena.md), [ia-assets](ia-assets.md), [ia-temas-e-perspectivas](ia-temas-e-perspectivas.md), [fluxo criar-mapa-com-ia](../fluxos/criar-mapa-com-ia.md).
