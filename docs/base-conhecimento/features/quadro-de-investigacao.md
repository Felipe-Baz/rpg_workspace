# Quadro de investigação

## O que é
Um quadro livre do jogador com **notas, textos e imagens** ligados por linhas (estilo "mural de detetive"), com zoom e arrasto.

## Por que existe
Campanhas de mistério pedem que o jogador conecte pistas. É material de **jogador**, privado, sem depender do mestre.

## Como funciona
- Cada elemento é um documento `mesas/{id}/quadro/{noId}` (`No`: `tipo` nota/texto/imagem, posição `x`/`y`, largura `w`, `texto`, `cor`, `imagem`, `ligacoes[]` com ids de destino).
- Posição "efetiva" = servidor + rascunho local durante arraste/edição (evita escrever a cada pixel). Zoom com a roda, centrado no cursor.
- Imagens entram comprimidas (data URL).
- Hook: `lib/quadro.ts`; tela: `QuadroJogador` (rota `/jogador/quadro`). Só existe na visão do jogador.

## Regras e limites
- Só o `donoUid` lê, cria, altera e apaga. O mestre **não** vê o quadro dos jogadores.

## Onde está no código
`src/lib/quadro.ts`, `src/components/quadro/QuadroJogador.tsx`.

## Relações
[diario-do-jogador](diario-do-jogador.md), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
