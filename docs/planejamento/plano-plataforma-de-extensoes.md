# Plano: extensões que podem mudar a mesa por inteiro

Status: planejamento (a Fase E0 já está no código). Antes de implementar, ler `node_modules/next/dist/docs/` (Next 16, ver `AGENTS.md`).

## 1. Onde estamos

| Hoje | Limite |
|---|---|
| Extensão = um HTML num iframe isolado (sandbox, sem rede), com `window.RPG.salvar/aoCarregar` para guardar estado. | Só **vive na sua própria tela**. Não enxerga jogadores, missões, fichas. Não aparece em outras telas. |
| Aparece na sidebar do mestre (e do jogador, se liberada). | Um único ponto de encaixe. |
| **Marcas de Pacto** é código React nativo, com dados próprios. | Estava fixa no app; agora é uma **extensão nativa exclusiva** (E0). |

**Meta:** uma extensão ativada numa mesa pode (a) ler os dados da mesa, (b) criar e alterar dados da mesa, (c) aparecer em qualquer tela por **encaixes** declarados, (d) reagir a **eventos** e (e) mudar a **cara e a estrutura** da mesa (tema, nomes, ferramentas visíveis). Sempre sob **permissões** que o mestre aprova.

## 2. E0, já feito: Marcas de Pacto como extensão nativa exclusiva

- `src/lib/extensoes/nativas.ts`: registro de extensões nativas com a lista de mesas autorizadas. Marcas de Pacto → mesa `5010347d-14e3-49e2-adb9-eb3bc0952013` (O Juramento de Cinzas). `MESA_PADRAO` foi atualizado para esse id.
- **Encaixes já usados por ela**, em qualquer mesa autorizada:
  - sidebar do mestre **e do jogador** (item teal com a etiqueta "Extensão"; antes o jogador só a via dentro do diário);
  - seção "Marcas de Pacto" no **Meu diário** do jogador;
  - cartão "Extensão nativa · exclusiva desta mesa" em Extensões;
  - Ctrl+K (entra pelos itens da navegação).
- Em qualquer outra mesa: some da sidebar e do diário, e a rota `/mesas/{id}/marcas` mostra "Extensão indisponível".
- **Não muda:** dados, regras do Firestore, telas e enigmas das Marcas.
- **Limite:** o bloqueio é de interface. As regras do Firestore continuam permitindo que um membro de outra mesa grave em `players/`, `assignments/` etc., se alguém chamar o Firestore à mão. Para blindar, ver E6.

## 3. Modelo: manifesto, encaixes, capacidades

Toda extensão (nativa ou criada com IA) passa a ter um **manifesto** JSON:

```jsonc
{
  "id": "tesouro-por-missao",
  "titulo": "Tesouro por missão",
  "versao": 3,
  "permissoes": ["ler:jogadores", "ler:missoes", "criar:fichas", "liberar:fichas"],
  "encaixes": [
    { "slot": "missao.acoes",   "rotulo": "Gerar tesouro", "painel": "tesouro" },
    { "slot": "sidebar",        "rotulo": "Tesouros",      "painel": "tesouro" },
    { "slot": "ctrlk",          "rotulo": "Gerar tesouro da missão atual", "painel": "tesouro" }
  ],
  "eventos": [{ "evento": "missao.concluida", "painel": "recompensa" }],
  "tema": null
}
```

- **Painéis** = os HTMLs (mesmo sandbox de hoje). Uma extensão pode ter vários.
- **Encaixes (slots)** = pontos das telas do app onde um painel pode aparecer, recebendo **contexto**.
- **Capacidades** = a API que o painel chama, sempre intermediada pelo app.

### 3.1 Encaixes

| Slot | Onde aparece | Contexto recebido |
|---|---|---|
| `sidebar` | item na sidebar (mestre e/ou jogador) | mesa, papel |
| `diario.jogador` | seção no **Meu diário** | mesa, jogador |
| `visao-geral` | cartão na Visão geral da mesa | mesa |
| `sessao.painel` | painel na **Sessão ao vivo** | mesa, iniciativa, rolagens |
| `missao.acoes` / `missao.detalhe` | botão ou seção dentro de uma missão | `missaoId` + dados da missão |
| `ficha.acoes` | botão em uma ficha | `fichaId` |
| `jogadores.acoes` | ação em um jogador | `jogadorId` |
| `mundo.artigo` | bloco em um artigo do Mundo | `artigoId` |
| `ctrlk` | comando na busca Ctrl+K | mesa |
| `dados.pos-rolagem` | pós-processamento de uma rolagem | rolagem |

Cada encaixe é um componente do app (`<Slot nome="missao.acoes" contexto={...} />`) que consulta o registro e renderiza os painéis ativos na mesa, cada um num iframe com o contexto injetado. Extensões **nativas** (Marcas) usam o mesmo registro, mas renderizam um componente React em vez de um iframe.

### 3.2 Capacidades (API do painel)

O painel chama `await RPG.ler("jogadores")` ou `await RPG.criar("ficha", {...})`. O iframe manda `postMessage`; o **app** (broker) confere a permissão e executa com as credenciais do **usuário logado**. Assim as regras do Firestore continuam sendo a barreira final.

| Grupo | Leitura (`ler:*`) | Escrita |
|---|---|---|
| Mesa | nome, sistema, status, cor | `escrever:mesa` (descrição, status) |
| Jogadores | lista, personagens, **quantidade**, quem é quem | `escrever:jogadores` |
| Sessões | lista, resumos públicos | `criar:sessoes`, `escrever:notas-sessao` |
| Missões | lista, etapas, status, recompensas | `criar:missoes`, `escrever:missoes` |
| Fichas | NPCs, inimigos, itens (do mestre) | `criar:fichas`, `liberar:fichas` (a todos ou a um jogador) |
| Mundo | artigos | `criar:artigos` |
| Mapas | metadados (nomes, liberação) | `liberar:mapas` |
| Dados | `RPG.rolar("2d6+3")` (usa o motor do app e registra o histórico) | — |
| Avisos | — | `avisar:jogadores` (alimenta o sino do jogador) |
| Estado próprio | `RPG.dados` | `RPG.salvar` (já existe), em espaço privado da extensão |

Regras do broker:
- Valida cada chamada contra um **esquema** (tipos e limites); nunca repassa objetos livres ao Firestore.
- O jogador executa **só** o que o papel dele pode (leitura do que foi liberado). Escrita sobre o mundo é do mestre; a extensão no jogador pode pedir ações que o mestre aprova (E4).
- Cada extensão grava num espaço próprio: `mesas/{id}/extensoesDados/{extId}/...`, e cria conteúdo com `origem: {extensao: id}` para ser possível **listar e desfazer** tudo que ela criou.
- Limites por chamada e por minuto, e log de auditoria (`extensoesLog`).

### 3.3 Exemplo do pedido: tesouro por missão

1. O mestre abre uma missão e clica **"Gerar tesouro"** (encaixe `missao.acoes`, contexto `missaoId`).
2. O painel faz `RPG.ler("jogadores")` → *n* personagens; `RPG.ler("missao", ctx.missaoId)` → nível/dificuldade; calcula valor total proporcional ao grupo.
3. Gera moedas, joias e itens e mostra uma **prévia editável**.
4. Ao confirmar: `RPG.criar("ficha", {categoria: "item", nome: "Colar de safiras", texto: "...", liberadoPara: [...]})`. As joias viram **fichas de item**, aparecendo em Fichas > Itens.
5. Opcional: `RPG.avisar("Vocês encontraram um tesouro!")`.
6. O app mostra antes um resumo ("vai criar 3 itens e liberar para 4 jogadores"), e depois da execução oferece **Desfazer**.

## 4. Mudar a mesa por inteiro

Além de encaixes, a extensão pode declarar mudanças **estruturais**, ativas só enquanto ela estiver ligada na mesa:

| Camada | O que a extensão pode fazer |
|---|---|
| **Tema** | trocar tokens (`--accent`, `--gold`, `--background`, fontes), como o skin sombrio das Marcas, só nessa mesa. |
| **Terminologia** | renomear termos ("Fichas" → "Dossiês", "Missões" → "Contratos"). |
| **Navegação** | ocultar ferramentas nativas, renomear, reordenar e criar grupos de sidebar. |
| **Tipos de recurso** | declarar uma coleção própria (ex.: "Facções", com campos) que ganha lista, formulário e busca Ctrl+K automáticos, e um painel opcional para a visão personalizada. |
| **Regras de dados** | presets de rolagem, modificadores, tabelas aleatórias. |
| **Automação** | reagir a eventos (`sessao.iniciada`, `missao.concluida`, `ficha.criada`, `dados.rolados`, `jogador.entrou`). |

Exemplo, mesa de horror: tema escuro avermelhado, "PV" vira "Sanidade", Quadro oculto, recurso "Pistas", evento `dados.rolados` que dispara um teste de sanidade.

**Conflitos:** duas extensões mexendo no mesmo token ou item de menu seguem a **ordem de ativação** da mesa (o mestre reordena), e a tela de Extensões mostra os conflitos.

## 5. Mudanças no criador de extensões

1. **Prompt gerado do registro:** a referência da API (capacidades e encaixes) sai do mesmo registro que o broker usa, para a IA nunca inventar chamadas inexistentes.
2. **Pergunta "onde isso aparece?"**: a IA propõe encaixes e permissões; o mestre vê um painel **Manifesto** (encaixes + permissões em linguagem simples) e edita antes de publicar.
3. **Modo ensaio:** a prévia roda contra a **mesa real em leitura** (ou dados de exemplo) e as escritas viram uma **lista do que seria feito**, sem gravar. Só publicar libera escrever.
4. **Contexto simulado:** escolher "Missão: A Cripta" para testar o encaixe `missao.acoes` na prévia.
5. **Tela de consentimento** ao instalar: "Esta extensão quer ler jogadores e criar fichas".
6. **Versões** salvas e **reverter**; diferença de permissões entre versões exige nova aprovação.
7. **Escopo:** instalar em uma mesa, em várias, ou deixar **exclusiva** (lista de mesas, como as nativas).

## 6. Segurança

- Iframe `sandbox="allow-scripts"` sem same-origin e CSP sem rede (já existe) **continuam**. A extensão nunca recebe credenciais, só pode pedir coisas ao broker.
- Nenhuma capacidade fora do manifesto aprovado; mudar permissões = nova aprovação.
- Jogador nunca recebe dados de mestre/segredos pelo broker, mesmo que a extensão peça (o broker filtra por papel).
- Chamadas à IA feitas **pela** extensão (futuro) passam pelo servidor, com a chave e o teto de gasto do mestre.
- Kill switch: desativar a extensão remove encaixes, tema e eventos na hora.
- Revisão do código gerado: mostrar o resumo de permissões acima do código; alertar quando a extensão pede escrita.

## 7. Fases

| Fase | Entrega | Depende de |
|---|---|---|
| **E0** (feita) | Registro de nativas; Marcas exclusiva do Juramento; encaixes sidebar/diário. | — |
| **E1** | Manifesto no modelo de dados; componente `<Slot>`; encaixes `sidebar`, `diario.jogador`, `visao-geral`, `sessao.painel`, `ctrlk` para extensões com IA. | E0 |
| **E2** (feita: só leitura; ensaio sem escrita) | Broker com **leitura** (jogadores, missões, sessões, fichas, mundo) + permissões + tela de consentimento + prompt gerado do registro + modo ensaio. | E1 |
| **E3** | Broker com **escrita** (criar ficha/item, missão, nota, artigo, liberar, avisar) com prévia, `origem` e **Desfazer**; encaixes de contexto (`missao.*`, `ficha.acoes`). Caso de uso: tesouro por missão. | E2 |
| **E4** | **Eventos** e automações (cliente, enquanto o mestre está com a mesa aberta); pedidos de ação do jogador aprovados pelo mestre. | E3 |
| **E5** | **Mesa por inteiro:** tema por mesa, terminologia, navegação, tipos de recurso, conflitos e ordem. | E1 (tema e nav podem sair antes) |
| **E6** | Servidor: regras do Firestore com **habilitação por mesa** (campo `extensoesAtivas` + regras `players/`, `assignments/` etc. exigindo a extensão), automações agendadas (Cloud Functions), IA dentro da extensão com teto de gasto, **exportar/importar** extensões (manifesto + painéis). | E3 |

Sugestão de ordem: **E1 → E2 → E3** primeiro (entrega o caso do tesouro), depois **E5** (muda a cara da mesa) e **E4**. E6 pode ser puxada para antes se as extensões forem compartilhadas com outros mestres.

## 8. Decisões abertas

1. **Quem pode instalar:** só o dono da mesa (recomendado) ou também co-mestres?
2. **Extensões do jogador:** o jogador pode ter extensões **pessoais** (ex.: ficha própria) sem passar pelo mestre? (Recomendação: não na v1.)
3. **Escrita pelo jogador:** pedidos aprovados pelo mestre (recomendado) ou escrita direta em áreas próprias (diário, pinos)?
4. **Automação sem a aba aberta** exige Cloud Functions (E6). Aceitável adiar?
5. **Compartilhar entre mestres** (importar e exportar, galeria): entra antes ou depois de E5?
6. **Dados da extensão ao excluir:** apagar, ou manter por um período (undo)?
