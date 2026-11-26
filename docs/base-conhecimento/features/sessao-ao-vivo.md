# Sessão ao vivo

## O que é
Modo "estou jogando agora" do mestre (`/mesas/{id}/sessao`): **rolador de dados, iniciativa, cronômetro, notas rápidas e atalhos** para as ferramentas mais usadas.

## Por que existe
Durante o jogo o mestre não pode navegar por dez telas. Separa "estou preparando" de "estou jogando". O destaque "Iniciar sessão" fica fixo na sidebar.

## Como funciona
- **Dados** (`lib/dados.ts`, módulo puro): expressões como `d20`, `2d6+3`, `4d6kh3`, `d20-1`, `2d8+1d4+2`; determinístico quando recebe um `rng` (testável), e sem `rng` usa o CSPRNG. Quem rola de verdade é o **rolador 3D único** da mesa ([dados-3d](dados-3d.md)); `PainelDados` é só a interface dele (botões, expressão, som) e mostra o **histórico da mesa inteira**, o mesmo no popover flutuante.
- **Iniciativa:** ordem, turno, rodada, PV e condições; persiste por mesa. Três fluxos separados: "Puxar jogadores" traz cada um **com a vida atual da ficha** (`personagens/{uid}`, quando existe; o PV máximo aparece no campo) **sem iniciativa** (vazia, no fim da ordem); "Rolar d20 para quem está sem iniciativa" é opcional e rola pelo site; "Pedir iniciativa aos jogadores" envia a cada jogador com conta um pedido do tipo `iniciativa` (d20 + Destreza e bônus da ficha); quando ele responde, o resultado entra no combate (ou atualiza quem já está, ligado pelo `uid`) com a vida atual, e o pedido é apagado.
- **Jogadores vinculados na iniciativa (D&D 5e):** mostram PV/máximo, CA, condições e concentração **lidos ao vivo da ficha** (já com os valores calculados pelo livro); editar o PV grava só esse campo na ficha ([ficha-dnd5e](ficha-dnd5e.md)). O histórico de dados mostra a origem da rolagem ("Aria — Ataque de magia: Raio de Fogo") quando ela vem da ficha.
- **Sessão aberta:** abrir `/sessao` inicia a sessão da mesa (`lib/sessaoAtiva.ts`, no `sessionStorage` da aba). Ela **continua aberta ao navegar** por outras telas e ao recarregar, e só termina quando o mestre usa "Encerrar e registrar" ou **fecha o site/aba** (cancelando-a). A sidebar mostra "Sessão em andamento" enquanto ela existir. Não há estado no Firestore: jogadores não veem a sessão aberta.
- **Cronômetro:** vive na sessão aberta (não zera ao navegar) e conta pelo relógio (não por ticks), então não deriva com a aba em segundo plano. Inicia rodando com a sessão.
- **Notas rápidas:** texto livre por mesa.
- **Pedir teste:** o mestre escolhe um jogador (que já assumiu personagem, com `uid`) e o teste: **perícia** (ex.: Sobrevivência), **atributo** (só o modificador), **salvaguarda** ou **teste livre** (nome digitado; vale também em mesas que não são D&D 5e), com vantagem/desvantagem e um contexto opcional. O pedido vira um documento em `mesas/{id}/pedidosTeste`; na tela do jogador alvo (em qualquer página da mesa) aparece um cartão com a conta montada pela ficha (`1d20 + 3 (Sabedoria) + 2 (Proficiência)`; no teste livre o jogador informa o bônus). Ele **rola no site** (dados 3D para a mesa toda, resposta automática) ou **informa o d20 que rolou na mesa**. A resposta (total, d20 natural, origem) volta no mesmo documento e aparece no painel do mestre, que pode remover o pedido. Vários pedidos formam fila (um cartão por vez). O jogador pode **fechar o cartão no X**: é só local (estado da página, sem gravar nada); o pedido segue pendente para o mestre e o cartão volta ao recarregar.
- **Atalhos:** Mapas, Mundo, Missões, NPCs, Inimigos, Segredos.
- **Encerrar e registrar:** pede confirmação, cria uma sessão nova com a data de hoje (`Sessão N`), passa as notas rápidas para a nota secreta dela e limpa o campo.
- Iniciativa, cronômetro e notas rápidas ficam no `localStorage` (`lib/persistido.ts`): **não vão ao Firestore** nem sincronizam entre aparelhos. Os dados são a exceção (compartilhados, ver [dados-3d](dados-3d.md)); o iniciar de iniciativa rola um d20 3D por combatente.
- Encaixe `sessao.painel` permite extensões nesta tela.

## Regras e limites
- O histórico de dados é da mesa (Firestore, `rolagens`), não do navegador. Iniciativa, cronômetro e notas continuam no `localStorage`.
- Só o mestre tem esta tela.
- Pedidos de teste (Firestore): só o mestre cria e apaga; o jogador alvo lê **apenas os seus** e só pode responder um pedido pendente (muda `status`, `total`, `natural`, `origem`, `respondidoEm`). Sem CD: o mestre compara o total por conta própria. O resultado não é validado no servidor (mesma confiança dos dados, ver [dados-3d](dados-3d.md)). O cartão só aparece com o jogador online; pedidos pendentes esperam até ele abrir a mesa. Mostra os 20 pedidos mais recentes.

## Onde está no código
`src/components/telas/SessaoAoVivo.tsx`, `src/components/sessao/*` (Cronometro, Iniciativa, PainelDados, `PedirTeste` do mestre, `PedidoTesteJogador` do jogador, montado no `ShellBase`), `src/lib/pedidosTeste.ts`, `src/lib/dados.ts`, `src/lib/persistido.ts`, `src/lib/sessaoAtiva.ts`. Regras: bloco `pedidosTeste/{pedidoId}` em `firestore.rules`.

## Relações
[sessoes-e-segredos](sessoes-e-segredos.md), [fluxo: preparar-e-jogar-uma-sessao](../fluxos/preparar-e-jogar-uma-sessao.md).
