# Liberação de conteúdo e novidades

## O que é
Padrão transversal: o mestre cria, o conteúdo nasce **oculto**, e ele **libera** para todos (`todos: true`) ou para jogadores específicos (`liberadoPara: uid[]`). Vale para **mapas, imagens e fichas do mestre**. O jogador recebe aviso de "novo" quando algo é liberado.

## Por que existe
Controlar spoilers por construção: o jogador nunca recebe o documento que não pode ver (as regras do Firestore negam a leitura), em vez de depender da interface para esconder.

## Como funciona
- Campos `todos` e `liberadoPara` nos documentos de mapas, imagens e fichas (`mestre: true`).
- Os hooks do jogador (`useMapasJogador`, `useFichas`) fazem duas consultas (liberado para todos / liberado para mim) e mesclam os resultados.
- **Novidades:** `useNovidades` compara os ids liberados com os "vistos" no `localStorage` (`lib/vistos.ts`) e gera **badges** nos itens e **avisos** no topo. Na primeira visita tudo vira "visto" (baseline), para não avisar do que já existia. Abrir a seção marca como visto.
- Missões e Mundo usam outra estratégia (versão pública derivada), ver [missoes](missoes.md).

## Regras e limites
- Fichas do jogador (`mestre: false`) **nunca** são liberáveis.
- "Visto" é por navegador (não vai ao Firestore): é só aviso, não dado de negócio.

## Onde está no código
`src/lib/mapas.ts`, `src/lib/fichas.ts`, `src/lib/vistos.ts`, `src/components/shell/useNovidades.ts`.

## Relações
[mapas-e-imagens](mapas-e-imagens.md), [fichas](fichas.md), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
