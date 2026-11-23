## ADDED Requirements

### Requirement: Escopos de estado da extensão
O sistema SHALL oferecer a cada extensão instalada numa mesa quatro escopos de estado, cada um com dono e leitores fixos:
- `compartilhado`: o mestre grava; todos que veem a extensão leem.
- `mestre`: só o mestre lê e grava.
- `porJogador`: um documento por conta de jogador; o mestre grava; só aquele jogador (e o mestre) lê.
- `doJogador`: um documento por conta de jogador; o próprio jogador grava; ele e o mestre leem (detalhado em `extensoes-escrita-do-jogador`).

Cada documento de escopo MUST ter no máximo 50 KB de JSON. O escopo `compartilhado` MUST continuar sendo o campo `dadosJson` da instalação, sem migração. Os demais MUST ficar na subcoleção `mesas/{mesaId}/extensoes/{extId}/estado/`, com ids `mestre`, `para_{uid}` e `de_{uid}`.

#### Scenario: Extensão antiga continua igual
- **WHEN** uma extensão publicada antes desta change chama `RPG.salvar(obj)` e `RPG.aoCarregar(fn)`
- **THEN** o estado é gravado e lido em `dadosJson` exatamente como antes, sem nenhuma ação do mestre

#### Scenario: Limite de tamanho
- **WHEN** uma extensão tenta salvar mais de 50 KB em qualquer escopo
- **THEN** a chamada é rejeitada com erro e o documento anterior fica intacto

### Requirement: Proteção dos escopos no servidor
As regras do Firestore SHALL impor o acesso de cada escopo, independentemente do que a ponte ou o broker fizerem.
- O documento `mestre` MUST ser legível e gravável só pelo mestre (`donoUid` da mesa).
- O documento `para_{uid}` MUST ser gravável só pelo mestre e legível só pelo mestre e pela conta `uid`. Um jogador MUST NOT listar a subcoleção `estado/`.
- O jogador MUST ler `para_{uid}` só enquanto a instalação estiver `visivelJogadores == true`, com `ativa != false` e com `porJogador` em `estadoAprovado`.
- Qualquer escopo fora de `estadoAprovado` MUST ficar fechado para jogadores. O mestre continua podendo ler e apagar esses escopos, para limpar dados.

#### Scenario: Jogador tenta ler o gabarito
- **WHEN** um jogador da mesa faz `get` em `estado/mestre` direto pelo SDK, fora da ponte
- **THEN** o Firestore nega a leitura

#### Scenario: Jogador tenta ler o documento de outro
- **WHEN** a conta A faz `get` em `estado/para_B`
- **THEN** o Firestore nega a leitura

#### Scenario: Extensão oculta ou desligada
- **WHEN** o mestre oculta a extensão dos jogadores ou a desliga pelo kill switch
- **THEN** o jogador deixa de ler `para_{uid}`
- **AND** os documentos continuam guardados e voltam a ser legíveis quando a extensão é reexibida ou religada

### Requirement: Ponte `RPG.estado`
A ponte SHALL expor `RPG.estado` com estas operações:
- `ler(escopo, opcoes?)`
- `salvar(escopo, objeto, opcoes?)`
- `listar(escopo)`, só para o mestre, que devolve um mapa de jogador para objeto
- `aoMudar(escopo, fn, opcoes?)`, que é chamada a cada mudança em tempo real

Jogadores MUST ser identificados pelo **id de jogador** de `RPG.ler("jogadores")`, nunca por uid. O broker converte o id na conta correspondente. A ponte SHALL expor `RPG.eu` com o id de jogador da conta atual (`null` para o mestre).

Toda operação MUST passar pelo broker, que valida o formato, confere se o escopo está em `estadoAprovado` e se o papel pode fazer a operação, e só então lê ou grava com as credenciais de quem usa. `RPG.salvar` e `RPG.aoCarregar` MUST continuar como atalhos de `compartilhado`.

#### Scenario: Mestre entrega conteúdo a um jogador
- **WHEN** a extensão do mestre chama `RPG.estado.salvar("porJogador", {etapa: 2}, {jogador: "j1"})`
- **THEN** o documento `para_{uid de j1}` é gravado
- **AND** o `aoMudar("porJogador", fn)` aberto pelo jogador j1 recebe `{etapa: 2}` sem recarregar a extensão

#### Scenario: Jogador sem conta
- **WHEN** o mestre grava `porJogador` para um jogador que ainda não entrou na mesa com uma conta
- **THEN** a promise rejeita com uma mensagem dizendo que aquele personagem ainda não tem conta

#### Scenario: Escopo não aprovado
- **WHEN** a extensão chama `RPG.estado.ler("mestre")` e o mestre não aprovou o escopo `mestre`
- **THEN** a promise rejeita com "Escopo não aprovado: mestre"

#### Scenario: Jogador pede escopo do mestre
- **WHEN** a instância de um jogador chama `RPG.estado.ler("mestre")` ou `RPG.estado.listar("porJogador")`
- **THEN** o broker recusa sem consultar o Firestore

### Requirement: Escopos no manifesto e aprovação do mestre
O manifesto SHALL aceitar `estado: Escopo[]` com os escopos que a extensão **pede**. `normalizarManifesto` MUST descartar valores desconhecidos e repetidos. A instalação MUST guardar `estadoAprovado`, e só os escopos aprovados valem.
- Publicar ou instalar MUST mostrar, na tela de consentimento, o que cada escopo significa, por exemplo "guarda dados que só você vê" ou "cada jogador poderá gravar até 50 KB sem a sua aprovação".
- Pedir um escopo novo numa atualização MUST exigir nova aprovação, como já acontece com as permissões.
- Reprovar um escopo depois NÃO apaga os dados: só fecha o acesso.

#### Scenario: Atualização pede escopo novo
- **WHEN** o mestre republica uma extensão cujo manifesto passou a pedir `porJogador`
- **THEN** a tela de consentimento lista o escopo novo
- **AND** sem aprovação a instalação mantém o `estadoAprovado` anterior

### Requirement: Painel "Dados" na tela Extensões
A tela Extensões SHALL oferecer ao mestre, para cada extensão instalada na mesa, um painel "Dados" com estas funções:
- **uso:** tamanho de cada escopo e lista de jogadores com documento em `porJogador` e `doJogador`, com data da última alteração;
- **visualização e edição:** o JSON de qualquer escopo; edição de `compartilhado`, `mestre` e `porJogador`, com validação de JSON e de tamanho antes de gravar;
- **limpeza:** apagar os dados de um jogador (nos dois escopos por jogador) ou de um escopo inteiro, com confirmação na própria interface;
- **backup:** exportar um backup `.json` de todos os escopos e restaurar a partir dele os escopos `compartilhado`, `mestre` e `porJogador` (o `doJogador` entra no arquivo só para consulta, porque só o próprio jogador grava esse escopo);
- **escopos aprovados:** ver quais estão aprovados, revogar e reaprovar.

O backup MUST avisar que contém dados privados (gabarito, respostas dos jogadores). Remover a extensão da mesa MUST apagar a subcoleção `estado/` junto, depois de uma confirmação que diz isso.

#### Scenario: Mestre corrige o gabarito
- **WHEN** o mestre edita o JSON do escopo `mestre` no painel e salva um JSON válido de até 50 KB
- **THEN** o documento é gravado
- **AND** a extensão aberta recebe a mudança por `aoMudar`

#### Scenario: Restaurar backup
- **WHEN** o mestre restaura um backup cujo jogador não existe mais na mesa
- **THEN** os escopos da mesa e dos jogadores existentes são restaurados
- **AND** os dados do jogador ausente são ignorados com um aviso

### Requirement: Escopos no criador de extensões
O criador SHALL ter estes pontos de suporte aos escopos:
- **Prompt da IA:** o prompt (`prompt.ts`) MUST descrever os escopos e a API `RPG.estado` a partir da mesma fonte usada pelo broker e pelo consentimento. Ele MUST instruir a IA a **nunca** pôr no HTML segredos, gabaritos ou conteúdo que o jogador não deve ver, e a guardar esse conteúdo no escopo `mestre`.
- **Painel do manifesto:** MUST ter uma seção "Onde guarda dados" para ligar e desligar cada escopo.
- **Dados iniciais:** o mestre SHALL poder preencher dados iniciais para `mestre` e `compartilhado`, guardados na biblioteca (`estadoInicial`) e semeados na mesa só quando o documento ainda não existe.

#### Scenario: Semeadura não sobrescreve
- **WHEN** o mestre reinstala uma extensão numa mesa onde o escopo `mestre` já tem dados
- **THEN** os dados existentes são mantidos e os dados iniciais são ignorados

#### Scenario: Pacote não leva dados
- **WHEN** o mestre exporta a extensão como `.rpgext.json`
- **THEN** o arquivo contém os escopos pedidos no manifesto
- **AND** não contém `estadoInicial` nem dado de nenhum escopo

### Requirement: Ensaio dos escopos
A prévia do criador SHALL simular os quatro escopos em memória, sem gravar nada.
- O mestre MUST poder alternar a visão entre "mestre" e cada jogador de exemplo (ou real, conforme a fonte de dados).
- O ensaio MUST ver e editar o estado simulado de cada escopo e registrar as chamadas no registro do ensaio.
- O ensaio MUST aplicar as mesmas recusas do broker: escopo não pedido, papel sem acesso e tamanho.

#### Scenario: Ensaiar a entrega para um jogador
- **WHEN** no ensaio o mestre grava `porJogador` para j1 e troca a visão para j1
- **THEN** a prévia de j1 lê o valor gravado
- **AND** nenhum documento do Firestore é criado ou alterado

### Requirement: Compatibilidade com o restante do app
Esta capacidade MUST NOT alterar:
- o comportamento de mapas de imagem, mapas de cena, zonas, coberturas, pinos, jogadores, sessões, fichas, missões e Marcas de Pacto nativas;
- as regras atuais dessas coleções.

#### Scenario: Mapas e jogadores intactos
- **WHEN** a suíte de testes de regras e de unidade atual roda depois desta change
- **THEN** todos os testes existentes de mapas, coberturas, pinos, jogadores e Marcas continuam passando sem alteração
