## Context

A plataforma de extensões (E0 a E6) executa um HTML gerado por IA num iframe sem rede. O iframe fala com o app só por `postMessage`, por meio da ponte `window.RPG` (`documento.ts`). O broker (`broker.ts`) valida cada pedido, confere `permissoesAprovadas` e lê ou grava com as credenciais de quem usa. As regras do Firestore são a barreira final.

Três limitações impedem mecânicas como as Marcas de Pacto:

- **Estado único e público.** `dadosJson` mora no documento da instalação `mesas/{id}/extensoes/{extId}`, que o jogador lê inteiro quando `visivelJogadores`. O próprio HTML também está nesse documento, então nada que esteja no HTML ou no estado é segredo.
- **Jogador só lê.** `salvar` é ignorado com `somenteLeitura`. Escrever conteúdo passa por `RPG.criar`, que para o jogador vira pedido (E4).
- **Só criação.** `acoes.ts`, `lote.ts` e `escrita.ts` só criam fichas e missões, e `desfazerLote` só apaga.

As Marcas nativas mostram o padrão que precisamos generalizar: um documento por jogador, com regras separadas para "o mestre escreve, o jogador lê o seu" (`assignments`, `released`, `puzzleStatus`), "o jogador escreve o seu" (`notes`, `puzzleResp`) e "só o mestre" (`lore`, `puzzles`).

Esta change não cria rotas de servidor. Ela mexe em componentes cliente (`Sandbox`, `CriadorExtensao`, `ListaExtensoes`, um `PainelDadosExtensao` novo). Antes de codar, leia em `node_modules/next/dist/docs/` o guia de componentes cliente e de `"use client"` desta versão do Next.

## Goals / Non-Goals

**Goals:**
- Quatro escopos de estado, com o acesso imposto pelas **regras do Firestore**, não só pelo broker.
- O jogador grava o próprio estado sem aprovação, dentro de limites que valem no servidor.
- Alterar e excluir fichas e missões com aprovação e desfazer completo.
- Tudo gerenciável em dois lugares:
  - na **tela Extensões**: painel "Dados", escopos aprovados, backup, limpeza;
  - no **criador**: prompt, seção "Onde guarda dados", dados iniciais, ensaio com troca de papel.
- Compatibilidade total: extensões existentes funcionam sem migração.

**Non-Goals:**
- Migrar as Marcas de Pacto nativas para uma extensão. Fica para uma change futura, que vai usar estas peças.
- Automação com o app fechado (execução no servidor).
- Alterar outros tipos (mundo, sessões, mapas, tipos de recurso) ou fichas pessoais de jogadores.
- Leitura dos tipos de recurso por `RPG.ler`.
- Criptografia do estado: a proteção é de acesso (regras), não de conteúdo.
- Cotas por mesa de armazenamento total.

## Decisions

### D1. Subcoleção `estado/` sob a instalação, e `compartilhado` continua em `dadosJson`
Os ids dos documentos são `mestre`, `para_{uid}` e `de_{uid}`. Cada documento tem `{ json: string, uid?: string, atualizadoEm: number }`.
- **Por quê:** as regras do Firestore valem por documento. Só documentos separados permitem que um jogador leia o seu e não o de outro. Com o id derivado do uid, a regra fica `docId == 'para_' + request.auth.uid`, sem consulta. Manter `compartilhado` em `dadosJson` evita migrar extensões já publicadas e mantém `RPG.salvar` idêntico.
- **Alternativas:**
  - Um mapa por jogador dentro de `dadosJson`: as regras não conseguem ocultar campos de um documento lido, então foi descartado.
  - Uma coleção de topo `extensoesEstado`: perde o agrupamento com a instalação e complica a remoção.
  - Mover `compartilhado` para `estado/compartilhado`: exigiria migração e não traz ganho.

### D2. JSON em texto (`json: string`), não um mapa do Firestore
- **Por quê:** é o mesmo formato de `dadosJson`. O tamanho fica verificável na regra (`json.size() <= 50000`), não há limite de profundidade nem de tipos do Firestore, e é fácil exportar e restaurar.
- **Trade-off:** não dá para consultar por campo. Isso é aceitável, porque a extensão lê o documento inteiro.

### D3. Escopos pedidos no manifesto e aprovados na instalação (`estadoAprovado`)
O modelo é o mesmo de `permissoes` e `permissoesAprovadas`: o manifesto **pede**, e o mestre **aprova** no consentimento.
- **Por quê:** as regras precisam de uma fonte confiável que o mestre controla. O manifesto vem da IA, e a instalação é gravada só pelo mestre. `doJogador` em especial abre escrita a jogadores e precisa de consentimento explícito.
- **Implementação:** a catalogação dos escopos (rótulo, texto de consentimento, quem lê e quem grava) fica num `ESCOPOS` em `estado.ts`, a fonte única para broker, consentimento, prompt e criador, como `SLOTS` e `PERMISSOES`.
- **Alternativa:** tratar escopos como permissões (`estado:mestre`, …) em `permissoesAprovadas`. Foi descartada porque mistura ler dados da mesa com guardar dados próprios e confunde o consentimento. As regras também precisariam inspecionar uma lista mais genérica.

### D4. Regras do Firestore
Dentro de `match /extensoes/{extId}`, adicionar `match /estado/{docId}` com uma função `inst()` que faz `get` da instalação.
- **Mestre (`mestreMesa()`):** pode `read`, `list` e `delete` em tudo. Pode `write` em `mestre` e `para_*`, com `json is string && json.size() <= 50000`. Não pode `create` nem `update` em `de_*`, para não forjar respostas do jogador. Pode `delete`, para limpar.
- **Jogador (`membroMesa()`):** as condições valem com `inst().visivelJogadores == true && inst().get('ativa', true) != false`.
  - `get` em `para_{seu uid}` exige `'porJogador' in estadoAprovado`.
  - `get` em `de_{seu uid}`, e `create`/`update` em `de_{seu uid}`, exigem `'doJogador' in estadoAprovado`, chaves `hasOnly(['json','uid','atualizadoEm'])`, `uid == request.auth.uid` e o limite de tamanho.
  - Não pode `list` nem `delete`.
- **Custo:** cada operação de jogador faz duas leituras nas regras (a mesa em `membroMesa` e a instalação). É aceitável no volume de uma mesa.

### D5. Broker: identidade por id de jogador, não por uid
A extensão vê jogadores pelos ids de `RPG.ler("jogadores")`. O broker converte id em uid usando `mesa.jogadores` (`uid` reivindicado) e devolve `listar` com chave pelo id de jogador. `RPG.eu` traz o id de jogador da conta (`null` para o mestre).
- **Por quê:** é coerente com `liberarPara` e com o resto da API, e não expõe uids ao código gerado por IA.
- **Jogador sem conta:** é erro explícito, como os avisos do E3.

### D6. Tempo real com `aoMudar`, via `onSnapshot` no app
O app abre `onSnapshot` nos documentos que a instância pode ler (o seu `para_`/`de_`, ou todos para o mestre) e repassa ao iframe por `postMessage` (`rpg: "estado"`). A assinatura só é aberta quando a extensão chama `aoMudar` e é fechada quando o iframe é desmontado.
- **Por quê:** é o que faz a etapa liberada pelo mestre aparecer na hora para o jogador.
- **Alternativa:** polling com `ler`. Foi descartado por latência e por custo.

### D7. Escrita do jogador: limites no servidor, frequência no broker
O servidor impõe tamanho, chaves e dono. O broker impõe 10 gravações por minuto por extensão.
- **Por quê:** as regras não conseguem limitar frequência sem um contador gravável, que o jogador também poderia manipular. Aceitamos que um cliente adulterado grave mais vezes: ele só sobrescreve o **próprio** documento de 50 KB, sem atingir dados de terceiros.
- **Risco:** custo de escrita. Ele é limitado por ser um documento por jogador e por gravações serem sobrescritas, não acumuladas.

### D8. Evento `estado.jogadorSalvou` sem conteúdo
O `AutomacoesHost` do mestre assina `de_*` e detecta mudanças por `atualizadoEm`, comparando instantâneos como os `diff*` existentes. O evento entrega `{ jogador, atualizadoEm }`, e a extensão chama `listar` ou `ler` se quiser o conteúdo.
- **Por quê:** mantém o evento pequeno e evita repassar a outra extensão um conteúdo não confiável sem ela pedir.
- **Requisito:** exige `doJogador` aprovado, e não `ler:*`.

### D9. Alterações: estender `acoes.ts`, `lote.ts` e `escrita.ts`, guardando `antes` no lote
- **Ações:** ganham `op: "criar" | "alterar" | "excluir"`. Sem `op` vale `criar`, por compatibilidade.
- **Validação:** `validarAcao` valida as mudanças contra uma lista fechada de campos.
- **Montagem e aprovação:** a montagem lê os documentos atuais (fichas, e `missoesMestre` para missões), calcula o "antes → depois" para a tela de aprovação e grava num único `writeBatch`. Para missões, a gravação atualiza `missoesMestre` e regenera `missoes` com `derivarPublica`, como já faz a criação.
- **Desfazer:** o registro do lote guarda `antes` (o documento completo) e `depoisHash` (hash do documento gravado). O desfazer compara o hash do documento atual com `depoisHash` para avisar sobre edição posterior.
- **Por quê:** reaproveita aprovação, pedidos (E4), origem e histórico sem criar um segundo caminho.
- **Alternativa:** versionar fichas e missões numa subcoleção de histórico. Foi descartada por ser invasiva nas features existentes.
- **Tamanho do lote:** 20 itens × no máximo ~6 KB cada fica bem abaixo de 1 MB.

### D10. Alcance: só itens que o mestre já edita
O alcance são fichas com `mestre: true` e missões da mesa. Isso é verificado na montagem (leitura do documento atual), e as regras atuais de fichas e missões continuam valendo, porque o lote grava com as credenciais do mestre.
- **Por quê:** extensões não devem ganhar poder que a interface não dá. Fichas pessoais de jogadores são deles.

### D11. Gerenciamento
- **Tela Extensões:** um `PainelDadosExtensao` novo aparece no cartão da instalação e também na tela da extensão, para o mestre. Ele lista escopos e jogadores, abre um editor de JSON com validação e permite limpar, fazer backup e restaurar.
  - O backup é um `.json` com `{ formato, versao, extId, compartilhado, mestre, porJogador, doJogador }`, com chave pelo id de jogador para sobreviver a reinstalações. Restaurar converte id em uid e grava com as mesmas validações. O `doJogador` **não é restaurado**: as regras não deixam o mestre gravar `de_*` (D4), então ele fica no arquivo só para consulta.
  - Remover a extensão da mesa lista a subcoleção e a apaga em lotes, antes do documento da instalação.
- **Criador:**
  - a seção "Onde guarda dados" altera `manifesto.estado`;
  - "Dados iniciais" grava `estadoInicial` na biblioteca, que é privada do mestre. A semeadura acontece em `publicarNaMesa` só se o documento não existe;
  - o ensaio usa um `EstadoEnsaio` em memória, com um mapa escopo/jogador para JSON;
  - o seletor "Ver como" substitui o `comoJogador` booleano por "mestre | j1 | j2 …".
- **Pacote:** `pacote.ts` continua exportando só código e manifesto. `estado` vai no manifesto como pedido, e `estadoInicial` nunca vai.

### D12. Prompt
`prompt.ts` passa a incluir a descrição gerada de `ESCOPOS` e de `RPG.estado`, e uma regra explícita: **nunca** pôr segredo, gabarito ou conteúdo restrito no HTML, porque ele é visível a qualquer jogador que abra a extensão. Esse conteúdo vai para `mestre` (dados iniciais) ou para `porJogador`. O prompt também ensina `doJogador` para progresso e respostas, e diz que o conteúdo do jogador deve ser validado pelo mestre.

## Risks / Trade-offs

- [A IA põe o gabarito no HTML mesmo assim] → A regra está no prompt. O consentimento lembra que o HTML é visível aos jogadores quando a extensão está liberada. Com o escopo `mestre` pedido, o criador mostra um aviso fixo "segredos vão em Dados iniciais, não no código". Não há detecção automática confiável.
- [Conteúdo do jogador é não confiável] → Ele chega à extensão do mestre como dado. O iframe sem rede não consegue vazar nada. O prompt manda validar e escapar ao exibir. O evento não carrega conteúdo.
- [Custo de leituras nas regras] → Duas leituras por operação de jogador. O volume de uma mesa é baixo. O `onSnapshot` assina só os documentos necessários.
- [Cliente adulterado grava acima de 10 por minuto] → Ele só afeta o próprio documento de 50 KB. Aceito e documentado.
- [Desfazer sobrescreve edição posterior] → Há aviso e confirmação explícita por item.
- [`estadoAprovado` revogado com dados existentes] → Os dados são preservados, só o acesso fecha. O painel mostra os escopos "não aprovados com dados" para limpeza.
- [Remover a extensão deixa documentos órfãos se a remoção falhar no meio] → Apagar `estado/` primeiro e a instalação por último. O painel da extensão reinstalada mostra os dados que sobraram.
- [Custo de IA] → Esta change não adiciona chamada de IA. O prompt do criador fica um pouco maior (mais tokens por mensagem, na chave do mestre). O teto de gasto existente continua valendo.

## Migration Plan

1. Fazer o deploy das regras novas. Elas são aditivas: só um bloco `estado/` e campos novos aceitos em `extensoesPedidos.acoes`. Instalações sem `estadoAprovado` se comportam como hoje.
2. Fazer o deploy do app. Instalações sem `estado` no manifesto ou sem `estadoAprovado` não mudam.
3. **Rollback:** reverter o app. As regras novas podem ficar, porque só liberam documentos que o app antigo não usa. Para fechar tudo, remover o bloco `estado/` das regras, e os dados ficam inacessíveis mas preservados.

## Open Questions

- Para permitir "o jogador apagar os próprios dados", seria preciso habilitar `delete` em `de_{uid}`. Esta change deixa isso só para o mestre.
- Teto agregado por mesa (por exemplo, 5 MB de estado total)? Hoje o teto é por documento e implícito pelo número de jogadores.
