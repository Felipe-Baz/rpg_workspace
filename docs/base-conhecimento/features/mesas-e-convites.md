# Mesas e convites

## O que é
A **mesa** é a campanha. Tem nome, sistema de jogo, descrição, cor, status (`planejando`, `ativa`, `pausada`, `encerrada`), mestre (`donoUid`), membros e **código de convite**. O dashboard (`/mesas`) lista as mesas do usuário.

## Por que existe
É a unidade de organização e de permissão. Separar "onde estou" (mesa) de "qual ferramenta uso" evita um menu confuso. O **status** é a informação principal do cartão porque a pergunta mais comum é "qual mesa eu abro hoje?".

## Como funciona
- **Criar:** wizard de uma tela; só o nome é obrigatório, o resto tem padrão e se edita depois. `criarMesa` gera `codigo` e grava `convites/{codigo}`.
- **Listar:** `useMesas()` assina `mesas` onde `membros` contém o uid (tempo real). Cartões agrupados por status (ativa = borda viva; planejando = tracejada; arquivadas = esmaecidas); mesas que o usuário mestra e mesas em que joga ficam separadas.
- **Editar:** `atualizarMesa` mescla em `pendentes` e grava com debounce de ~600 ms (sem botão salvar). Configurações da mesa salvam automaticamente.
- **Entrar:** o jogador informa o código (`entrarPorCodigo`): lê `convites/{codigo}`, faz `arrayUnion` em `membros` (as regras só permitem +1 do próprio uid) e cai na visão do jogador.
- **Sair:** `sairDaMesa` (o mestre não pode sair; só excluir). **Excluir:** `excluirMesa` (só o dono) apaga a mesa e o convite.
- **Papel por rota:** `/mesas/{id}` = mestre (exige dono); `/mesas/{id}/jogador` = jogador. O dono pode abrir a visão de jogador para "ver como jogador".

## Regras e limites
- Só o dono edita a mesa e não pode trocar o `donoUid`.
- `convites` não pode ser listado (apenas `get` por código exato).
- `MESA_PADRAO` (`marcas-const.ts`) é o id da mesa de "O Juramento de Cinzas".

## Onde está no código
`src/lib/mesas.ts`, `src/components/dashboard/*` (CardMesa, NovaMesaWizard, EntrarDialog), `src/app/mesas/page.tsx`, `TelaConfiguracoes`.

## Relações
[jogadores-e-personagens](jogadores-e-personagens.md), [navegacao-e-busca](navegacao-e-busca.md), fluxos [onboarding-do-mestre](../fluxos/onboarding-do-mestre.md) e [entrada-do-jogador](../fluxos/entrada-do-jogador.md).
