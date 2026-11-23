# Missões

## O que é
Diário de missões da campanha: título, descrição pública, descrição do mestre, status (`em_andamento`, `concluida`, `fracassada`), dificuldade, categoria, **etapas** e ilustrações.

## Por que existe
Mostrar o progresso aos jogadores sem entregar a trama. Etapas futuras, notas e dificuldade são do mestre; o jogador deve ver só o que já aconteceu ou está acontecendo.

## Como funciona
- **Duas visões gravadas juntas:**
  - `missoesMestre/{id}`: visão **completa** (só o mestre lê/escreve), com etapas `pendente` / `atual` / `concluida`, `notaMestre` e dificuldade.
  - `missoes/{id}`: visão **pública derivada** da completa, **sem** etapas pendentes, sem notas e sem dificuldade. Etapas públicas só têm `concluida` ou `atual`.
- Ao salvar, o app recalcula a pública a partir da completa (escrita em lote).
- `missoesImagens/{id}`: ilustrações (qualquer membro lê, só o mestre escreve).
- Etapa "Pendente (oculta)" vira visível quando o mestre muda para "Atual".

## Regras e limites
- O que não está no documento público **não vaza**: não há como o cliente do jogador ler a etapa pendente.
- Qualquer membro lê `missoes`; só o mestre escreve.

## Onde está no código
`src/lib/missoes.ts`, `TelaMissoes.tsx`, `TelasJogador.tsx`, rotas `missoes` (mestre e jogador).

## Relações
[liberacao-de-conteudo](liberacao-de-conteudo.md), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
