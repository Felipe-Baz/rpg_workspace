# Extensões

## O que é
**Extensões** são mini-aplicativos (um HTML único) que o mestre cria **conversando com a IA**, instala na mesa e, se quiser, libera aos jogadores. Rodam em **iframe isolado** e se **encaixam** em telas do app. Há também **extensões nativas** (código React do app, exclusivas de certas mesas).

## Por que existe
É o diferencial do produto: cada mesa tem necessidades próprias (gerador de tesouro, tabela de rumores, ficha customizada). Em vez de o produto prever tudo, o mestre pede e a IA constrói. Extensões são **cidadãs de primeira classe**: aparecem na mesma sidebar das ferramentas nativas, com etiqueta "Extensão".

## Como funciona
- **Biblioteca do mestre** (`extensoes/{id}`, `donoUid`): privada e reaproveitável em várias mesas. Campos: título, descrição, `html`, `conversa` (chat de criação), `manifesto`, `arquivada`. Fica fora de `usuarios/{uid}`, que o cliente nunca acessa.
- **Instalação na mesa** (`mesas/{id}/extensoes/{id}`): é uma **cópia** do documento (jogadores não leem a biblioteca). Tem `visivelJogadores`. `publicarNaMesa`, `removerDaMesa`, `definirVisibilidade`.
- **Criação (`CriadorExtensao`):** tela dedicada com **chat + prévia ao vivo**. `POST /api/ia/extensao { mesaId, mensagens, htmlAtual? }` devolve `{ explicacao, html|null, provedor }`. O prompt (`prompt.ts`) instrui a IA a: perguntar só se o pedido for vago, devolver HTML completo e um **manifesto** JSON dizendo onde aparece. Rascunho local até "Salvar" ou "Publicar na mesa". Nada é salvo pela rota.
- **Manifesto (`manifesto.ts`):** `{ versao: 1, encaixes: [{ slot, rotulo, papeis, altura }] }`. `normalizarManifesto` descarta slots desconhecidos/repetidos e papéis que o slot não aceita; sem manifesto = só `sidebar`. **Fonte única** dos encaixes: UI, validação e prompt leem de `SLOTS`.
- **Encaixes existentes:**

| Slot | Onde | Quem |
|---|---|---|
| `sidebar` | Item na sidebar que abre a extensão em tela cheia | mestre, jogador |
| `diario.jogador` | Seção em "Meu diário" (inline) | jogador |
| `visao-geral` | Cartão na Visão geral (inline) | mestre |
| `sessao.painel` | Painel na Sessão ao vivo (inline) | mestre |
| `missao.acoes` | Botão em cada missão do mestre; abre a extensão num diálogo com a missão em `RPG.contexto` | mestre |
| `ficha.acoes` | Botão em cada ficha do mestre; abre a extensão com a ficha em `RPG.contexto` | mestre |
| `ctrlk` | Comando na busca Ctrl+K | mestre, jogador |

  Os **inline** (`SLOTS_INLINE`) renderizam o painel dentro de outra tela via `<Slot>`; os de **ação** (`SLOTS_ACAO`) viram botões (`AcoesSlot`) que abrem a extensão num diálogo com o contexto do item; os demais só levam à tela da extensão. Altura inline: 160–900 px (padrão 360).
- **Execução (`Sandbox` + `documento.ts`):** `montarDocumento` injeta CSP, tema (variáveis `--accent`, `--gold`, `--background`…) e a ponte `window.RPG`:
  - `RPG.salvar(obj)`: guarda JSON (≤ 50 KB), só quando `RPG.somenteLeitura` é falso;
  - `RPG.aoCarregar(fn)`: recebe o último estado salvo;
  - `RPG.somenteLeitura`: `true` para jogador (a extensão deve esconder botões de edição).
- **Estado por escopo (E7):** além do estado único acima (agora chamado escopo `compartilhado`), a extensão pode guardar dados em escopos com dono e leitores fixos, **impostos pelas regras do Firestore** (catálogo `ESCOPOS` em `estado.ts`, fonte única de broker, consentimento, prompt e criador):

| Escopo | Onde mora | Quem grava | Quem lê |
|---|---|---|---|
| `compartilhado` | `dadosJson` da instalação (sem migração) | mestre | todos que veem a extensão |
| `mestre` | `extensoes/{extId}/estado/mestre` | mestre | só o mestre (gabaritos, segredos) |
| `porJogador` | `.../estado/para_{uid}` | mestre | só aquele jogador (e o mestre) |
| `doJogador` | `.../estado/de_{uid}` | o próprio jogador, **sem aprovação** | ele e o mestre (o mestre nunca grava, só apaga) |

  - **API:** `RPG.estado.ler(escopo, {jogador?})`, `salvar(escopo, dados, {jogador?})`, `listar("porJogador"|"doJogador")` (só mestre; chave = id de jogador) e `aoMudar(escopo, fn, {jogador?})` em tempo real (o app abre `onSnapshot` e repassa por `postMessage`; o mestre num escopo por jogador sem `jogador` recebe `{ jogador, dados }` de cada um). `RPG.eu` = id de jogador de quem usa (`null` para o mestre); `RPG.podeSalvar(escopo)`. A extensão nunca vê uids: o broker converte id de jogador ↔ conta (`contaAlvo`); jogador sem conta é erro.
  - **Aprovação:** o manifesto pede `estado: [...]`; o mestre aprova ao publicar/instalar, e a instalação guarda `estadoAprovado` (as regras leem daqui). Escopo novo exige nova aprovação; revogar fecha o acesso sem apagar dados.
  - **Escrita do jogador:** só no próprio `de_{uid}`, com a extensão visível, ativa e `doJogador` aprovado; chaves `json`/`uid`/`atualizadoEm`, `json` ≤ 50.000 caracteres (regras). O broker limita a 10 gravações/min por extensão (a regra não limita frequência: um cliente adulterado só sobrescreve o próprio documento). O conteúdo é **não confiável** para a extensão do mestre.
  - **Dados iniciais:** na biblioteca (`estadoInicial`, privada) o mestre preenche JSON para `compartilhado`/`mestre`; `publicarNaMesa` semeia só o que ainda não existe. Serve para o gabarito ficar **fora do HTML**, que é visível a quem abre a extensão.
  - **Painel "Dados"** (`PainelDadosExtensao`, tela da extensão; atalho no cartão em Extensões): uso por escopo e por jogador, ver/editar JSON (`compartilhado`, `mestre`, `porJogador`; `doJogador` só leitura), limpar por jogador ou por escopo, aprovar/revogar escopos (avisa "não aprovado, com dados"), backup `.json` (chave = id de jogador; avisa que tem dados privados) e restauração (**não restaura `doJogador`**, que só o próprio jogador grava). Remover a extensão da mesa apaga `estado/` antes da instalação.
- **Ler dados da mesa (E2):** a extensão pode consultar o workspace por `await RPG.ler(alvo)`, sempre via **broker** (`broker.ts`): o iframe só manda um `postMessage`; o app valida o pedido (`validarPedido`), confere a **permissão aprovada pelo mestre** (`autorizar`), lê com as **credenciais de quem está usando** (as regras do Firestore seguem como barreira) e devolve uma versão reduzida. Também há `await RPG.rolar("2d6+3")` (sem permissão) e `RPG.permissoes` (o que foi aprovado).
  - Catálogo em `capacidades.ts` (`PERMISSOES`, fonte única de broker, consentimento e prompt da IA):

| Permissão | Alvo | O que devolve |
|---|---|---|
| `ler:mesa` | `mesa` | nome, sistema, status, descrição, totais |
| `ler:jogadores` | `jogadores` | jogador e personagem (sem foto) |
| `ler:sessoes` | `sessoes` | título, data, resumo público (nunca notas secretas) |
| `ler:missoes` | `missoes` | o que o usuário já vê; o mestre também recebe dificuldade e etapas ocultas |
| `ler:fichas` | `fichas` | as fichas que aquela conta pode ver (mestre: as dele, com anotações) |
| `ler:mundo` | `mundo` | sumário; `{ secao: id }` devolve a seção |

  - **Quem decide:** o manifesto traz `permissoes` (o que a extensão **pede**); o mestre **aprova ao publicar ou instalar** (tela de consentimento, `textoConsentimento`), e só vale o aprovado: `permissoesAprovadas` na cópia da mesa. Pedir permissão nova exige nova aprovação. Instalar da biblioteca em outra mesa também pede aprovação.
  - **Limites:** 20 pedidos/segundo por extensão; resposta ≤ 200.000 caracteres e ≤ 300 itens por lista; pedido fora do formato é recusado; só a janela do próprio iframe é atendida.
  - **Escrita (E3):** `await RPG.criar("ficha"|"missao", dados)` ou `RPG.propor([...])` (até 20 ações, uma aprovação). **Só o mestre** (o broker nem passa o proponente ao jogador) e só com `criar:fichas` / `criar:missoes` aprovadas. Fluxo: validação (`acoes.ts`) → autorização → **tela de aprovação** com o resumo do que será criado e para quem (`resumirAcoes`, `criarProponente`) → gravação em **lote atômico** (`writeBatch`, `executarLote`) → resolve com `{ lote, criados, avisos }`; se o mestre recusar, a promise rejeita. Pedidos simultâneos esperam a vez (uma aprovação por vez).
    - Fichas criadas são do mestre (`mestre: true`); `liberarPara`: `"ninguem"` (padrão), `"todos"` ou ids de jogadores (convertidos em contas; quem ainda não tem conta vira **aviso**, não liberação). Missões nascem `em_andamento`; a 1ª etapa fica visível e as demais ocultas.
    - **Origem e desfazer:** tudo recebe `origem { extensao, lote }` e cada lote é registrado em `mesas/{id}/extensoesLotes/{lote}`. Na tela da extensão, "O que esta extensão criou" lista os lotes e **desfaz o lote inteiro** (apaga os itens, inclusive editados depois; missões nos dois documentos).
    - **Contexto:** `RPG.contexto` traz o item de onde foi aberta (missão: título, status, categoria, dificuldade, etapas; ficha: categoria, nome, texto) ou `null`.
    - **Ensaio:** no criador a aprovação aparece do mesmo jeito ("Simular"), mas **nada é gravado** (ids fictícios); o encaixe de ação usa um item de exemplo.
  - **Alterar e excluir (E7):** `RPG.alterar(tipo, id, mudancas)`, `RPG.excluir(tipo, id)` ou ações `{ tipo, op: "alterar"|"excluir", id, mudancas? }` em `RPG.propor` (sem `op` = criar), com as permissões `alterar:fichas` / `alterar:missoes` (cobrem alterar **e** excluir; `criar:*` não dá direito a alterar nem o contrário).
    - **Campos (lista fechada, `acoes.ts`):** ficha: `nome`, `texto`, `categoria`, `liberarPara`; missão: `titulo`, `descricao`, `categoria`, `dificuldade`, `status`, `etapas` (lista completa: com `id` = mantida/alterada, sem `id` = nova, ausente = removida; no máximo uma `atual`; notas do mestre preservadas). Campo desconhecido invalida a proposta toda.
    - **Alcance:** só fichas do mestre (`mestre: true`) e missões da mesa; fichas pessoais de jogadores são recusadas. Missões antigas (só a versão pública) também podem ser alteradas.
    - **Aprovação com antes → depois:** `prepararLote` (`escrita.ts`) lê os documentos atuais e `montarLote` (`lote.ts`, puro) monta o resumo ("visível para: só você → Lia", "status em andamento → concluída", exclusões destacadas) e o lote; grava num único `writeBatch` (missões: `missoesMestre` + pública derivada) e resolve com `{ lote, criados, alterados, excluidos, avisos }`.
    - **Desfazer restaura:** o registro do lote guarda `antes` (documento anterior; em alterações de ficha sem a `foto`, para caber no Firestore) e `depois` (hash do que foi gravado). Desfazer apaga criados, restaura alterados e recria excluídos (ilustrações de missões excluídas ficam e voltam com ela); se um item foi mudado de novo depois, avisa quais e pede confirmação. Lotes com registro > ~900 KB são recusados ("divida em partes menores").
    - **Jogador:** vira pedido, como a criação; ao aprovar, o mestre vê o antes → depois calculado **na hora** (`prepararPedido`); se o item não existe mais, o pedido é recusado automaticamente com `motivo` e o jogador é avisado.
  - **Jogador pede, mestre aprova (E4):** quando quem usa a extensão é um **jogador**, a mesma chamada `RPG.criar/propor` **não grava**: envia um **pedido** (`mesas/{id}/extensoesPedidos/{id}`, `status: pendente`) e resolve na hora com `{ pedido, status: "pendente" }`. Em Extensões o mestre vê **"Pedidos dos jogadores"** (com selo na sidebar e aviso ao chegar um novo), revê o resumo e **aprova** (revalida com `validarAcoes`, executa como lote **dele**, desfazível) ou **recusa**; o jogador recebe um aviso do resultado. Limite: 5 pedidos pendentes por jogador. Só vale para ações cujas permissões `criar:*` o mestre aprovou.
  - **Risco assumido:** o que a extensão guarda no estado `compartilhado` (`RPG.salvar`) e o próprio HTML são visíveis a quem a usa; o consentimento avisa quando há dados privados (`sensivel`) e, com escopos privados pedidos, que segredos vão em "Só do mestre", nunca no código.
  - **Modo ensaio (criador):** a prévia roda com as permissões e escopos **simulados** (os pedidos), podendo usar **dados da mesa** ou **de exemplo** (`DADOS_EXEMPLO`), com um registro das chamadas feitas. Leituras, criações, alterações e exclusões são ensaiadas, sem gravar. "Ver como" alterna entre mestre e cada jogador (de exemplo ou da mesa, com contas fictícias); o estado por escopo fica num armazém em memória (`criarArmazemMemoria`), semeado com os dados iniciais, visível e editável em "Estado simulado do ensaio", com "Reiniciar ensaio".
- **Eventos e automação (E4):** o manifesto pode declarar `eventos` (catálogo em `eventos.ts`): `missao.concluida`, `ficha.criada`, `jogador.entrou`, `sessao.registrada`, `dados.rolados` e (E7) `estado.jogadorSalvou` (`{ jogador, atualizadoEm }`, sem o conteúdo; exige o escopo `doJogador` aprovado em vez de `ler:*`; detectado por `atualizadoEm` em `diffEstadoJogadores` e entregue só à extensão cujo dado mudou). A extensão trata com `RPG.aoEvento(nome, fn)`.
  - **Quando roda:** só enquanto o **mestre está com a mesa aberta**: `AutomacoesHost` mantém uma instância **sem tela** (iframe, `RPG.segundoPlano = true`) de cada extensão com eventos e entrega os eventos. **Nada roda com o app fechado** (isso fica para o servidor, E6) e nada roda para jogadores.
  - **Detecção:** por **diferença** entre instantâneos dos dados (`diffMissoes`, `diffFichas`, `diffJogadores`, `diffSessoes`, `diffRolagens`); a primeira leitura é só base (não dispara eventos ao abrir a mesa).
  - **Controles:** o evento só chega se a extensão tem a permissão `ler:*` equivalente aprovada (exceto `dados.rolados`); eventos causados pela **própria extensão** (`origem.extensao`) não voltam a ela; no máximo **10 eventos/min** por extensão. Criar algo dentro de um handler continua pedindo a **aprovação** do mestre.
  - **Ensaio:** no criador, "Simular evento" envia um evento de exemplo à prévia.
- **Efeitos na mesa inteira (E5):** o bloco `mesa` do manifesto (`efeitos.ts`) deixa a extensão mudar a mesa **enquanto estiver ativa**:
  - **Tema** (`tema.escuro` / `tema.claro`): troca tokens de cor (`--accent`, `--gold`, `--background`…) só nesta mesa; cores **somente hexadecimais** e só tokens da lista. Aplicado em `<html>` enquanto o usuário está na mesa (`useTemaDaMesa`) e removido ao sair. Se texto e fundo ficarem com contraste < 4,5:1, **os dois são descartados** e a mesa mostra um aviso de conflito.
  - **Termos:** renomeia ferramentas do menu e títulos (`fichas.npc` → "Contatos"; `Titulo` e o menu leem o termo). Chaves do catálogo `TERMOS` (mapas, imagens, mundo, missões, 4 fichas, jogadores, sessões, segredos, quadro).
  - **Menu (`ocultar`):** esconde ferramentas do menu e da busca (a rota continua existindo). **Início, Extensões, Configurações e Iniciar sessão não podem ser ocultados**, para o mestre nunca se trancar fora.
  - **Tipos de recurso** (`recursos`, até 5 por extensão, até 8 campos `texto`/`longo`/`numero`/`selecao`): o app gera menu, lista, busca e formulário (`TelaRecurso`). Dados em `mesas/{id}/recursosDados/{id}` (`extId`, `recursoId`, `valores`, `liberado`); o mestre gerencia e **libera cada registro** aos jogadores (padrão: só o mestre).
  - **Vários efeitos juntos:** `combinarEfeitos` aplica na **ordem de prioridade** da mesa (a última vence conflitos de tema e de termos; `ocultar` e recursos se somam). A tela Extensões mostra **conflitos**, resume "Muda a mesa: …" por extensão e tem setas de **prioridade** (`ordem`).
  - **Kill switch:** o botão de ligar/desligar (`ativa`) tira a extensão do menu, dos encaixes, dos eventos e **desfaz todos os efeitos**, sem apagar nada.
  - **Quem vê os efeitos:** extensões liberadas aos jogadores afetam também a visão deles; as que só o mestre vê afetam só a dele.
  - **Consentimento:** publicar/instalar lista os efeitos (`resumoEfeitos`) na tela de aprovação.
- **IA dentro da extensão (E6):** `await RPG.perguntar("texto")` → `{ texto }`, com a permissão `usar:ia`. A pergunta vai à rota `POST /api/ia/extensao-llm`, que usa a **chave de IA do mestre dono da mesa** (nunca do jogador) e confere, no servidor: o chamador é membro; a extensão existe, está **ativa** e tem `usar:ia` em `permissoesAprovadas`; para jogador, está `visivelJogadores`. **Limite diário por mesa** (padrão 100 perguntas/dia, configurável em `mesas/{id}/uso/config.tetoIaExtensoes`; 0 desliga), contado de forma atômica antes da chamada e devolvido se o provedor falhar (contador `uso/ia-AAAA-MM-DD`). Pergunta ≤ 2000 e resposta ≤ 4000 caracteres; prompt de sistema fixo que manda ignorar instruções do texto. No ensaio do criador a resposta é fixa e nada é consumido.
- **Exportar / importar (E6):** na biblioteca, "Exportar" baixa um `.rpgext.json` (`pacote.ts`) com **só código e manifesto** (nunca estado de nenhum escopo, dados iniciais, permissões ou escopos aprovados, conversa, visibilidade nem dono; os escopos vão só como *pedidos* no manifesto); "Importar arquivo" valida o formato (limites de tamanho, versão, HTML, manifesto normalizado) e coloca na biblioteca do mestre. **Importar não concede nada**: as permissões do manifesto continuam sendo pedidos aprovados na instalação, e o app avisa o que o arquivo pede antes de importar.
- **Mestre** executa, salva estado, edita e publica; **jogador** usa em somente leitura (e lê dados só dentro do que a conta dele já vê), exceto pelo próprio escopo `doJogador`, quando aprovado.
- **Extensões nativas (`nativas.ts`):** registro `{ id, titulo, mesas[], rota }`. Hoje: `marcas-de-pacto` na mesa `MESA_PADRAO`. Usam os mesmos encaixes (sidebar do mestre e do jogador, seção no diário, cartão em Extensões, Ctrl+K), mas renderizam React em vez de iframe. Fora das mesas autorizadas somem de tudo e a rota mostra "Extensão indisponível".
- **Visíveis aos jogadores por padrão, com opção de ocultar:** o mestre pode ocultar uma nativa dos jogadores (e reexibir) no cartão da extensão em Extensões. A escolha fica em `mesas/{id}/extensoesNativas/{idNativa}` (`{ id, visivelJogadores }`; sem registro = visível, para não mudar mesas já em uso). `nativaVisivel(mesaId, id, papel, config)` decide: o mestre vê sempre, o jogador, a menos que `visivelJogadores === false`. Hooks: `useNativasMesa`, `definirVisibilidadeNativa`. O `ExtensoesContext` carrega `nativas`, `nativasProntas` e `souMestre` para a sidebar, o diário e a tela da extensão.

## Regras e limites
- HTML ≤ 150 KB; estado ≤ 50 KB por documento de escopo; título ≤ 80; mensagens do chat: últimas 14, 4000 caracteres cada.
- Escrita do jogador (`doJogador`): só o próprio documento, ≤ 50.000 caracteres, 10 gravações/min (broker); o jogador não apaga (limpar é do mestre). O mestre nunca grava `de_*`.
- Alterar/excluir: até 20 ações por proposta, um item por vez por proposta, só fichas do mestre e missões; registro do lote ≤ ~900 KB.
- Iframe: `sandbox`, **CSP sem rede** (fetch/XHR/WebSocket e imagens por URL bloqueados), sem `alert/confirm/prompt`, só `postMessage`.
- Mestre gerencia; jogador lê só as `visivelJogadores`.
- O bloqueio das nativas (por mesa e pela ocultação do mestre) vale também **no servidor** para as Marcas de Pacto: as regras do Firestore (`mesaDasMarcas`, `marcasLiberadas`, `marcasMestre`, `marcasJogador`) fecham as coleções delas em qualquer outra mesa e, na mesa autorizada, para jogadores quando o mestre as oculta. Um teste confere que o id da mesa nas regras é o mesmo de `MESA_PADRAO`.

## O que ainda é plano (não implementado)
Alterar/excluir outros tipos (mundo, sessões, mapas, tipos de recurso) e criar artigos do Mundo e notas de sessão, automação com o app fechado (exige executar o código da extensão no servidor: precisa de um sandbox de JS no servidor ou de automações declarativas sem código), compartilhamento em galeria, reordenar grupos do menu, regras de dados (presets de rolagem), leitura dos tipos de recurso por `RPG.ler`, teto agregado de estado por mesa, migrar as Marcas de Pacto nativas para uma extensão comum (as peças do E7 permitem). Propostas em `openspec/changes/` (o antigo `docs/planejamento/plano-plataforma-de-extensoes.md` não está mais no repositório).

## Onde está no código
`src/lib/extensoes/*` (`capacidades.ts`, `acoes.ts`, `lote.ts`, `escrita.ts`, `broker.ts`, `broker-puro.ts`), `components/extensoes/{proponente.ts,HistoricoExtensao.tsx,AutomacoesHost.tsx,PedidosPendentes.tsx}`, `lib/extensoes/{eventos.ts,pedidos.ts,efeitos.ts,recursos.ts,pacote.ts,ia-extensao.ts,estado.ts,estado-firestore.ts}`, `components/extensoes/PainelDadosExtensao.tsx`, `firestore.rules` (bloco `extensoes/{extId}/estado/{docId}`), `app/api/ia/extensao-llm`, `components/telas/TelaRecurso.tsx`, `components/shell/AcoesSlot.tsx`, `src/components/extensoes/*`, `src/components/telas/{ListaExtensoes,ExecutarExtensao}.tsx`, `src/components/shell/{Slot,ExtensoesContext}.tsx`, `src/app/api/ia/extensao`, rotas `extensoes` (criar, `[extId]`, `[extId]/editar`; jogador `extensoes/[extId]`).

## Relações
[marcas-de-pacto](marcas-de-pacto.md), [navegacao-e-busca](navegacao-e-busca.md), [ia-configuracao-e-limites](ia-configuracao-e-limites.md), [fluxo criar-extensao](../fluxos/criar-extensao.md).
