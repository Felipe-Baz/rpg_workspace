# Sessão ao vivo

## O que é
Modo "estou jogando agora" do mestre (`/mesas/{id}/sessao`): **rolador de dados, iniciativa, cronômetro, notas rápidas e atalhos** para as ferramentas mais usadas.

## Por que existe
Durante o jogo o mestre não pode navegar por dez telas. Separa "estou preparando" de "estou jogando". O destaque "Iniciar sessão" fica fixo na sidebar.

## Como funciona
- **Dados** (`lib/dados.ts`, módulo puro): expressões como `d20`, `2d6+3`, `4d6kh3`, `d20-1`, `2d8+1d4+2`; determinístico quando recebe um `rng` (testável), e sem `rng` usa o CSPRNG. Quem rola de verdade é o **rolador 3D único** da mesa ([dados-3d](dados-3d.md)); `PainelDados` é só a interface dele (botões, expressão, som) e mostra o **histórico da mesa inteira**, o mesmo no popover flutuante.
- **Iniciativa:** ordem, turno, rodada, PV e condições; persiste por mesa.
- **Cronômetro:** conta pelo relógio (não por ticks), então não deriva com a aba em segundo plano.
- **Notas rápidas:** texto livre por mesa.
- **Atalhos:** Mapas, Mundo, Missões, NPCs, Inimigos, Segredos.
- **Encerrar e registrar:** pede confirmação, cria uma sessão nova com a data de hoje (`Sessão N`), passa as notas rápidas para a nota secreta dela e limpa o campo.
- Iniciativa, cronômetro e notas rápidas ficam no `localStorage` (`lib/persistido.ts`): **não vão ao Firestore** nem sincronizam entre aparelhos. Os dados são a exceção (compartilhados, ver [dados-3d](dados-3d.md)); o iniciar de iniciativa rola um d20 3D por combatente.
- Encaixe `sessao.painel` permite extensões nesta tela.

## Regras e limites
- O histórico de dados é da mesa (Firestore, `rolagens`), não do navegador. Iniciativa, cronômetro e notas continuam no `localStorage`.
- Só o mestre tem esta tela.

## Onde está no código
`src/components/telas/SessaoAoVivo.tsx`, `src/components/sessao/*` (Cronometro, Iniciativa, PainelDados), `src/lib/dados.ts`, `src/lib/persistido.ts`.

## Relações
[sessoes-e-segredos](sessoes-e-segredos.md), [fluxo: preparar-e-jogar-uma-sessao](../fluxos/preparar-e-jogar-uma-sessao.md).
