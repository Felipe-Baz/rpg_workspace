## ADDED Requirements

### Requirement: Alterar e excluir fichas e missões existentes
A ponte SHALL expor `RPG.alterar(tipo, id, mudancas)` e `RPG.excluir(tipo, id)` para `tipo` `"ficha"` ou `"missao"`, e `RPG.propor([...])` SHALL aceitar ações `{ tipo, op: "alterar" | "excluir", id, mudancas? }` misturadas às de criação, com até 20 ações por proposta.
- **Ficha:** os campos alteráveis MUST ser `nome`, `texto`, `categoria` e `liberarPara`.
- **Missão:** os campos alteráveis MUST ser `titulo`, `descricao`, `categoria`, `dificuldade`, `status` e `etapas`. Em `etapas`, a lista vem com o `id` das etapas existentes para mudar `texto` e `status`, e etapas sem `id` são novas.
- Os limites de texto MUST ser os mesmos da criação.
- Campo desconhecido ou valor inválido MUST tornar a ação inválida e recusar a proposta inteira.

#### Scenario: Liberar uma ficha para um jogador
- **WHEN** a extensão chama `RPG.alterar("ficha", "f1", { liberarPara: ["j1"] })` com `alterar:fichas` aprovada e o mestre aprova a ação
- **THEN** a ficha f1 passa a ser visível só para a conta de j1

#### Scenario: Campo não permitido
- **WHEN** a extensão tenta `RPG.alterar("ficha", "f1", { donoUid: "x" })`
- **THEN** a proposta é recusada antes de qualquer tela de aprovação

### Requirement: Alcance das alterações
`alterar` e `excluir` MUST valer só para itens da mesa que o mestre já pode editar hoje: fichas do mestre (`mestre: true`) e missões da mesa. Fichas pessoais de jogadores MUST ficar fora do alcance, mesmo que o mestre as veja. Alterar uma missão MUST atualizar `missoes/{id}` e `missoesMestre/{id}` no mesmo lote, sem expor a parte do mestre ao jogador. Ids inexistentes MUST tornar a proposta inválida.

#### Scenario: Ficha de jogador
- **WHEN** a extensão propõe alterar uma ficha criada por um jogador
- **THEN** a proposta é recusada com "Esta ficha não pode ser alterada por extensões"

### Requirement: Permissões de alteração
O catálogo `capacidades.ts` SHALL ganhar `alterar:fichas` e `alterar:missoes`, que cobrem alterar e excluir. Elas MUST ser pedidas no manifesto, aprovadas pelo mestre ao publicar ou instalar e explicadas no consentimento como "pode mudar ou apagar fichas/missões existentes, sempre com sua aprovação". `criar:*` MUST NOT dar direito a alterar, e `alterar:*` MUST NOT dar direito a criar.

#### Scenario: Só criação aprovada
- **WHEN** uma extensão com só `criar:fichas` aprovada chama `RPG.alterar("ficha", ...)`
- **THEN** a promise rejeita com "Permissão não concedida: alterar:fichas"

### Requirement: Aprovação com "antes → depois"
Toda alteração ou exclusão SHALL passar pela tela de aprovação do E3, que MUST mostrar, para cada item:
- o nome;
- a operação;
- os campos que mudam, com o valor anterior e o novo, e com a liberação convertida em nomes de jogadores;
- um destaque para exclusões.

Só depois da aprovação o lote é gravado atomicamente (`writeBatch`). A promise resolve com `{ lote, criados, alterados, excluidos, avisos }`. Se o mestre recusar, ela rejeita.

#### Scenario: Lote misto
- **WHEN** a extensão propõe criar uma missão e alterar duas fichas numa só chamada e o mestre aprova
- **THEN** as três ações são gravadas num único lote, ou nenhuma é gravada se a gravação falhar

### Requirement: Desfazer restaura a versão anterior
O registro do lote em `mesas/{id}/extensoesLotes/{lote}` SHALL guardar, para cada item alterado ou excluído, o documento inteiro anterior (`antes`), inclusive a parte em `missoesMestre`. "Desfazer o lote" MUST:
- apagar os itens criados;
- restaurar os alterados ao `antes`;
- recriar os excluídos.

Se um item alterado foi mudado de novo depois do lote, o desfazer MUST avisar quais itens perderão as mudanças posteriores e pedir confirmação na própria interface.

#### Scenario: Desfazer uma exclusão
- **WHEN** o mestre desfaz um lote que excluiu a ficha f1
- **THEN** f1 volta com os mesmos campos e a mesma liberação de antes

#### Scenario: Item editado depois
- **WHEN** o mestre desfaz um lote que alterou a missão m1 e a missão foi editada à mão depois
- **THEN** a tela avisa que m1 perderá a edição posterior e só restaura após a confirmação

### Requirement: Jogador pede alteração
Quando quem chama `alterar`, `excluir` ou `propor` com essas ações é um jogador, a chamada SHALL virar um pedido em `extensoesPedidos`, como no E4, e resolver com `{ pedido, status: "pendente" }`. Ao aprovar, o mestre MUST ver o mesmo "antes → depois", calculado na hora da aprovação a partir dos dados atuais, e o lote é executado como dele e pode ser desfeito. As regras de `extensoesPedidos` MUST aceitar as ações novas, com o mesmo limite de 20 ações e 5 pedidos pendentes por jogador.

#### Scenario: Pedido aprovado depois de mudança
- **WHEN** um jogador pede para alterar a ficha f1 e, antes da aprovação, o mestre apaga f1
- **THEN** ao aprovar, a revalidação recusa o pedido como inválido e o jogador é avisado

### Requirement: Origem e histórico
Itens alterados por extensão SHALL receber `origem { extensao, lote }` do lote mais recente. A seção "O que esta extensão criou" da tela da extensão MUST passar a listar também as alterações e exclusões de cada lote, com o desfazer descrito acima.

#### Scenario: Histórico mostra alteração
- **WHEN** um lote alterou duas fichas
- **THEN** o histórico mostra o lote com "2 fichas alteradas" e o botão de desfazer

### Requirement: Alteração no criador e no ensaio
O prompt da IA SHALL descrever `RPG.alterar`, `RPG.excluir` e as permissões a partir de `capacidades.ts`. No ensaio, `alterar` e `excluir` MUST mostrar a mesma tela de aprovação com "antes → depois", calculada sobre os dados reais ou de exemplo, sem gravar nada.

#### Scenario: Ensaio de exclusão
- **WHEN** no ensaio a extensão exclui a ficha de exemplo f2 e o mestre aprova a simulação
- **THEN** a promise resolve com ids fictícios e a ficha continua existindo
