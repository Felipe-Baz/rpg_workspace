# Diário do jogador

## O que é
Tela inicial do jogador ("Meu diário"): apresentação da mesa, grupo, e o diário de sessões com **anotações privadas** por sessão. Também guarda notas sobre outros personagens e opiniões sobre fichas liberadas.

## Por que existe
O jogador precisa de um lugar próprio para registrar o que viveu, sem o mestre ou outros jogadores lerem. É o ponto de partida natural de quem entra na mesa.

## Como funciona
- Documento `mesas/{id}/anotacoes/{uid}` (`Anotacoes`): notas por sessão, `notasJogadores` (o que ele junta sobre os outros, chave = `Jogador.id`) e `opinioes` (sobre fichas liberadas, chave = `Ficha.id`).
- Os **resumos públicos** das sessões (escritos pelo mestre) aparecem como o fio do diário; o jogador anota ao lado.
- Cabe aqui o encaixe de extensão `diario.jogador` (seção extra) e a seção das Marcas de Pacto quando a mesa tem a extensão nativa **e o mestre não a ocultou**.
- Hook: `useAnotacoes(mesaId, uid, habilitado)` com salvamento por debounce.

## Regras e limites
- Só o dono escreve (e precisa ser membro). O **mestre lê** (regras do Firestore), mas nunca escreve.
- **Ver como jogador:** na visão do jogador, o mestre escolhe um jogador (seletor "Ver como", guardado em `sessionStorage` por mesa). As telas passam a usar o uid desse jogador (`useUidJogador`), em modo somente leitura nas anotações; serve para testar o as-is e ler o diário, pinos e quadro dele. Fichas privadas do jogador (`mestre:false`) continuam ilegíveis ao mestre.

## Onde está no código
`src/lib/mesas.ts` (`useAnotacoes`), `src/components/shell/VisaoJogadorContext.tsx`, `ShellJogador.tsx`, `src/components/telas/DiarioJogador.tsx`, `src/app/mesas/[id]/jogador/page.tsx`.

## Relações
[sessoes-e-segredos](sessoes-e-segredos.md), [fichas](fichas.md), [extensoes](extensoes.md).
