# Fluxo: entrada do jogador

**Objetivo:** do convite do mestre ao primeiro acesso do jogador, com personagem e diário.

```
Código de convite → (Login/Cadastro) → Entrar por código → Escolher personagem → Meu diário
```

1. O mestre compartilha o **código** (vem da mesa; `convites/{codigo}`).
2. O jogador entra no site e faz login ou cadastro (mesma conta serve para mestrar outras mesas).
3. No dashboard usa **"Entrar com código"** (`EntrarDialog`). `entrarPorCodigo` resolve a mesa, adiciona o uid a `membros` (a regra só permite +1 do próprio uid) e redireciona para `/mesas/{id}/jogador`.
4. **Sem personagem ainda**, o shell mostra `EscolherPersonagem`: assumir um personagem **cadastrado pelo mestre** (`assumirPersonagem`) ou **criar o seu** (`criarPersonagem`).
5. Com personagem, abre o **Meu diário**: apresentação da mesa, grupo e sessões. A sidebar mostra só Mapas, Imagens, Mundo, Quadro, Missões e Fichas.
6. O que o mestre **liberar** aparece com **badge/aviso de novo** ([liberacao-de-conteudo](../features/liberacao-de-conteudo.md)).

**Casos**
- *Código inválido:* a leitura falha e o dialog mostra o erro; não há listagem de mesas para adivinhar.
- *Sair:* `sairDaMesa` remove o uid de `membros` (o mestre não pode sair).
- *Mestre vendo como jogador:* "Ver como jogador" no rodapé do shell do mestre.

Veja: [jogadores-e-personagens](../features/jogadores-e-personagens.md), [diario-do-jogador](../features/diario-do-jogador.md).
