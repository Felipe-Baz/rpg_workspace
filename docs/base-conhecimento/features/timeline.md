# Timeline do mestre

## O que é
Linha do tempo **só do mestre**, para planejar e acompanhar a campanha: eventos posicionados num eixo, organizados em **ramos** (a linha principal, linhas paralelas e ramificações que nascem de um evento) e um marcador **"agora"** para saber onde a mesa está.

## Por que existe
Campanhas longas têm passado, futuro provável e alternativas ("e se o rei morrer?"). O mestre precisa ver tudo de uma vez, aproximar num trecho e navegar sem se perder. Por isso a tela tem zoom, minimapa, busca e enquadramento, e não é uma lista.

## Como funciona
- **Eixo numérico livre:** cada evento tem `x` (dias, anos, sessões…; o mestre nomeia a `unidade`) e um `rotulo` de data em texto livre ("Ano 312"). A ordem é a do `x`.
- **Ramos:** `principal` (sempre existe, não pode ser excluído) e outros. Um ramo com `origemId` nasce de um evento e é desenhado com uma curva a partir dele; sem `origemId` é uma linha paralela. Ao excluir o evento de origem, o ramo fica solto; ao excluir um ramo, seus eventos vão junto.
- **Eventos:** `titulo`, `texto`, `tipo` (evento, marco, gancho, segredo), `feito` (já aconteceu: marcador preenchido × vazio) e `ramoId`. Arrastar muda `x` (com encaixe proporcional ao zoom) e pode trocar de ramo; um evento não pode ficar antes do início do seu ramo.
- **Navegação em linhas longas:** zoom ancorado no cursor (roda, slider, botões, teclado), arrastar para rolar, "Ver tudo", "Ir ao agora", **minimapa** clicável, régua com passo 1/2/5×10ⁿ que se adapta ao zoom, busca por título/data/texto, ramos escondíveis. Só os eventos dentro da janela são desenhados e os rótulos que se sobreporiam são omitidos.
- **Backup:** exportar/importar `.json` (importar substitui, com confirmação; o arquivo é validado e normalizado).
- **Salvar:** documento único `mesas/{id}/segredos/timeline` (`ramos`, `eventos`, `agora`, `unidade`), sincronizado com debounce por `useDocSincronizado`, o mesmo de Segredos.

## Regras e limites
- Só o mestre lê e escreve: o documento cai na regra existente de `segredos/*` (não há regra nova). O jogador não tem rota, item de menu nem busca para ela.
- **Limite de tamanho:** o Firestore limita o documento a 1 MiB; a tela bloqueia novos eventos acima de ~900 KB e avisa a partir de 80%. Exportar e apagar o antigo é o caminho. (Se isso virar problema, o passo seguinte é um documento por evento.)
- Textos limitados na leitura (`titulo` 200, `texto` 20 000). `normalizar` descarta eventos órfãos e números inválidos.
- Excluir a mesa apaga também `segredos/timeline`.
- Sem desfazer: exclusões pedem confirmação.

## Onde está no código
`src/lib/timeline.ts` (modelo e funções puras, testadas em `timeline.test.ts`), `src/components/telas/TelaTimeline.tsx`, rota `src/app/mesas/[id]/(workspace)/timeline/page.tsx`, item "Timeline" em `src/components/shell/navegacao.ts` (grupo Jogo, só mestre), limpeza em `excluirMesa` (`src/lib/mesas.ts`).

## Relações
[sessoes-e-segredos](sessoes-e-segredos.md) (mesmo documento-pai e regra), [navegacao-e-busca](navegacao-e-busca.md), [missoes](missoes.md), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
