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
| `ctrlk` | Comando na busca Ctrl+K | mestre, jogador |

  Os **inline** (`SLOTS_INLINE`) renderizam o painel dentro de outra tela via `<Slot>`; os demais só levam à tela da extensão. Altura inline: 160–900 px (padrão 360).
- **Execução (`Sandbox` + `documento.ts`):** `montarDocumento` injeta CSP, tema (variáveis `--accent`, `--gold`, `--background`…) e a ponte `window.RPG`:
  - `RPG.salvar(obj)`: guarda JSON (≤ 50 KB), só quando `RPG.somenteLeitura` é falso;
  - `RPG.aoCarregar(fn)`: recebe o último estado salvo;
  - `RPG.somenteLeitura`: `true` para jogador (a extensão deve esconder botões de edição).
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
  - **Risco assumido:** o que a extensão guarda no estado (`RPG.salvar`) é visível a quem a usa; o consentimento avisa quando há dados privados (`sensivel`).
  - **Modo ensaio (criador):** a prévia roda com as permissões **simuladas** (as pedidas), podendo usar **dados da mesa** ou **de exemplo** (`DADOS_EXEMPLO`), com um registro das chamadas feitas. Esta versão **só lê**: não há como criar nem alterar dados (E3).
- **Mestre** executa, salva estado, edita e publica; **jogador** só usa, em somente leitura (e lê dados só dentro do que a conta dele já vê).
- **Extensões nativas (`nativas.ts`):** registro `{ id, titulo, mesas[], rota }`. Hoje: `marcas-de-pacto` na mesa `MESA_PADRAO`. Usam os mesmos encaixes (sidebar do mestre e do jogador, seção no diário, cartão em Extensões, Ctrl+K), mas renderizam React em vez de iframe. Fora das mesas autorizadas somem de tudo e a rota mostra "Extensão indisponível".
- **Visíveis aos jogadores por padrão, com opção de ocultar:** o mestre pode ocultar uma nativa dos jogadores (e reexibir) no cartão da extensão em Extensões. A escolha fica em `mesas/{id}/extensoesNativas/{idNativa}` (`{ id, visivelJogadores }`; sem registro = visível, para não mudar mesas já em uso). `nativaVisivel(mesaId, id, papel, config)` decide: o mestre vê sempre, o jogador, a menos que `visivelJogadores === false`. Hooks: `useNativasMesa`, `definirVisibilidadeNativa`. O `ExtensoesContext` carrega `nativas`, `nativasProntas` e `souMestre` para a sidebar, o diário e a tela da extensão.

## Regras e limites
- HTML ≤ 150 KB; estado ≤ 50 KB; título ≤ 80; mensagens do chat: últimas 14, 4000 caracteres cada.
- Iframe: `sandbox`, **CSP sem rede** (fetch/XHR/WebSocket e imagens por URL bloqueados), sem `alert/confirm/prompt`, só `postMessage`.
- Mestre gerencia; jogador lê só as `visivelJogadores`.
- O bloqueio das nativas (por mesa e pela liberação do mestre) é de **interface**; as regras do Firestore só protegem a própria configuração (`extensoesNativas`), não os dados da extensão.

## O que ainda é plano (não implementado)
Escrita no workspace (`RPG.criar`, com prévia do que será feito e desfazer), contexto por encaixe (missão, ficha), eventos (`missao.concluida`…), temas/terminologia/navegação por extensão, desfazer em lote. Ver `docs/planejamento/plano-plataforma-de-extensoes.md`.

## Onde está no código
`src/lib/extensoes/*` (`capacidades.ts`, `broker.ts`, `broker-puro.ts`), `src/components/extensoes/*`, `src/components/telas/{ListaExtensoes,ExecutarExtensao}.tsx`, `src/components/shell/{Slot,ExtensoesContext}.tsx`, `src/app/api/ia/extensao`, rotas `extensoes` (criar, `[extId]`, `[extId]/editar`; jogador `extensoes/[extId]`).

## Relações
[marcas-de-pacto](marcas-de-pacto.md), [navegacao-e-busca](navegacao-e-busca.md), [ia-configuracao-e-limites](ia-configuracao-e-limites.md), [fluxo criar-extensao](../fluxos/criar-extensao.md).
