## Why

Hoje uma extensão não consegue reproduzir algo como as **Marcas de Pacto**. Faltam três peças:

1. Estado privado: o estado (`dadosJson`) é um único JSON dentro do documento da instalação, e todo jogador que vê a extensão o lê.
2. Escrita do jogador: o jogador roda em somente leitura, e criar conteúdo só funciona por pedido aprovado.
3. Alteração de dados: a extensão só cria fichas e missões, e não consegue alterar nem excluir as que já existem.

Por isso, qualquer mecânica com segredo do mestre, conteúdo entregue a um jogador só ou progresso do jogador acaba como extensão nativa em React, presa a uma mesa. Esta change é a **E7** da plataforma de extensões. Ela fecha essas lacunas para que esse tipo de mecânica seja feito com uma extensão comum, criada no criador com IA e gerenciada na tela Extensões.

**Ordem e dependências:** E7 vem depois das fases E0 a E6, já implementadas. Ela depende do broker e do catálogo de permissões (E2), da escrita em lote com aprovação e desfazer (E3), dos pedidos de jogador e do `AutomacoesHost` (E4), do kill switch e da prioridade (E5) e do pacote `.rpgext.json` (E6). Ela não depende das changes 02 a 08 de Mapas com IA.

## What Changes

- **Estado por escopo.** A extensão passa a guardar dados em quatro escopos, cada um protegido pelas regras do Firestore, não só pela ponte:
  - `compartilhado`: o `dadosJson` atual. O mestre escreve, e todos que veem a extensão leem.
  - `mestre`: só o mestre lê e grava. É onde ficam gabaritos e lore.
  - `porJogador`: um documento por jogador. O mestre grava, e só aquele jogador lê o seu.
  - `doJogador`: um documento por jogador. O jogador grava o seu sem aprovação, e o mestre lê todos.
- **Ponte nova `RPG.estado`.** Traz `ler`, `salvar`, `listar` (só o mestre) e `aoMudar`, que atualiza em tempo real quando o mestre libera algo ou o jogador responde. `RPG.salvar` e `RPG.aoCarregar` continuam iguais e passam a ser um atalho para o escopo `compartilhado`.
- **Manifesto e consentimento.** O manifesto declara `estado: [escopos]`, e o mestre aprova os escopos ao publicar ou instalar (`estadoAprovado`). Aprovar `doJogador` é o que libera a escrita dos jogadores. O consentimento explica cada escopo.
- **Evento `estado.jogadorSalvou`.** É entregue à instância de segundo plano do mestre (E4) quando um jogador grava no escopo `doJogador`.
- **Alterar e excluir dados existentes.** A ponte ganha `RPG.alterar(tipo, id, mudancas)` e `RPG.excluir(tipo, id)` para fichas e missões, com as permissões novas `alterar:fichas` e `alterar:missoes`. O fluxo é o mesmo do E3: tela de aprovação, agora com o "antes → depois", lote atômico e **desfazer**, que restaura a versão anterior. Para o jogador, a chamada vira um **pedido**, como no E4.
- **Gerenciamento na tela Extensões.** Cada extensão instalada ganha um painel **"Dados"**. Nele o mestre vê o uso por escopo e por jogador, lê e edita o JSON dos escopos `mestre` e `porJogador`, lê o `doJogador`, limpa os dados de um jogador, faz backup e restaura. A tela também mostra os escopos aprovados, e reaprovar segue a regra de permissões.
- **Criador de extensões.**
  - O prompt da IA ensina os escopos e manda nunca pôr segredo no HTML.
  - O painel do manifesto ganha a seção "Onde guarda dados".
  - O mestre pode preencher **dados iniciais** dos escopos `mestre` e `compartilhado`, que ficam na biblioteca e são semeados na mesa ao instalar.
  - O ensaio simula os quatro escopos em memória, com troca entre "mestre" e jogadores de exemplo, e simula `alterar` e `excluir` sem gravar.
- **Pacote `.rpgext.json`.** Leva os escopos pedidos no manifesto, mas **nunca** os dados de nenhum escopo nem os dados iniciais.

**O que não muda:** extensões já publicadas continuam funcionando sem nenhuma ação, porque `dadosJson` vira o escopo `compartilhado` e não há migração. Também não mudam:
- as Marcas de Pacto nativas;
- as regras atuais de fichas, missões, pedidos e lotes, que só ganham campos opcionais;
- mapas de imagem, mapas de cena, zonas, coberturas, pinos, jogadores, sessões e IA de mapas.

## Capabilities

### New Capabilities
- `extensoes-estado-por-escopo`: estado da extensão nos escopos `compartilhado`, `mestre` e `porJogador`, protegido pelas regras do Firestore. Cobre a ponte `RPG.estado`, a declaração no manifesto com aprovação do mestre, o painel "Dados" da tela Extensões e o suporte no criador (prompt, dados iniciais, ensaio).
- `extensoes-escrita-do-jogador`: escopo `doJogador`, em que o jogador grava o próprio estado sem aprovação, com limites, kill switch e ocultação aplicados no servidor. Cobre também o evento `estado.jogadorSalvou` para o mestre e a leitura e limpeza pelo mestre.
- `extensoes-alterar-dados`: `RPG.alterar` e `RPG.excluir` de fichas e missões existentes, com permissões próprias, aprovação mostrando o "antes → depois", desfazer que restaura a versão anterior e pedido quando quem chama é o jogador. Inclui o ensaio no criador e o histórico na tela da extensão.

### Modified Capabilities
<!-- As extensões ainda não têm spec em openspec/specs/ (foram documentadas em docs/base-conhecimento/features/extensoes.md). Nenhum spec existente muda. -->

## Impact

- **Firestore:** nova subcoleção `mesas/{id}/extensoes/{extId}/estado/{docId}` (`mestre`, `para_{uid}`, `de_{uid}`). Também há campos opcionais novos:
  - na instalação: `estadoAprovado`;
  - na biblioteca: `estadoInicial`;
  - em `extensoesLotes`: `antes` para desfazer alterações.
- **`firestore.rules`:** um bloco novo para `estado/` que confere o escopo aprovado, `ativa != false` e `visivelJogadores` para jogadores, além do limite de tamanho e das chaves permitidas. Há testes de regras novos.
- **Código:**
  - `src/lib/extensoes/`: `manifesto.ts`, `capacidades.ts`, `documento.ts` (ponte), `broker.ts`/`broker-puro.ts`, `acoes.ts`, `lote.ts`, `escrita.ts`, `pedidos.ts`, `eventos.ts`, `pacote.ts`, `prompt.ts`, `dados.ts`, e um módulo novo `estado.ts`;
  - `src/components/extensoes/`: `Sandbox`, `CriadorExtensao`, `PainelExtensao`, `HistoricoExtensao`, `AutomacoesHost`, `PedidosPendentes`, `proponente.ts`, e um componente novo `PainelDadosExtensao`;
  - `src/components/telas/ListaExtensoes.tsx`.
- **Rotas de servidor:** nenhuma nova. Tudo é gravado pelo cliente com as credenciais de quem usa, e as regras são a barreira.
- **Custo:** cada gravação do jogador faz duas leituras extras nas regras (mesa e instalação). Não há chamada de IA nova.
- **Base de conhecimento:** atualizar `features/extensoes.md`, `fluxos/criar-extensao.md`, `permissoes-e-seguranca.md`, `glossario.md` e o `CHANGELOG.md`. Corrigir também o link quebrado para `docs/planejamento/plano-plataforma-de-extensoes.md`, que não existe mais.
