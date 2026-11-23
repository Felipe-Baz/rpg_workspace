# Editor de cena

## O que é
Editor visual (PixiJS) de **mapas de cena**: o mapa é composto por **camadas** e **objetos** (carimbos de assets), em modo **grid** (batalha, quadrado ou hex) ou **cenário** (livre). É o que permite à IA e ao mestre editar partes do mapa em vez de regenerar uma imagem inteira.

## Por que existe
Uma imagem gerada por IA é um bloco fechado: mudar uma árvore exige refazer tudo. Com cena, cada objeto é editável, reaproveitável e a IA age por comandos pequenos e desfazíveis.

## Como funciona
- **Modelo (`lib/cena/tipos.ts`, puro):** `Cena { modo, perspectiva, temaId?, largura, altura, grid?, fundo, camadas[], objetos[], paredes? }`. Posições em **fração (0–1)** do canvas; `escala` é a largura do objeto como fração da largura do canvas (independe de resolução). Proporção travada (só a resolução muda).
- **Camadas:** `terreno`, `caminhos`, `decals`, `objetos`, `rotulos`; com visibilidade, trava e opacidade.
- **Objetos:** `assetId`, posição, `escala`, `rotacao`, `espelhado`, `z`. Objetos embutidos sem arquivo: **luz** (`@luz`) e **rótulo** (`@rotulo`).
- **Comandos reversíveis (`lib/cena/comandos.ts`):** toda mutação é um `Comando`; `aplicar` devolve a nova cena e o comando inverso. Desfazer = aplicar o inverso. **Mestre e IA usam o mesmo mecanismo**; cada comando tem autoria (mestre/IA) e o histórico agrupa em **passos** (`HistoricoEditor`).
- **Atalhos:** Ctrl+Z desfazer, Ctrl+Shift+Z refazer, Ctrl+D duplicar.
- **Assets:** o mestre envia os seus (PNG) ou gera por IA; a paleta é filtrada pela **perspectiva** da cena. Ver [ia-assets](ia-assets.md).
- **Salvar e renderizar:** a cena vai para `mesas/{id}/cenas/{id}`; ao exceder o limite de documento, camadas/objetos vão num **JSON no Storage** e o documento guarda `jsonUrl`. O **render** (PNG) vira o mapa que o jogador vê. Lado máximo do render: 4096 px.
- **Paredes** (polilinhas): usadas para linha de visão na exportação VTT; não aparecem no render.
- **Nova cena (`NovaCena`):** escolhe modo (grid/cenário), tamanho, perspectiva (com exemplos) e tema. Trocar a perspectiva de uma cena é protegido (pede confirmação, pois afeta a coerência dos assets).

## Regras e limites
- Cenas só são lidas/escritas pelo mestre.
- Ordenação de objetos depende da perspectiva (`chaveOrdem`): `porZ` (campo `z` manda), `porY` (quem tem maior Y fica na frente, `z` desempata) ou `nenhuma` (ordem de inserção).
- Grid é sempre top-down.

## Onde está no código
`src/lib/cena/*` (tipos, comandos, geometria, render, criar, compat, vtt, cenas), `src/components/mapas/cena/*` (EditorCena, NovaCena, BibliotecaAssets, HistoricoEditor, ExportarCena…). Specs: `openspec/specs/{cena-de-mapa,editor-de-cena}`.

## Relações
[mapas-e-imagens](mapas-e-imagens.md), [ia-agente-criador-de-mapas](ia-agente-criador-de-mapas.md), [ia-temas-e-perspectivas](ia-temas-e-perspectivas.md), [exportacao-vtt](exportacao-vtt.md).
