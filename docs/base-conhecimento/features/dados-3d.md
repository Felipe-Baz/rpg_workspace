# Dados 3D (rolador único)

## O que é
**Um só componente de rolagem** para o site inteiro: o dado 3D é jogado na tela, faz barulho e o número em que ele para é o resultado. Todo mundo que está com a mesa aberta vê o mesmo dado cair no mesmo número.

## Por que existe
Rolar com dado de verdade é parte da graça da mesa. Antes havia rolagens espalhadas (painel de dados, ficha, iniciativa) que só mostravam um número. Centralizar garante o mesmo sorteio, a mesma animação e o mesmo histórico em todo canto, e deixa a mesa toda acompanhar a rolagem.

## Como funciona
- **Ponto único:** `RolagemProvider` (montado no `ShellBase`, dentro de cada mesa) expõe `useRolagem()` → `rolar(expressao, rotulo?)`, que devolve o resultado **depois** que os dados param. Quem rola (painel de dados, ficha D&D, iniciativa, `RPG.rolar` das extensões) chama só isso. Fora de uma mesa (sem provider) devolve o número sem animação.
- **Sorteio (`lib/aleatorio.ts`, `lib/dados3d.ts`):** cada dado é sorteado por `crypto.getRandomValues` com amostragem por rejeição (sem viés de módulo). `rolar` de `dados.ts` também usa o CSPRNG por padrão (`Math.random` não é mais usado para dados de jogo).
- **Física real, resultado já sorteado:** o arremesso é uma simulação de corpo rígido (`cannon-es`: gravidade, quiques, atrito, rolagem e colisão entre dados e com as bordas da área), calculada de uma vez a partir de uma **semente** e depois reproduzida em ~60 quadros/s. Como o número já foi sorteado (CSPRNG), depois de simulado o arremesso **trocam-se de lugar os números impressos** para que a face que ficou em cima mostre o valor sorteado (dados regulares são simétricos, a troca não se vê). Assim a física é natural, o resultado é uniforme e idêntico para todos, e mesmo que o motor diverja um pouco entre navegadores a mesa vê o mesmo número. O motor é três.js + cannon-es (`lib/cena-dados.ts`), com a geometria em `lib/geometria-dados.ts` (módulo puro e testado: faces planas, opostas somando `lados+1`). A simulação dura ~3 a 4 s e termina quando todos os dados dormem.
- **Responsivo:** o dado ocupa cerca de 13% do menor lado da tela (entre 68 e 140 px) e a área de jogo acompanha a tela (paredes invisíveis mantêm os dados visíveis); com muitos dados a área cresce até todos caberem.
- **Todos online veem:** a rolagem vira um documento em `mesas/{id}/rolagens/{id}` com a **semente** e as faces de cada dado; quem tem a mesa aberta recebe por `onSnapshot` e repete o mesmo arremesso (determinístico pela semente). Só são reencenadas rolagens que chegam **depois** de a escuta começar e com menos de 20 s; quem abre a mesa depois só vê o histórico. Aba em segundo plano não encena.
- **Fila e spoiler:** rolagens são encenadas uma de cada vez; o resultado só entra no histórico depois que os dados param.
- **Som:** `public/sons/lancamento_de_dados.mp3`, tocado a cada lançamento; o jogador silencia no painel (preferência no `localStorage`). Navegador sem interação prévia pode bloquear o áudio: fica mudo, sem erro.
- **Acessibilidade e queda graciosa:** com `prefers-reduced-motion`, sem WebGL ou com dados demais (mais de 24 físicos) mostra só o total.

### Quais dados aparecem
- d4, d6, d8, d10, d12 e d20: um dado cada. No d4 vale o número do vértice que aponta para cima.
- **d100 = par percentil:** um dado de dezenas (00 a 90) + um d10 de unidades (1 a 10); o valor é dezenas + unidades.
- **Mais de 100 faces soma dados:** `1d120` = par percentil (até 100) + d20. O resultado é sorteado uniformemente de 1 a 120 e dividido entre os dados; só o resultado 1 usa apenas o par percentil.
- Dado fora do padrão (d3, d14…) usa o menor dado físico que comporta (um d3 usa um d4 mostrando 1 a 3).

## Regras e limites
- Quem rola é o próprio navegador: a rolagem é gravada pelo autor (`uid == auth.uid`) e **não é validada no servidor**. Um cliente adulterado poderia forjar um número; a mesa é de confiança, como em dado físico.
- Rolagens são **imutáveis** (sem `update`); só o autor (ou o mestre) apaga. Não há limpeza automática: o histórico exibido são as 30 mais recentes.
- Limites do interpretador (`dados.ts`): até 100 dados e 1000 faces por grupo.
- O botão de rolar fica desabilitado enquanto há dados na tela.

## Onde está no código
`src/components/dados/RolagemProvider.tsx` (provider, fila, overlay e resultado), `src/lib/cena-dados.ts` (three.js + cannon-es), `src/lib/geometria-dados.ts`, `src/lib/dados3d.ts` (planejamento puro), `src/lib/aleatorio.ts`, `src/lib/rolagens.ts` (Firestore), `src/lib/som-dados.ts`, `src/lib/dados.ts` (interpretador). Consumidores: `components/sessao/PainelDados.tsx`, `components/dnd/PainelRolagem.tsx`, `components/sessao/Iniciativa.tsx`, `components/extensoes/PainelExtensao.tsx` (via `criarBroker`). Regras: bloco `rolagens/{rolagemId}` em `firestore.rules`. Testes: `dados3d.test.ts`, `geometria-dados.test.ts`, `dados.test.ts`.

## Relações
[sessao-ao-vivo](sessao-ao-vivo.md) (painel de dados e iniciativa), [ficha-dnd5e](ficha-dnd5e.md) (rolagens de teste, ataque e dano), [extensoes](extensoes.md) (`RPG.rolar`), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
