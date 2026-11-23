## 1. Catálogo de escopos e manifesto

- [x] 1.1 Criar `src/lib/extensoes/estado.ts` (puro) com `ESCOPOS` (`compartilhado`, `mestre`, `porJogador`, `doJogador`: rótulo, quem lê, quem grava, texto de consentimento), `normalizarEscopos`, `idDocEstado(escopo, uid)` e `MAX_ESTADO = 50_000`
- [x] 1.2 Adicionar `estado: Escopo[]` ao `Manifesto` e a `normalizarManifesto`/`manifestoPadrao` (padrão `[]`); testes em `manifesto.test.ts`
- [x] 1.3 Adicionar `estadoAprovado?: Escopo[]` a `ExtensaoMesa` e `estadoInicial?: { compartilhado?: string; mestre?: string }` a `ExtensaoBiblioteca` (`dados.ts`)
- [x] 1.4 Estender `textoConsentimento` para listar os escopos pedidos, com destaque para `doJogador`, e para lembrar que o HTML é visível aos jogadores; testes em `capacidades.test.ts`

## 2. Regras do Firestore para `estado/`

- [x] 2.1 Adicionar `match /estado/{docId}` dentro de `mesas/{mesaId}/extensoes/{extId}`, com `inst()`, as regras do mestre (ler, listar e apagar tudo; gravar `mestre` e `para_*`, nunca `de_*`) e as do jogador (`get` do próprio `para_`/`de_`, `create`/`update` do próprio `de_` com chaves, dono, tamanho, `visivelJogadores`, `ativa` e `estadoAprovado`)
- [x] 2.2 Testes de regras (textuais sobre `firestore.rules`, como os existentes; o emulador do Firestore não está configurado no projeto): o jogador não lê `mestre` nem `para_` de outro, não lista, não grava `de_` de outro nem com chave extra; tudo fecha com a extensão oculta ou desligada ou com o escopo não aprovado; o mestre não forja `de_*`
- [x] 2.3 Rodar a suíte de regras existente e confirmar que nada mudou para mapas, coberturas, pinos, fichas, missões, pedidos e Marcas

## 3. Ponte e broker de estado

- [x] 3.1 Em `documento.ts`, adicionar `RPG.estado.{ler,salvar,listar,aoMudar}`, `RPG.eu` e `RPG.podeSalvar(escopo)`; `RPG.salvar`/`aoCarregar` continuam apontando para `compartilhado`
- [x] 3.2 Em `capacidades.ts`/`broker-puro.ts`, validar pedidos `op: "estado"` (escopo, operação, `jogador`, tamanho) e autorizar por papel e `estadoAprovado`; testes puros
- [x] 3.3 No broker (`broker.ts`), converter id de jogador em uid via `mesa.jogadores`, ler e gravar `estado/{docId}` com as credenciais do usuário e devolver `listar` com chave pelo id de jogador; tratar jogador sem conta como erro
- [x] 3.4 Limitar a 10 gravações por minuto por extensão em `doJogador` no broker, com teste
- [x] 3.5 Em `Sandbox.tsx`, abrir `onSnapshot` sob demanda para `aoMudar`, repassar mudanças por `postMessage` (`rpg: "estado"`) e fechar ao desmontar
- [x] 3.6 Passar `estadoAprovado`, papel e `RPG.eu` por `PainelExtensao`/`ExecutarExtensao`/`Slot`/`AcoesSlot` até o broker

## 4. Evento `estado.jogadorSalvou`

- [x] 4.1 Adicionar o evento ao catálogo `eventos.ts`, exigindo o escopo `doJogador` aprovado em vez de `ler:*`; testes em `eventos.test.ts`
- [x] 4.2 Em `AutomacoesHost`, assinar `de_*` das extensões com o evento, detectar mudança por `atualizadoEm` (a primeira leitura é só base) e entregar `{ jogador, atualizadoEm }` com o limite de 10 por minuto

## 5. Publicar, instalar e remover

- [x] 5.1 Em `publicarNaMesa`, gravar `estadoAprovado` e semear `estado/mestre` e `dadosJson` a partir de `estadoInicial` só quando ainda não existem
- [x] 5.2 Na tela de consentimento (criador e "Usar aqui" da biblioteca), exibir os escopos pedidos e exigir nova aprovação quando surgir um escopo novo
- [x] 5.3 Em `removerDaMesa`, apagar a subcoleção `estado/` em lotes antes do documento da instalação, com confirmação na interface que avisa disso
- [x] 5.4 Em `pacote.ts`, levar `estado` do manifesto e nunca `estadoInicial`; testar export e import

## 6. Painel "Dados" na tela Extensões

- [x] 6.1 Criar `PainelDadosExtensao` (só mestre): uso por escopo e lista de jogadores com tamanho e última alteração
- [x] 6.2 Visualizar o JSON de qualquer escopo; editar `compartilhado`, `mestre` e `porJogador` com validação de JSON e de 50 KB
- [x] 6.3 Limpar os dados de um jogador (`para_` e `de_`) ou de um escopo inteiro, com confirmação na interface
- [x] 6.4 Backup (`{ versao, extId, escopos }` com chave pelo id de jogador, com aviso de dados privados) e restauração (converte id em uid, ignora ausentes com aviso)
- [x] 6.5 Mostrar escopos aprovados, revogar e reaprovar; destacar "não aprovado com dados"
- [x] 6.6 Abrir o painel a partir do cartão em `ListaExtensoes` e da tela da extensão (`ExecutarExtensao`) para o mestre

## 7. Criador de extensões (escopos)

- [x] 7.1 Em `prompt.ts`, injetar a descrição gerada de `ESCOPOS` e `RPG.estado`, a regra "nunca pôr segredo no HTML" e o uso de `doJogador` para progresso e respostas (dado não confiável)
- [x] 7.2 Seção "Onde guarda dados" no `PainelEncaixes` do criador, ligada a `manifesto.estado`, com aviso fixo quando `mestre` estiver ligado
- [x] 7.3 Editor de "Dados iniciais" (`mestre`, `compartilhado`) gravado em `estadoInicial` da biblioteca
- [x] 7.4 `EstadoEnsaio` em memória e seletor "Ver como: mestre | jogador…" no lugar de `comoJogador`; o broker de ensaio aplica as mesmas recusas e registra as chamadas
- [x] 7.5 Visualizar e editar o estado simulado por escopo na prévia; oferecer `estado.jogadorSalvou` em "Simular evento"

## 8. Alterar e excluir dados

- [x] 8.1 Em `capacidades.ts`, adicionar as permissões `alterar:fichas` e `alterar:missoes` com textos de consentimento; `escreve()` passa a cobri-las; testes
- [x] 8.2 Em `acoes.ts`, adicionar `op: "criar" | "alterar" | "excluir"` (padrão `criar`), validação de mudanças por lista fechada de campos (ficha: `nome`, `texto`, `categoria`, `liberarPara`; missão: `titulo`, `descricao`, `categoria`, `dificuldade`, `status`, `etapas` com `id`) e `permissaoDaAcao` por operação; testes
- [x] 8.3 Em `lote.ts`, adicionar uma função pura que, dados os documentos atuais, calcula o resultado de cada alteração, o "antes → depois" para o resumo e o `antes` para o desfazer; recusa fichas sem `mestre: true` e ids inexistentes; testes
- [x] 8.4 Em `resumirAcoes`, mostrar o "antes → depois" com a liberação em nomes de jogadores e destaque para exclusões
- [x] 8.5 Em `escrita.ts`, ler os documentos atuais, gravar num único `writeBatch` (missões: `missoesMestre` mais `derivarPublica`), registrar `antes` e o hash do depois no lote e resolver com `{ lote, criados, alterados, excluidos, avisos }`
- [x] 8.6 Em `desfazerLote`, restaurar alterados, recriar excluídos e apagar criados; detectar edição posterior pelo hash e exigir confirmação por item na interface
- [x] 8.7 Na ponte, adicionar `RPG.alterar`/`RPG.excluir`; em `proponente.ts`, usar a tela de aprovação com o "antes → depois"
- [x] 8.8 Para o jogador, em `pedidos.ts`, aceitar as ações novas (a regra de `extensoesPedidos` já aceita qualquer lista de 1 a 20 ações e não precisou mudar); na aprovação, revalidar contra os dados atuais em `PedidosPendentes`
- [x] 8.9 Em `HistoricoExtensao`, listar alterações e exclusões por lote
- [x] 8.10 Ensaio: `alterar`/`excluir` mostram a aprovação sobre dados reais ou de exemplo sem gravar; o prompt descreve a API a partir de `capacidades.ts`

## 9. Base de conhecimento

- [x] 9.1 Atualizar `docs/base-conhecimento/features/extensoes.md` (escopos, `RPG.estado`, escrita do jogador, alterar e excluir, painel "Dados", limites) e mover os itens implementados para fora de "O que ainda é plano"
- [x] 9.2 Atualizar `fluxos/criar-extensao.md`, `permissoes-e-seguranca.md` (regras de `estado/`) e `glossario.md` (escopo); corrigir o link quebrado para `docs/planejamento/plano-plataforma-de-extensoes.md`
- [x] 9.3 Registrar no `CHANGELOG.md` da base

## 10. Verificação

- [x] 10.1 `npm test`, testes de regras e `tsc`/lint passando
- [ ] 10.2 Compatibilidade: uma extensão publicada antes da change (só `RPG.salvar`/`aoCarregar`, sem `estado` no manifesto) funciona igual para mestre e jogador
- [ ] 10.3 Compatibilidade com mapas de imagem e demais recursos: abrir mapas de imagem e de cena, coberturas, pinos privados, jogadores e Marcas de Pacto nativas sem nenhuma mudança de comportamento; a suíte existente passa sem alterações
- [ ] 10.4 Ponta a ponta numa mesa de teste: extensão de "enigmas por jogador" criada no criador (gabarito em Dados iniciais, `porJogador` para etapas, `doJogador` para respostas); o jogador vê só a própria etapa, responde, e o mestre recebe o evento e dá o veredito
- [ ] 10.5 Tentar, pelo console do navegador como jogador, ler `estado/mestre` e o `para_` de outro jogador e gravar `de_` de outro: todas as tentativas são negadas
- [ ] 10.6 Alteração ponta a ponta: liberar uma ficha a um jogador por `RPG.alterar`, excluir uma missão, desfazer o lote e conferir a restauração completa (inclusive `missoesMestre`)
