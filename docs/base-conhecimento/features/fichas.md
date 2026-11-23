# Fichas

## O que é
Registros com **nome, foto e texto em Markdown**, em quatro categorias: **NPCs, Inimigos, Pessoas importantes, Itens**. Existem dois tipos: as do **mestre** (liberáveis) e as **privadas do jogador**.

## Por que existe
O mestre precisa de um catálogo reutilizável de NPCs/inimigos/itens e de um jeito de mostrar só o que quer; o jogador precisa de um lugar para registrar o que descobriu sem expor ao grupo.

## Como funciona
- **Mestre:** cria fichas com `mestre: true`. Cada uma começa oculta; ele libera para todos (`todos`) ou para alguns (`liberadoPara`). `useFichas(..., comoMestre=true)` devolve só as fichas dele, nunca as privadas dos jogadores.
- **Jogador:** vê as **suas próprias** (privadas, `donoUid` dele) + as do mestre **liberadas para ele** (somente leitura). Pode escrever **opiniões privadas** sobre fichas liberadas (`anotacoes.opinioes`, chave = id da ficha).
- A foto é comprimida e vai como data URL no próprio documento.
- Cada categoria tem rota própria (`/fichas/{categoria}`) e ícone (`IconeCategoria`). A sidebar gera um item por categoria a partir de `CATEGORIAS`.

## Regras e limites
- Ficha do jogador: criação só com `mestre:false`, `todos:false`, `liberadoPara:[]`. Nunca liberável.
- `mestre` não muda depois de criada (as regras impedem).
- Novas fichas liberadas geram aviso de novidade ao jogador.

## Onde está no código
`src/lib/fichas.ts`, `src/components/telas/TelaFichas.tsx`, `src/components/fichas/FichasJogador.tsx`, `IconeCategoria.tsx`; rotas `fichas/[categoria]`.

## Relações
[liberacao-de-conteudo](liberacao-de-conteudo.md), [diario-do-jogador](diario-do-jogador.md), [busca](navegacao-e-busca.md).
