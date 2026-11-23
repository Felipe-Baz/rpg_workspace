## Context

A cena tem comandos reversíveis. O provedor LLM ativo aceita um schema de ferramentas neutro. Assets, temas, perspectivas, jobs e limites de gasto já existem.

## Goals / Non-Goals

**Goals:**
- O agente só altera a cena por comandos já existentes.
- Toda ação é revisável e reversível.
- Funciona com qualquer LLM que implemente `ProvedorLlm`.

**Non-Goals:**
- Edição de pixels dentro de um sprite além de regenerar.
- Importar imagem pronta (change 08).
- Iluminação dinâmica e visão.

## Decisions

- **LLM e gerador de imagem independentes**: o agente usa apenas o `ProvedorLlm` ativo (por exemplo Claude Sonnet) e delega a geração de pixels ao `ProvedorImagem` ativo (por exemplo Gemini), cada um com a credencial do seu fabricante. Nenhum código do agente assume o fabricante.
- **Ferramentas** como tabela de `{ nome, descricao, schemaArgs, executar(cena, args) → Comando[] }`. A rota valida os argumentos com o schema e devolve ao cliente os comandos propostos.
- **Plano e passos**: a resposta do agente é um plano em passos (texto) mais os comandos de cada passo. O mestre escolhe "executar tudo" ou passo a passo; cada passo vira um grupo único na pilha de undo.
- **Execução no cliente**: o servidor só orquestra o LLM e jobs de geração; quem aplica comandos à cena é o cliente, mantendo uma única fonte de verdade e o undo local.
- **Contexto enviado ao LLM**: resumo textual da cena (camadas, contagem de objetos por asset, dimensões, grid), a seleção atual, o perfil do tema e a lista de assets (nome e tags). Nunca imagens de outras mesas nem chaves.
- **Reuso primeiro**: a ferramenta `buscar_asset` precede `gerar_asset`; geração só ocorre mediante estimativa e confirmação, usando o teto de gasto.
- **Espalhar**: `espalhar(região, assetIds[], densidade, semente)` determinístico, com amostragem de Poisson para evitar sobreposição.
- **Limites**: máximo de passos e de comandos por resposta, e tempo máximo de execução por pedido.
- **Autoria**: cada comando guarda `autor: "humano" | "ia"` para destacar e reverter ações da IA em bloco.
- Ler `node_modules/next/dist/docs/` sobre route handlers e streaming antes de implementar a rota.

## Risks / Trade-offs

- O LLM pode propor posições ruins → validação geométrica (limites do canvas, colisões) e pré-visualização.
- Custos descontrolados → estimativa, confirmação e teto.
- Respostas longas → streaming do plano e limites de comandos.
- Perda de controle do mestre → tudo revisável e desfazível; modo "só sugerir".
