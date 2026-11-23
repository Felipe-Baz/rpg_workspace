# Jogadores e personagens

## O que é
Lista de personagens da mesa (`mesa.jogadores[]`: `id`, `nome` do jogador, `personagem`, `uid`, `foto`) e a ligação entre conta e personagem. O mestre também guarda **notas secretas por jogador** (em páginas).

## Por que existe
O mestre precisa preparar a mesa antes de os jogadores entrarem (cadastrar personagens) e o jogador precisa de um jeito simples de "assumir" o seu. Notas sobre cada jogador são material do mestre e nunca vão para o jogador.

## Como funciona
- **Mestre** cadastra jogadores/personagens na tela Jogadores (sem `uid` = ainda livre).
- **Primeiro acesso do jogador** (`EscolherPersonagem`): vê os personagens livres e **assume um** (`assumirPersonagem`, grava o `uid`) ou **cria o seu** (`criarPersonagem`). Enquanto não tem personagem, o shell do jogador mostra só essa tela.
- **Foto:** `definirFotoPersonagem` altera só a foto, sem sobrescrever a lista (evita corrida entre mestre e jogador).
- **Notas do mestre sobre jogadores:** `segredos/mestre.notasJogadores` (chave = `Jogador.id`); aceita o formato antigo (texto único) via `paginasDe`.
- O jogador também guarda **notas privadas sobre outros personagens** no próprio diário.

## Regras e limites
- As regras do Firestore permitem que um membro altere `jogadores` apenas para assumir um existente ou criar +1, com no máximo um item removido/alterado: ninguém reescreve a lista.
- Um jogador sem personagem não vê nada da mesa.

## Onde está no código
`src/lib/mesas.ts` (`assumirPersonagem`, `criarPersonagem`, `definirFotoPersonagem`), `TelaJogadores.tsx`, `EscolherPersonagem.tsx`, `ShellJogador.tsx`.

## Relações
[mesas-e-convites](mesas-e-convites.md), [diario-do-jogador](diario-do-jogador.md), [sessoes-e-segredos](sessoes-e-segredos.md).
