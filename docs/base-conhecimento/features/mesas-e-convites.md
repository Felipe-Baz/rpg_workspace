# Mesas e convites

## O que é
A **mesa** é a campanha. Tem nome, sistema de jogo, descrição, cor, status (`planejando`, `ativa`, `pausada`, `encerrada`), mestre (`donoUid`), membros e **código de convite**. O dashboard (`/mesas`) lista as mesas do usuário.

## Por que existe
É a unidade de organização e de permissão. Separar "onde estou" (mesa) de "qual ferramenta uso" evita um menu confuso. O **status** é a informação principal do cartão porque a pergunta mais comum é "qual mesa eu abro hoje?".

## Como funciona
- **Criar:** wizard de uma tela; só o nome é obrigatório, o resto tem padrão e se edita depois. `criarMesa` gera `codigo` e grava `convites/{codigo}`.
- **Regras opcionais (`opcoesRegras`):** campo opcional da mesa com as regras opcionais do sistema ligadas pelo mestre em Configurações (hoje, só D&D 5e: `talentos`, `multiclasse` e `compras`, desligadas por padrão). A seção só aparece se o sistema tem módulo de regras (`regrasDoSistema`).
- **Sistema (dropdown):** lista os sistemas **públicos** (coleção `sistemas`, cadastrados pelo servidor com `scripts/semear-sistemas.mjs`; se vazia, usa `SISTEMAS_PADRAO`) e os **pessoais** do usuário (`sistemasPessoais`, só ele vê), com a opção "Cadastrar sistema próprio" no próprio dropdown. `Mesa.sistema` continua sendo só o nome em texto; sistemas pessoais não são visíveis a outros usuários (a mesa guarda apenas o nome).
- **Listar:** `useMesas()` assina `mesas` onde `membros` contém o uid (tempo real). Cartões agrupados por status (ativa = borda viva; planejando = tracejada; arquivadas = esmaecidas); mesas que o usuário mestra e mesas em que joga ficam separadas.
- **Editar:** `atualizarMesa` mescla em `pendentes` e grava com debounce de ~600 ms (sem botão salvar). Configurações da mesa salvam automaticamente.
- **Entrar:** o jogador informa o código (`entrarPorCodigo`): lê `convites/{codigo}`, faz `arrayUnion` em `membros` (as regras só permitem +1 do próprio uid) e cai na visão do jogador.
- **Sair:** `sairDaMesa` (o mestre não pode sair; só excluir). **Excluir:** `excluirMesa` (só o dono) apaga a mesa e o convite.
- **Gerenciar contas (mestre):** em Jogadores, a seção "Contas na mesa" lista quem entrou (nome do jogador/personagem ou da conta) e oferece três ações, todas via `POST /api/mesas/membros` (servidor, Admin SDK):
  - **Apagar ficha:** apaga só `personagens/{uid}` (ficha D&D 5e); a pessoa continua na mesa.
  - **Remover:** tira o uid de `membros` e apaga o que é só da pessoa: `anotacoes`, `pinos`, `personagens`, fichas e `quadro` pessoais (as fichas do mestre ficam), `rolagens`, `pedidosTeste`, `extensoesPedidos`, estado `de_`/`para_` das extensões, dados das Marcas de Pacto, o personagem em `jogadores[]` e as notas do mestre sobre ele. Não toca em mapas, missões, mundo, sessões nem conteúdo do mestre. Ela ainda pode voltar com o código.
  - **Bloquear:** grava `bloqueados/{uid}` (antes de limpar) e faz o mesmo que remover. A regra de entrada nega quem está bloqueado, mesmo com código válido; **Desbloquear** apaga o registro. O bloqueio vale por mesa, não pela conta inteira.
- **Papel por rota:** `/mesas/{id}` = mestre (exige dono); `/mesas/{id}/jogador` = jogador. O dono pode abrir a visão de jogador para "ver como jogador".

## Regras e limites
- Só o dono edita a mesa e não pode trocar o `donoUid`.
- `sistemas`: qualquer logado lê, ninguém no cliente escreve. `sistemasPessoais`: só o dono lê/cria/apaga (nome até 60 caracteres, sem edição).
- O mestre não pode ser removido, bloqueado nem ter a ficha apagada por essas ações.
- `convites` não pode ser listado (apenas `get` por código exato).
- `MESA_PADRAO` (`marcas-const.ts`) é o id da mesa de "O Juramento de Cinzas".

## Onde está no código
`src/lib/mesas.ts`, `src/lib/servidor/membros.ts`, `src/app/api/mesas/membros/route.ts`, `src/lib/membros-cliente.ts`, `src/components/telas/TelaJogadores.tsx`, `src/lib/sistemas.ts`, `src/lib/sistemas-padrao.ts`, `scripts/semear-sistemas.mjs`, `src/components/dashboard/*` (CardMesa, NovaMesaWizard, EntrarDialog), `src/app/mesas/page.tsx`, `TelaConfiguracoes`.

## Relações
[jogadores-e-personagens](jogadores-e-personagens.md), [navegacao-e-busca](navegacao-e-busca.md), fluxos [onboarding-do-mestre](../fluxos/onboarding-do-mestre.md) e [entrada-do-jogador](../fluxos/entrada-do-jogador.md).
