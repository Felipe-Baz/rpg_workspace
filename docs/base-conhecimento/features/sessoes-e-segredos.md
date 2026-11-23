# Sessões e Segredos

## O que é
- **Sessões:** registro de cada encontro (`titulo`, `data`, `resumoPublico`) guardado em `mesa.sessoes[]`, com **nota secreta** do mestre por sessão.
- **Segredos:** notas só do mestre: trama geral da campanha, notas por sessão e notas por jogador.

## Por que existe
Separar o que o grupo pode ler (resumo público, que alimenta o diário do jogador) do que é planejamento do mestre (reviravoltas, vilões).

## Como funciona
- Documento único `mesas/{id}/segredos/mestre` com `segredosMestre`, `notasSessoes` (chave = id da sessão) e `notasJogadores`. `useSegredos` o sincroniza com debounce (`useDocSincronizado`).
- A tela Sessões edita título/data/resumo público (visível aos membros pela mesa) e a nota secreta (documento de segredos).
- A **Sessão ao vivo** pode criar uma sessão nova ao encerrar, levando as notas rápidas para a nota secreta dela.
- A tela Segredos é um editor livre ("Só você vê esta página").

## Regras e limites
- `segredos/*`: só o mestre lê e escreve.
- `sessoes[]` está no documento da mesa (qualquer membro lê), por isso **nunca** colocar nele conteúdo secreto.

## Onde está no código
`src/lib/mesas.ts` (`Sessao`, `Segredos`, `useSegredos`), `TelaSessoes.tsx`, `TelaSegredos.tsx`.

## Relações
[sessao-ao-vivo](sessao-ao-vivo.md), [diario-do-jogador](diario-do-jogador.md), [jogadores-e-personagens](jogadores-e-personagens.md).
