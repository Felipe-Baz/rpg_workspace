## Why

Com cena, tema, perspectivas e biblioteca de assets prontos, falta a IA montar o mapa. O mestre descreve o que quer e o agente compõe e ajusta a cena por ferramentas, sem refazer a imagem inteira. Esta é a entrega principal da visão: criar e editar mapas por conversa, camada a camada.

## What Changes

- Agente orquestrado pelo LLM ativo, com ferramentas neutras que operam sobre a cena: buscar e gerar assets, pintar terreno, traçar caminhos (paredes, rios, estradas), colocar, espalhar, editar e remover objetos, definir grid, adicionar luz e rótulos.
- Chat da IA no editor, que enxerga a seleção atual (por exemplo "deixa essa árvore maior").
- Cada ação do agente é um comando da cena: desfazível, visível e agrupada em um "passo" que o mestre pode aceitar ou reverter.
- Modo grid (com snap e dimensões em células) e modo cenário.
- Pré-visualização do plano antes de executar e estimativa de custo para o que for gerar.
- Edição pontual: o agente altera só os objetos afetados e nunca a imagem inteira.

## Capabilities

### New Capabilities
- `ferramentas-do-agente`: catálogo de ferramentas, validação de argumentos e mapeamento para comandos da cena.
- `chat-de-criacao-de-mapa`: conversa no editor, contexto de seleção, plano, passos e reversão.
- `composicao-de-cena-por-ia`: geração de mapas completos em grid e cenário e espalhamento por região.

### Modified Capabilities
- `editor-de-cena`: ganha painel de chat, indicação de autoria (humano ou IA) por comando e histórico agrupado em passos.

## Impact

- Novos: `src/lib/mapas-ia/agente/*`, `src/app/api/ia/agente/route.ts`, `src/components/mapas/cena/ChatIA.tsx`.
- Reaproveita comandos, assets, temas, jobs e limites de gasto das changes anteriores.
- Depende de `03` a `06`.
