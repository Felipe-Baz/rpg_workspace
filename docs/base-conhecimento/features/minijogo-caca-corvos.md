# Minijogo "Caça aos Corvos" e ranking

## O que é
Um minijogo de tiro ao alvo: corvos cruzam o céu e o jogador atira com uma besta (mouse ou toque). Rodada de 45 s; no fim a pontuação pode ir para um **ranking global** (`Nick - Pontuação`).

## Por que existe
Dar algo para fazer nas telas de exceção (404, erro de rota) e quando o navegador fica sem internet, no espírito do dinossauro do Chrome, e criar uma competição leve entre os usuários da plataforma.

## Como funciona
- **Onde aparece:** `not-found` (404), `error` de rota (`ErroRota`) e `OfflineAviso` (cartão no canto quando `navigator.onLine` é falso). O `global-error` não tem o jogo (roda sem o CSS/layout do site).
- **Regras do jogo:** 6 virotes por pente, recarga automática de ~1,1 s ao esvaziar (ou tecla R). Corvo comum 25 pts, grande e lento 10, dourado raro e rápido 100. Acertos seguidos sobem o multiplicador (x1 a x5, +1 a cada 3 acertos); errar zera o combo. Tiro é instantâneo no ponto da mira (acerta a ave mais próxima dentro do raio).
- **Ranking:** coleção `rankingJogo/{uid}` com **um documento por usuário** (`uid`, `nick`, `pontos`, `em`). Salvar é voluntário: o jogador digita o nick (até 16 caracteres, lembrado no `localStorage`) e só grava se superar a nota que já tem. A lista mostra o top 10 e destaca o próprio usuário.
- **Offline:** o jogo roda, mas ler/salvar o ranking falha com aviso; o melhor placar local fica em `localStorage` (`cacaCorvos-recorde`).

## Regras e limites
- Regra Firestore: qualquer logado lê; cada um cria/atualiza **só o próprio doc**, com chaves exatas, nick 1 a 16 caracteres, pontos inteiros de 1 a 30000, `em == request.time`, e **update só se a pontuação subir**; pode apagar o próprio.
- A pontuação é calculada no navegador e **não é validada no servidor**: um cliente adulterado pode forjar nota (teto 30000). É um ranking de brincadeira, sem prêmio.
- Qualquer usuário logado vê nick e nota de todos (não há vínculo com mesa).

## Onde está no código
- `src/components/ui/CacaCorvos.tsx` (jogo + painel de ranking), `src/lib/rankingJogo.ts` (leitura/gravação), `firestore.rules` (bloco `rankingJogo`).
- Usado por `src/app/not-found.tsx`, `src/components/ui/ErroRota.tsx`, `src/components/ui/OfflineAviso.tsx`.

## Relações
[permissoes-e-seguranca](../permissoes-e-seguranca.md) (tabela de regras), [contas-e-acesso](contas-e-acesso.md).
