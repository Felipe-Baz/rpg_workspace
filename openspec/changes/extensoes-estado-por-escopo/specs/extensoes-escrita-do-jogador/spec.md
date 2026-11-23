## ADDED Requirements

### Requirement: Jogador grava o próprio estado sem aprovação
Com o escopo `doJogador` aprovado, a instância de um jogador SHALL poder chamar `RPG.estado.salvar("doJogador", objeto)` e `RPG.estado.ler("doJogador")`. Essas chamadas gravam e leem só o documento `de_{uid}` da própria conta, sem passar pela tela de aprovação do mestre e sem criar pedido.
- O jogador MUST NOT gravar o documento de outra conta.
- O jogador MUST NOT gravar os escopos `compartilhado`, `mestre` e `porJogador`.
- `RPG.somenteLeitura` continua `true` para o jogador, porque se refere ao estado `compartilhado`. A ponte SHALL expor `RPG.podeSalvar(escopo)` para a extensão saber o que pode gravar.

#### Scenario: Jogador responde um enigma
- **WHEN** o jogador j1 chama `RPG.estado.salvar("doJogador", {resposta: "..."})` numa extensão com `doJogador` aprovado
- **THEN** o documento `de_{uid de j1}` é gravado na hora, sem aparecer nenhuma aprovação para o mestre

#### Scenario: Escopo não aprovado
- **WHEN** o jogador chama `salvar("doJogador", ...)` e o mestre não aprovou `doJogador`
- **THEN** a promise rejeita e nada é gravado

### Requirement: Regras do servidor para a escrita do jogador
As regras do Firestore SHALL permitir `create` e `update` em `estado/de_{uid}` só quando todas as condições abaixo valem:
- quem grava é a conta `uid` e é membro da mesa;
- a instalação existe, tem `visivelJogadores == true`, `ativa != false` e `doJogador` em `estadoAprovado`;
- o documento tem só as chaves `json`, `uid` e `atualizadoEm`;
- `uid` é igual à conta que grava e `json` é texto de no máximo 50.000 caracteres.

O mestre MUST poder ler e apagar `de_{uid}` de qualquer jogador. O mestre MUST NOT gravar conteúdo em nome do jogador. O jogador MUST NOT apagar o próprio documento, porque limpar é papel do mestre.

#### Scenario: Gravação direta forjada
- **WHEN** a conta A tenta, pelo SDK, gravar `estado/de_B` ou gravar `de_A` com uma chave extra
- **THEN** o Firestore nega

#### Scenario: Extensão desligada no meio da sessão
- **WHEN** o mestre desliga a extensão e o jogador tenta gravar
- **THEN** o Firestore nega e a promise rejeita com mensagem de extensão indisponível
- **AND** o que já estava gravado é preservado

### Requirement: Limite de frequência de gravação
O broker SHALL limitar a 10 gravações por minuto por extensão as gravações do jogador em `doJogador`. A gravação que exceder MUST ser rejeitada com erro, sem acumular em fila. O teto de 50 KB por documento é o limite que vale também no servidor.

#### Scenario: Gravação em excesso
- **WHEN** a extensão de um jogador chama `salvar("doJogador", ...)` pela 11ª vez em menos de um minuto
- **THEN** a chamada rejeita com "Muitas gravações; tente de novo em instantes"

### Requirement: Mestre acompanha o que os jogadores gravam
A extensão do mestre SHALL acompanhar as gravações dos jogadores por três vias:
- `RPG.estado.listar("doJogador")` devolve todos os documentos, com chave pelo id de jogador;
- `RPG.estado.aoMudar("doJogador", fn)` recebe `{ jogador, dados }` a cada mudança;
- um evento `estado.jogadorSalvou`, adicionado ao catálogo de `eventos.ts`, chega à instância de segundo plano do mestre (`AutomacoesHost`) com `{ jogador, atualizadoEm }`, sem o conteúdo.

Esse evento MUST obedecer aos controles de evento existentes: limite de 10 por minuto, só com a mesa aberta pelo mestre e a primeira leitura servindo só de base. Ele MUST exigir o escopo `doJogador` aprovado, e não uma permissão `ler:*`.

#### Scenario: Mestre é avisado de uma resposta
- **WHEN** um jogador grava em `doJogador` enquanto o mestre está com a mesa aberta e a extensão declara o evento `estado.jogadorSalvou`
- **THEN** o handler `RPG.aoEvento("estado.jogadorSalvou", fn)` da instância de segundo plano é chamado com o id do jogador

#### Scenario: Abrir a mesa não dispara eventos antigos
- **WHEN** o mestre abre a mesa e já existem documentos `de_*` gravados enquanto ele estava fora
- **THEN** nenhum evento `estado.jogadorSalvou` é disparado por esses documentos

### Requirement: Gerenciamento da escrita do jogador
O painel "Dados" da tela Extensões SHALL mostrar os documentos `doJogador` de cada jogador em somente leitura, com tamanho e última alteração, e permitir apagá-los por jogador. A tela de consentimento MUST destacar que aprovar `doJogador` permite a cada jogador gravar até 50 KB sem aprovação.

#### Scenario: Mestre limpa as respostas de um jogador
- **WHEN** o mestre apaga os dados `doJogador` de j1 no painel
- **THEN** o documento `de_{uid de j1}` é removido
- **AND** a extensão de j1 recebe `null` em `aoMudar("doJogador")`

### Requirement: Escrita do jogador no criador
O prompt da IA SHALL explicar que, para progresso, respostas e anotações do jogador, a extensão deve usar `doJogador` em vez de `RPG.criar`. O prompt MUST explicar também que o que o jogador grava é dado não confiável, que a extensão do mestre deve validar antes de usar. No ensaio, a visão de um jogador de exemplo MUST gravar `doJogador` no estado simulado, e o "Simular evento" MUST oferecer `estado.jogadorSalvou`.

#### Scenario: Ensaio de resposta do jogador
- **WHEN** no ensaio a visão j1 grava `doJogador` e o mestre volta para a própria visão
- **THEN** `listar("doJogador")` devolve o valor gravado por j1
- **AND** nada é gravado no Firestore
