# Planejamento: Tracking de combate (extensão nativa de D&D 5e)

> **Status: plano detalhado (fases 0 a 9 = V1; ideias adiadas em [`FUTURE_CHANGES.md`](FUTURE_CHANGES.md)). Nada disto existe ainda.** Este documento é o guarda-chuva do combate; [`magias-no-combate.md`](magias-no-combate.md) detalha a parte das magias (dividir cura/dano, alvos por área, salvaguarda por alvo) e entra aqui como a **Fase 5**. Pré-requisito de conteúdo: ficha e catálogos de D&D 5e "redondos" ([`ficha-dnd5e-automatizada.md`](ficha-dnd5e-automatizada.md), [`pendencias-ficha-dnd5e.md`](pendencias-ficha-dnd5e.md)) e um **bestiário** (Livro dos Monstros), previsto na Fase 2.

## 1. Visão

Uma **extensão nativa pública** que transforma o combate de D&D 5e em uma experiência única para a mesa:

- **Jogadores:** veem o mapa em grade com os tokens, sabem de quem é a vez, quanto podem andar, que ações ainda têm, escolhem alvos e áreas por clique e **veem o efeito** das magias acontecendo.
- **Mestre:** tem um painel de controle completo (iniciativa, PV, condições, fichas dos monstros, ações lendárias, XP, loot) e **ferramentas abertas** para improvisar, em vez de regras rígidas que o limitem.

Princípios:

1. **Ajudar, nunca travar.** Todo cálculo automático é uma *sugestão confirmável* e tudo é **sobrescrevível** pelo mestre (padrão já usado na ficha: "override sempre possível"). Regra da casa e improviso vêm primeiro.
2. **O combate usa o que o site já tem**, não duplica: ficha calculada (`derivar`), `combate.ts` (condições, dano com resistência, morte), catálogo de magias com `mecanica`, cenas em grade, rolador 3D, pedidos de teste, fichas de NPC/inimigo.
3. **Opt-in.** Só existe em mesa de D&D 5e e só depois que o **mestre ativa**.
4. **Aberta.** O combate emite eventos que extensões (criadas com IA) podem escutar, para o mestre criar coisas que nós não previmos.

## 2. Onde estamos (já existe, reaproveitar)

| Peça | Onde | Uso no combate |
|---|---|---|
| Condições, exaustão, dano com resistência/vulnerabilidade/imunidade, morte e estabilização | `src/lib/regras/dnd5e/combate.ts` | Motor de aplicação de dano/condição; só falta ligar a alvos reais |
| Ficha derivada (CA, PV, ataques, CD, recursos, concentração) | `derivar.ts`, `efetiva.ts`, `FichaDnd5e.tsx` | Estatísticas do token do jogador, sempre ao vivo |
| Catálogo de magias com `mecanica` (dano, cura, salvaguarda, `area`, escala) e plano de conjuração | `magias.ts`, `conjuracao.ts` | Fluxo de conjurar com alvos |
| Grupo (PV/CA/condições ao vivo, dano/cura por campo pelo mestre) | Fase 8 da ficha, `grupo.ts` | Mestre já grava PV na ficha de qualquer jogador |
| Iniciativa (ordem, turno, rodada, PV, condições), pedir iniciativa/teste | `components/sessao/*`, `pedidosTeste.ts` | Lógica de pedido/rolagem **reaproveitada** no combate; a iniciativa da Sessão ao vivo **continua existindo** (hoje só `localStorage`, só mestre) |
| Cenas em grade (quadrada/hex), paredes, render PNG | `lib/cena/*`, [editor-de-cena](../base-conhecimento/features/editor-de-cena.md) | Mapa onde os tokens ficam |
| Rolador 3D compartilhado | [dados-3d](../base-conhecimento/features/dados-3d.md) | Todas as rolagens do combate |
| Extensões nativas, encaixes, broker de eventos/capacidades | `lib/extensoes/*`, [extensoes](../base-conhecimento/features/extensoes.md) | Hospedagem e abertura do combate |
| NPCs/inimigos | [fichas](../base-conhecimento/features/fichas.md) | Origem de combatentes do mestre |

**Lacunas:** não há estado de combate compartilhado em tempo real; não há tokens; não há bestiário estruturado; extensões nativas hoje são **por mesa fixa** (`MESA_PADRAO`), não por sistema/opt-in; jogador não consegue alterar o PV de outro; não há XP/loot de encontro.

## 3. A extensão como produto

### 3.1. Ativação (opt-in, ligada ao sistema)

- Nova entrada em `NATIVAS` (`id: "tracking-de-combate"`) com **`sistemas: ["dnd5e"]`** em vez de `mesas: [...]`. O tipo `ExtensaoNativa` ganha o critério de elegibilidade `elegivel(mesa)` (hoje só lista de mesas). `nativasDaMesa` passa a considerar mesa **e** estado de ativação.
- **Criação da mesa:** quando o sistema escolhido no wizard (`NovaMesaWizard`) for D&D 5e (`ehDnd5e`), aparece um passo/caixa **"Tracking de combate (opcional)"** com explicação curta e um interruptor. Desligado por padrão. Trocar o sistema para outro esconde e zera a escolha.
- **Depois da criação:** o mestre liga/desliga em **Extensões** (cartão da nativa) e em **Configurações da mesa**, ao lado das regras opcionais (`opcoesRegras`). Desligar **preserva** os dados do combate (como Marcas de Pacto preserva dados quando oculta); religar retoma.
- **Visibilidade para jogadores:** reaproveitar `visivelJogadores` já existente (oculta a visão do jogador, o mestre continua usando).
- **Modelo:** `Mesa.extensoesNativas?: { [id]: { ativa: boolean; visivelJogadores?: boolean } }` (substitui a leitura do doc `extensoesNativas/{id}` para as nativas opt-in, de forma que o wizard e as **regras do Firestore** leiam a ativação do próprio documento da mesa). **Decidido** (§10): campo na mesa; `marcas-de-pacto` mantém o formato atual e os dois convivem.
- **Iniciativa na Sessão ao vivo (decidido):** a iniciativa da Sessão ao vivo **permanece**, para organizar rodadas **fora de combate** (exploração, social, cenas cronometradas), e **não** é substituída nem sincronizada com o combate. Com a extensão ligada, a tela mostra um **texto fixo** explicando: "Esta iniciativa serve para organizar rodadas fora de combate. Para combater, use o Tracking de combate." com atalho para ele. **A iniciativa de combate é rolada na tela do Tracking de combate** (rolagem automática, pedido aos jogadores ou manual), com dados e ordem próprios.

### 3.2. Telas e encaixes

- **Mestre:** `/mesas/{id}/combate` (mesa de controle) e atalho "Iniciar combate" na Sessão ao vivo (encaixe `sessao.painel`).
- **Jogador:** `/mesas/{id}/jogador/combate` e um **banner/atalho global** quando há combate em andamento (padrão do `PedidoTesteJogador`, montado no `ShellBase`), para o jogador ser levado ao mapa sem procurar.
- Ctrl+K e sidebar com etiqueta "Extensão", como as demais nativas.

## 4. Modelo de dados (proposta)

Tudo em `mesas/{mesaId}/…`, só existe/é acessível se a extensão estiver ativa (regras do Firestore, como `marcasLiberadas`).

| Coleção | Conteúdo | Quem escreve |
|---|---|---|
| `combates/{id}` | `status` (`preparando`/`ativo`/`encerrado`), `rodada`, `turnoId`, `mapa` (`{ origem: cena|imagem, … }`), `grid` próprio (tipo, `tamanhoCelulaPx`, `origemPx`, colunas, linhas, `metrosPorCelula`), `regras` (opções do mestre), `criadoEm` | mestre |
| `combates/{id}/combatentes/{cid}` | `tipo` (`jogador`/`monstro`/`npc`/`aliado`/`objeto`), `ref` (uid+personagemId, `monstroId` do catálogo ou ficha de NPC), `nome`, `iniciativa`, `pos` {col,row}, `tamanho` (categoria), `pvAtual`/`pvMax`/`pvTemp` (só monstros; jogador lê da ficha), `condicoes[]` com duração, `visivelAosJogadores`, `economia` (ação, bônus, reação, movimento usado), `notasMestre` | mestre; o jogador altera só a **posição** do próprio token e a própria economia |
| `combates/{id}/zonas/{zid}` | efeitos persistentes (forma, origem, dono, magia, duração, concentração, dano/condição ao entrar/começar turno) | mestre / aprovado do jogador |
| `combates/{id}/eventos/{eid}` | **log** imutável (quem fez o quê, rolagens, dano aplicado, desfazer) | quem executa |
| `combates/{id}/propostas/{pid}` | ações do jogador à espera do mestre (conjurar com alvos, atacar, dividir cura) | jogador cria, mestre resolve |
| `encontros/{id}` | encontros **preparados** (lista de monstros, posições iniciais, loot, XP) para reuso | mestre |

Regras de ouro do modelo:
- **A ficha é a fonte da verdade do jogador** (PV, CA, condições, concentração, espaços). O combatente de jogador guarda só a referência e a posição; o painel lê a ficha ao vivo (já é assim na iniciativa).
- **Monstros guardam o estado no combatente** (PV, condições), derivados de um `monstroId` do catálogo + overrides.
- **Posição em células inteiras** (`col,row`), não em fração: simples, exata e independente de resolução. O render da cena continua em fração; a conversão usa o `grid` da cena.
- Documentos pequenos (limite do Firestore): log e propostas em subcoleções, posições atualizadas por campo.
- Escritas frequentes (arrastar token) em **debounce/commit ao soltar**, com posição provisória só local.

## 5. Conteúdo: bestiário e tabelas de regras

Sem isto o mestre não tem "informações das fichas dos monstros". Segue o princípio da ficha: **catálogo estático versionado no repositório**, o combate só guarda ids e overrides.

- `src/data/dnd5e/mm/monstros.ts` (+ gerador em `scripts/dnd5e/`, como o catálogo atual): `id`, nome, tipo/subtipo, tamanho, tendência, CA (com fonte), PV (dado + média), deslocamentos, atributos, salvaguardas, perícias, resistências/vulnerabilidades/imunidades (dano e condição), sentidos, idiomas, **ND e XP**, características, ações, reações, **ações lendárias** e **ações de covil**, e `mecanica` estruturada por ataque (bônus, dano e tipo, alcance, CD) no mesmo formato que a ficha já rola.
- **Tabelas do Livro do Mestre:** XP por ND, orçamento de encontro por nível/dificuldade, multiplicador por número de monstros, tesouro individual e tesouro acumulado por faixa de ND, itens mágicos por raridade, condições de cobertura, terreno difícil, escuridão/visão.
- **Monstro personalizado (homebrew):** o mestre cria/duplica a partir de um existente; fica na mesa (`monstros/{id}`), mesmo formato.
- **Ligação com fichas de NPC/inimigo** do site: arrastar uma ficha para o combate gera combatente com os dados dela.
- **Direitos de conteúdo:** decidido que a licença **não é um problema** neste momento; o catálogo do Livro dos Monstros e do DMG entra no repositório como o do Livro do Jogador. Rever se o projeto mudar de natureza (ex.: distribuição comercial).

## 6. Mapa, grade e tokens

- O combate aceita **duas fontes de mapa**: (a) uma **cena em grade** do site (`Cena.modo === "grid"`, quadrada ou hex), que já traz a grade; (b) uma **imagem** qualquer com **grade calibrada** pelo mestre (clicar as pontas de N células, ajustar deslocamento, quadrado/hex, pré-visualização). O combate guarda a **própria grade**, então mudar a cena depois não desalinha os tokens. Sem mapa, existe o modo **teatro da mente** (só ordem de iniciativa, sem tokens), que já resolve mesas sem mapa.
- **Camada de combate** (PixiJS) desenhada **por cima** do render da cena, sem modificar a cena: grade, tokens, zonas, alcance de movimento, réguas, templates de magia, névoa/visão, efeitos visuais. Assim o mapa original nunca é alterado por acidente e o combate pode ser desligado sem rastro.
- **Tokens:** retrato (imagem da ficha/monstro), anel de cor por facção, barra de PV (para jogadores só em faixas, p.ex. "ferido/grave", conforme config do mestre), ícones de condição, indicador de turno, nome opcional. **Tamanho por categoria** (Miúdo a Colossal → 1 célula, 2x2, 3x3…), centro em célula.
- **Movimento:** arrastar com custo (1,5 m/5 pés por célula, diagonais configuráveis: regra do livro, "5-10-5" ou euclidiana), **alcance restante** destacado, terreno difícil, **ataque de oportunidade** sugerido ao sair de alcance, aliados atravessáveis, posição "caído". O mestre pode mover qualquer coisa e ignorar custo.
- **Medição:** régua, alcance de arma/magia, distância automática entre tokens.
- **Visão, luz e névoa de guerra:** ficam para a **V2** da extensão (ver `FUTURE_CHANGES.md`). As `paredes` da cena seguem disponíveis para esse trabalho futuro.
- **Interoperabilidade:** exportação VTT continua igual; opcional exportar o estado do combate (posições) junto.

## 7. Fluxos principais

### 7.1. Mestre: montar e rodar o encontro
1. **Preparar** (fora da sessão): escolhe cena, adiciona monstros do bestiário (com quantidade), posiciona no mapa, define loot/XP; o **construtor de encontros** mostra dificuldade (fácil→mortal) contra o grupo real da mesa; salva em `encontros`.
2. **Iniciar:** "Puxar jogadores" (ficha ao vivo), **rolagem de iniciativa feita nesta tela** (de todos, pedido aos jogadores ou manual), surpresa por combatente, ordem com **desempate** configurável. Não importa a iniciativa da Sessão ao vivo.
3. **Rodar o turno:** passar turno (rodada++ no fim), contador de rodada, efeitos que **começam/terminam** no turno (condições com duração, zonas, concentração), economia de ação do combatente atual, **reação** e **ação lendária** marcadas, recarga de ataques (Recarga 5-6) com rolagem automática.
4. **Painel do monstro:** ficha completa do monstro do turno (ataques clicáveis: rola ataque e dano no 3D, compara com a CA do alvo, sugere o resultado), com ajuste manual de tudo.
5. **Dano e cura:** clicar no token, digitar/rolar, aplicar com resistência/vulnerabilidade/imunidade (`combate.ts`); dano em massa (várias criaturas), dano dividido; PV 0 → morte/estabilização para jogadores, **remoção** para monstros (ou "derrubado", configurável); morte instantânea por dano ≥ PV máx. + PV atual.
6. **Concentração:** dano sofrido gera **teste de Constituição** (CD = max(10, dano/2)) e, se falhar, encerra magia e zonas ligadas.
7. **Improviso:** criar combatente na hora, token avulso (obstáculo, armadilha, "relógio"), desfazer qualquer ação pelo **log**, editar iniciativa, atrasar/preparar ação, **pausar** e retomar.
8. **Encerrar:** tela de **recompensas** (XP por ND com divisão pelo grupo e aplicação à ficha; o aviso de subida de nível já existe), **loot** (tabela do DMG por ND ou lista manual, itens do catálogo de equipamento, entrega para a ficha/inventário ou para um "baú" do grupo), resumo salvo como nota de sessão.

### 7.2. Jogador: o turno
1. Vê o combate começar (banner), a ordem e quem está na vez; o mapa dá **foco** no token da vez.
2. No seu turno: **barra de economia** (ação, ação bônus, reação, movimento restante), arrasta o token (mostra alcance), e escolhe o que fazer **a partir da própria ficha**: ataques, magias, ações padrão (Esquivar, Correr, Desengajar, Ajudar, Esconder, Preparar), ações de classe.
3. **Ataque:** escolhe o alvo no mapa (alcance e cobertura sugeridos), rola no 3D, o site mostra "acertou/errou" contra a CA (a CA do monstro pode ficar oculta se o mestre quiser), dano pendente de confirmação do mestre.
4. **Fora do turno:** reações (ataque de oportunidade, *Escudo Arcano*, *Contrafeitiço*) como **prompt** quando o mestre abre a janela; salvaguardas pedidas pelo mestre aparecem como o cartão de teste atual.
5. **Morte:** o jogador a 0 PV rola salvaguarda de morte no próprio turno (ficha já tem).

### 7.3. Magias no combate (Fase 5)
Integra [`magias-no-combate.md`](magias-no-combate.md): o plano de conjuração da ficha entra no fluxo de alvos:
1. Escolhe magia e círculo → o site mostra o **template** (esfera, cone, linha, cubo, cilindro) seguindo o cursor, com **alcance** da magia e **origem** correta (cone parte do conjurador, esfera de um ponto à vista…). Ex.: *Bola de Fogo* mostra o raio de 6 m (20 pés) e destaca os tokens dentro.
2. Alvos pré-selecionados por geometria (regra de "tocado pela área" configurável: centro do token, qualquer parte, ou manual), jogador/mestre ajusta.
3. **Salvaguarda por alvo:** o site pede/rola a salvaguarda de cada alvo (monstros automático com o bônus do bestiário; jogadores via pedido de teste) contra a CD, resolve **dano cheio/metade/nada** e condições.
4. **Aplicar (automático com dupla verificação):** no turno do jogador, os efeitos da magia são **calculados e aplicados automaticamente**, mas só depois da **dupla verificação** (ver §8.1). Em **outro jogador**, o efeito vira solicitação e só se aplica quando o mestre aprova. O mestre tem **undo** de qualquer aplicação. Cura e dano **divisíveis** entre alvos por clique.
5. **Efeito visual:** o evento `magia.conjurada` dispara a animação para todos (ver §7.4 abaixo).
6. **Efeito persistente:** vira **zona** (Névoa, Muralha de Fogo, Teia, Silêncio, Espíritos Guardiões) com dono, duração em rodadas e vínculo à **concentração**; efeitos de "ao entrar / ao começar o turno na zona" avisam o mestre ou aplicam.

#### 7.4. Efeitos visuais
- Biblioteca de **efeitos** parametrizados por **escola/tipo de dano** (fogo, gelo, raio, necrótico, radiante, ácido, psíquico, força, cura, escuridão) + forma (projétil, explosão, cone, linha, cura em anel), sempre **procedurais** (partículas/shaders PixiJS) para não depender de assets pesados; o mestre pode **anexar sprite/GIF próprio** a uma magia (criatividade sem restrição).
- Sincronizado: o efeito é um **evento** no log; cada cliente toca localmente a partir dele (barato, sem enviar mídia). Respeitar `prefers-reduced-motion` e uma chave "efeitos reduzidos".
- Rolagens, impacto no token (tremor, número flutuante de dano/cura), som (padrão do `som-dados`), e **câmera** que acompanha o turno.

## 8. Permissões e segurança

Hoje o jogador só escreve na **própria** ficha e o mestre é quem lê/escreve o resto. O combate exige "jogador age sobre o mundo" sem abrir as regras. Estratégia em camadas:

1. **Mestre autoritativo (decidido):** o jogador cria **solicitações** (`propostas/{pid}`: "curar Aria em 15 PV", "conjurar Bola de Fogo em A, B, C, rolagens X"). **Nada que altere outra ficha é aplicado sem o mestre aprovar**; ao aprovar, o cliente do mestre aplica e grava o resultado, e a solicitação sai da fila. Sem modo de auto-aprovação para o que afeta **outros jogadores**. Funciona só com o mestre online, o que já é verdade em mesa ao vivo.
2. **Escritas diretas só no que é do jogador:** posição do **próprio** token, a **própria** economia de ação e a **própria** ficha (como hoje).
3. **Sem caminho de servidor que dispense o mestre:** como a aprovação é obrigatória, a rota `/api/combate/aplicar` ficou fora do plano (ver `FUTURE_CHANGES.md` se um dia for útil para casos fora da sessão).
4. **Visibilidade:** o que o jogador **não** deve ver (PV exato, CA, notas e fichas de monstros, combatentes ocultos, loot) fica em campos/coleções que as regras negam ao jogador; a "versão do jogador" do combatente (nome, retrato, faixa de saúde) é um documento/projeção separada, no padrão `lore`/`released` das Marcas.
5. **Dados:** como hoje, resultado de rolagem **não** é validado no servidor (mesma confiança dos dados 3D); documentar.
6. **Regras do Firestore:** blocos `combates/*` só liberados com `extensoesNativas.tracking-de-combate.ativa == true` no documento da mesa e sistema D&D 5e; testes de regra (há infraestrutura de teste de `firestore.rules`).
7. **Desfazer:** todo efeito no log é reversível pelo mestre; nada some sem registro.

### 8.1. Dupla verificação e undo (efeitos automáticos)

Vale para **magias e efeitos aplicados no turno do jogador** (e, igualmente, para ataques com dano):
1. **Prévia e conferência** pelo jogador (nada é gravado antes).
2. **Revalidação do sistema** no momento de gravar (estado atual × estado da prévia; regras de turno, recursos e alcance). Divergiu: cancela e refaz a prévia.
3. **Aplicação em lote atômica** (tudo ou nada) e **evento no log** com o estado anterior de cada alvo.
4. **Undo do mestre** a qualquer momento (e do jogador logo após aplicar, se o mestre permitir), com histórico do que foi desfeito.
5. Efeito em **outro jogador**: após os passos 1 e 2, entra na fila do mestre como solicitação; só aplica ao aprovar.

## 9. Extensibilidade (a "porta para a criatividade")

- **Eventos de combate no broker** (`lib/extensoes/eventos.ts`): `combate.iniciado`, `turno.iniciado/terminado`, `rodada.avancada`, `dano.aplicado`, `cura.aplicada`, `condicao.aplicada`, `magia.conjurada`, `token.movido`, `combatente.derrotado`, `combate.encerrado`. Extensões criadas com IA escutam e reagem (ex.: "toda vez que um goblin cai, toca uma narração", "armadilha que dispara ao pisar na célula").
- **Capacidades do combate** expostas ao broker com permissão explícita (ler combatentes, mover token, aplicar condição, criar zona, rolar), seguindo o padrão `capacidades.ts` (o mestre aprova o que a extensão pode).
- **Dados abertos:** monstros e efeitos homebrew; **macros do mestre** (sequência de ações salva: "explosão do dragão", "terremoto") e **modelos de encontro**.
- **Regras da casa** como chaves do combate (`regras`): diagonais, desempate, morte de monstro, iniciativa fixa/por grupo, críticos máximos, sucesso automático em 20/falha em 1 em salvaguardas, cobertura, fadiga.
- **Encaixes de UI:** `combate.painel` (mestre) e `combate.jogador` (jogador) para extensões acrescentarem painéis.

## 10. Decisões

Todas as questões levantadas estão resolvidas. O que ficou para depois está em [`FUTURE_CHANGES.md`](FUTURE_CHANGES.md).

- **Licença do conteúdo:** não é problema; bestiário e tabelas do DMG entram no repositório.
- **Ativação:** campo na própria mesa (`Mesa.extensoesNativas`); `marcas-de-pacto` segue no formato atual e os dois convivem.
- **Mapa:** o combate aceita **cena em grade do site** e **imagem com grade calibrada** (Fase 3).
- **Iniciativa:** rolada **na tela do Tracking de combate**. A da Sessão ao vivo permanece para organizar rodadas **fora de combate**, com um **texto** dizendo isso; as duas não se sincronizam.
- **Tempo real:** não é um problema; `onSnapshot` por subcoleção do combate ativo, posição gravada ao soltar o token.
- **Efeitos em outro jogador:** o jogador faz uma **solicitação** e só é aplicada quando o **mestre aprova** (sem auto-aprovação para o que afeta outro jogador).
- **Automação de magias:** no turno do jogador, os efeitos são aplicados **automaticamente**, sempre com **dupla verificação** (conferência do jogador + revalidação do sistema, §8.1) e **undo do mestre** para voltar qualquer ação. Efeitos em outro jogador continuam passando pela aprovação do mestre; casos especiais (Sono, Leque Cromático, Corrente de Relâmpagos, convocações) ficam em painel manual guiado.
- **Celular no mapa:** tratar no futuro.
- **Visão, luz, névoa de guerra e cobertura automática:** ficam para a **V2** da extensão.

## 11. Fases (detalhadas)

Cada fase entrega algo **utilizável sozinho**, termina com testes passando e **atualiza a base de conhecimento** (regra do projeto). Esforço relativo: P (dias), M (1 a 2 semanas), G (2+ semanas). Convenções: lógica pura em `src/lib/regras/dnd5e/` com `*.test.ts`; Firestore em `src/lib/combate/*`; UI em `src/components/combate/*`; telas em `src/components/telas/`.

**Mínimo que já agrega valor:** Fases 0 a 2 (combate compartilhado + bestiário). **O "uau" para a mesa:** Fases 3 a 6.

Dependências: `0 → 1 → 2`; `1 → 3 → 4 → 5 → 6`; `2 → 7`; `4 → 7`; `1 → 8`; `3 → 9`. **V2** (fora deste plano): visão, luz, névoa de guerra, cobertura automática. As Fases 2 e 3 podem andar em paralelo depois da 1.

---

### Fase 0. Fundações (M)

**Objetivo:** a extensão existe, é opt-in, só aparece em D&D 5e e está protegida no servidor, mesmo sem nenhuma função de combate ainda.

**Tarefas**
1. **Registro de nativas por sistema:** em `src/lib/extensoes/nativas.ts`, `ExtensaoNativa` passa a aceitar `mesas?` **ou** `sistemas?` (+ `optIn: boolean`). Nova entrada `tracking-de-combate` (`sistemas: ["dnd5e"]`, `optIn: true`, rota `combate`). `marcas-de-pacto` segue como está (os dois formatos convivem; migração opcional depois). Novas funções `nativaElegivel(mesa, id)` (sistema confere via `ehDnd5e`) e `nativaLigada(mesa, id)`; `nativasDaMesa`/`nativaVisivel` passam a receber a mesa e a ler a ativação dela.
2. **Modelo na mesa:** `Mesa.extensoesNativas?: Record<string, { ativa: boolean; visivelJogadores?: boolean }>` em `src/lib/mesas.ts`; `criarMesa` aceita o valor inicial; função `definirNativa(mesaId, id, {ativa, visivelJogadores})` (só o dono).
3. **Wizard de criação:** em `NovaMesaWizard`, quando `ehDnd5e(sistema)`, bloco "Tracking de combate (opcional)" com resumo do que oferece e interruptor (padrão desligado); trocar para outro sistema esconde e zera. O texto explica que dá para ligar depois.
4. **Ligar/desligar depois:** cartão da nativa na tela Extensões e seção em `TelaConfiguracoes` (junto de `opcoesRegras`), com confirmação ao desligar ("os dados do combate são preservados") e a opção "visível para jogadores".
5. **Regras do Firestore:** funções `combateLigado(mesaId)` (lê o doc da mesa: `extensoesNativas['tracking-de-combate'].ativa == true` e sistema D&D 5e) e `combateVisivelJogador(mesaId)`; blocos `combates/**`, `encontros/**`, `monstros/**` já fechados fora dessas condições. Teste de regras.
6. **Rotas e navegação:** `/mesas/{id}/combate` (mestre) e `/mesas/{id}/jogador/combate`, sidebar com etiqueta "Extensão", Ctrl+K; fora das condições mostram "Extensão indisponível" (padrão das Marcas). Estados vazios ("Nenhum combate ainda").
7. **Esqueleto de código:** pastas `lib/combate`, `components/combate`, tipos básicos de `Combate`/`Combatente`.

**Critérios de aceite:** mesa D&D 5e criada com a opção ligada mostra a extensão; mesa de outro sistema nunca mostra; desligar some das telas mas preserva os dados; rota direta com a extensão desligada mostra "indisponível"; regras negam leitura/escrita com a extensão desligada (teste).

**Testes:** `nativas.test.ts` (elegibilidade, ativação, visibilidade), regras do Firestore, lógica de seleção do wizard.
**Base:** `extensoes.md`, `mesas-e-convites.md`, `permissoes-e-seguranca.md`, `arquitetura.md`, `glossario.md`, `CHANGELOG`; criar `features/tracking-de-combate.md` (esqueleto).

---

### Fase 1. Tracker compartilhado (G)

**Objetivo:** combate completo "no teatro da mente": iniciativa, turnos, PV e condições, para mestre e jogadores em tempo real, sem mapa.

**Tarefas**
1. **Camada de dados `lib/combate/combates.ts`:** criar/ler/encerrar combate, `onSnapshot` do combate ativo (um por mesa por vez), combatentes e log. Tipos de `Combate`, `Combatente`, `Evento`, `Proposta` (§4).
2. **Lógica pura `regras/dnd5e/turno.ts`:** ordenar iniciativa com **desempate** configurável (Destreza, rolagem, manual), avançar turno/rodada, surpresa (sem agir na 1ª rodada), atrasar e preparar ação, expiração de condições com **duração em rodadas** (início/fim do turno de quem aplicou ou do afetado), contador de rodada.
3. **Combatentes:**
   - **Jogadores:** "Puxar jogadores" (ficha ao vivo: PV, CA, condições, concentração, de `personagens/{uid}`); `ref` ligado ao uid; iniciativa pedida (reaproveita `pedidosTeste` do tipo `iniciativa`) ou rolada pelo site.
   - **NPC/inimigo das fichas do site:** adicionar com quantidade e nome numerado ("Goblin 1, 2…"), PV por rolagem do dado de vida ou média.
   - **Combatente avulso** e **objeto** (obstáculo, relógio, armadilha).
4. **Painel do mestre (mesa de controle):** lista na ordem, turno atual destacado, "Próximo turno", rodada, edição de PV/PV temp/iniciativa/CA, **dano/cura/PV temp** com `combate.ts` (resistência, vulnerabilidade, imunidade, PV temp primeiro), **condições** (as 14 + exaustão) com duração, concentração (dano gera teste de Con com CD = máx(10, dano/2)), salvaguardas de morte para jogadores a 0 PV, remoção/"derrubado" de monstros, morte instantânea.
5. **Log de eventos** (`eventos`): cada ação gera um evento tipado e **reversível**; "Desfazer" restaura o estado anterior; log legível ao mestre.
6. **Visão do jogador:** banner "Combate em andamento" (padrão `PedidoTesteJogador`, montado no `ShellBase`), ordem de iniciativa, quem está na vez, **faixa de saúde** dos monstros (config: oculto/faixas/exato), as próprias condições, o próprio PV da ficha. Sem alterar nada ainda (além do que já faz na ficha).
7. **Relação com a Sessão ao vivo:** a iniciativa de lá **continua** como está, para rodadas fora de combate, e ganha o **texto explicativo** da §3.1 (com atalho para o combate) quando a extensão está ligada. Nada é importado nem sincronizado entre as duas. Sem a extensão, nada muda.
8. **Config do combate (`regras`):** desempate, visibilidade de PV para jogadores, comportamento de monstro a 0 PV, PV de monstros por média ou por rolagem.

**Critérios de aceite:** o mestre inicia o combate e os jogadores o veem ao vivo em outros navegadores; avançar turno atualiza todos; dano a um jogador reflete na ficha dele; condição com duração some sozinha; desfazer volta PV e condição; o PV exato de monstro não vaza ao jogador quando configurado oculto (teste de regras).

**Testes:** `turno.test.ts`; `combate.ts` (acrescentar morte instantânea e concentração); regras do Firestore (visão do jogador).
**Base:** `tracking-de-combate.md`, `sessao-ao-vivo.md`, `fluxos/rodar-um-combate.md` (novo), `permissoes-e-seguranca.md`, `jogadores-e-personagens.md`.

---

### Fase 2. Bestiário e encontros (G)

**Objetivo:** "informações das fichas dos monstros" e preparo de encontros com dificuldade calculada.

**Tarefas**
1. **Esquema `Monstro`** (`src/lib/regras/dnd5e/monstros.ts`): tipo/subtipo, tamanho, tendência, CA com fonte, PV (dado + média), deslocamentos, atributos, salvaguardas, perícias, resistências/vulnerabilidades/imunidades (dano e condição), sentidos, idiomas, ND e XP, bônus de proficiência, características, ações, reações, **ações lendárias** (com custo), **ações de covil e efeitos regionais**, **Recarga X-Y** e usos por dia. Cada ataque com `mecanica` estruturada (bônus, dano e tipo, alcance, CD) no mesmo formato que a ficha rola.
2. **Catálogo e gerador:** `src/data/dnd5e/mm/*` gerado por `scripts/dnd5e/` (mesmo padrão do catálogo atual) a partir de `docs/referencias/` (Livro dos Monstros); validador de consistência (ND × XP, PV × dado, bônus de ataque × atributo+proficiência) com relatório de divergências.
3. **Busca e filtros:** por nome, ND, tipo, tamanho e ambiente; atalho no Ctrl+K.
4. **Ficha do monstro (painel):** "stat block" com ataques e ações **clicáveis** (rola no 3D com a conta visível), resistências e imunidades destacadas, anotações do mestre.
5. **Monstro personalizado:** duplicar/editar/criar (`mesas/{id}/monstros/{id}`), validado pelo mesmo esquema; "escalar" ND (sugestão de PV/CA/ataque pelas tabelas do DMG) como ajuda opcional.
6. **Ligação com fichas de NPC/inimigo** do site: "Usar bestiário" (copia dados) e "Vincular" (referência).
7. **Construtor de encontros:** monstros × quantidade, XP total com **multiplicador por número de monstros**, orçamento do grupo (nível dos **personagens reais** da mesa) e dificuldade (fácil/média/difícil/mortal).
8. **Encontros salvos** (`encontros`): nome, monstros, notas, XP/loot previsto; "Iniciar" cria o combate já com os combatentes.
9. **Integração no combate:** adicionar monstro do bestiário (quantidade, nome numerado, PV rolado ou médio, iniciativa com o bônus de Des do monstro) e usar o painel durante o turno.

**Critérios de aceite:** buscar "Goblin" e ver o stat block; adicionar 4 ao combate com PV individuais; o construtor mostra dificuldade coerente com o DMG para um grupo de 4 de nível 3; criar uma variante homebrew e usá-la.

**Testes:** `encontro.test.ts` (tabelas de XP/ND, multiplicadores, limiares), teste que percorre todos os monstros do catálogo validando o esquema, esquema do homebrew.
**Base:** `bestiario.md` (novo), `tracking-de-combate.md`, `fichas.md`, `glossario.md`.

---

### Fase 3. Mapa e tokens (G)

**Objetivo:** tokens na grade, com movimento e medições. O mapa pode ser **uma cena em grade do site** ou **uma imagem com grade calibrada**.

**Tarefas**
1. **Fonte do mapa (`MapaCombate`):**
   - `origem: { tipo: "cena", cenaId }` usa o `Grid` da cena (colunas, linhas, quadrado/hex) e as dimensões do render.
   - `origem: { tipo: "imagem", mapaId | url, largura, altura }` usa uma imagem de `mapas-e-imagens` ou enviada, com **grade calibrada**.
   - Nas duas, o combate guarda a **própria grade** (`tipo`, `tamanhoCelulaPx`, `origemPx {x,y}`, `colunas`, `linhas`, `metrosPorCelula` padrão 1,5), para que mudar a cena depois não desalinhe os tokens.
2. **Calibração da grade sobre imagem (`CalibrarGrade`):** (a) **dois cliques** sobre uma distância de N células (calcula o tamanho da célula); (b) arrastar a grade para ajustar o **deslocamento**; (c) campos numéricos finos e ajuste de **colunas/linhas**; (d) quadrado ou hex; (e) **pré-visualização** com a grade sobre a imagem e zoom; (f) sugestão automática de grade por análise da imagem como atalho opcional (falha com elegância). A calibração fica salva por mapa para reuso.
3. **Camada de combate (PixiJS)** acima do render ou da imagem: grade, tokens, zonas, alcance de movimento, réguas, templates (Fase 5) e efeitos (Fase 6). Zoom/pan com mouse e gestos de toque; o mapa nunca é alterado.
4. **Geometria pura (`regras/dnd5e/grade.ts`):** conversão célula⇄pixel (quadrado e hex), distância (regra do livro 1,5 m por célula, "5-10-5" ou euclidiana), vizinhança, caminho mais curto com **terreno difícil** e bloqueios, ocupação por **tamanho** (Miúdo a Colossal → 1, 2×2, 3×3, 4×4), alinhamento ao centro.
5. **Tokens:** retrato (ficha/monstro/upload), anel por facção, barra de PV (faixas para jogadores), ícones de condição, indicador de turno, nome opcional, "caído"; token **oculto** (só o mestre vê).
6. **Posicionamento inicial:** arrastar da lista para o mapa, "espalhar" automático e posições salvas no encontro preparado.
7. **Movimento:** arrastar com **custo e alcance restante** destacados (deslocamento da ficha/monstro), terreno difícil marcado pelo mestre (pintar células), células ocupadas bloqueadas (aliados atravessáveis), desfazer movimento. **Permissão:** o jogador move **só o próprio token** e só no próprio turno (o mestre pode liberar); o mestre move tudo e ignora custo.
8. **Medição:** régua livre, distância entre dois tokens selecionados, alcance de arma/magia da ficha ao passar o mouse.
9. **Marcações do mestre:** terreno difícil, perigo, pontos de interesse, desenhos simples (círculos/linhas) e pinos, visíveis ou não aos jogadores.
10. **Sincronização:** posição gravada ao soltar (commit), provisória só local; teto de combatentes por combate; leituras enxutas.
11. **Visão do jogador:** vê só os tokens visíveis; foco da câmera no token da vez (opcional).

**Critérios de aceite:** combate com cena em grade e outro com imagem calibrada (quadrada e hex) funcionam igual; custo de movimento e alcance batem com a regra; o jogador arrasta o próprio token e todos veem; token oculto não chega ao cliente do jogador (regras); a grade calibrada fica salva ao reabrir.

**Testes:** `grade.test.ts` (células, distâncias, caminho, tamanhos, hex), cálculo da calibração, regras (token oculto e permissão de movimento); verificação em navegador (desktop; celular fica para depois, ver `FUTURE_CHANGES.md`).
**Base:** `tracking-de-combate.md`, `mapas-e-imagens.md`, `editor-de-cena.md` (uso pelo combate), `permissoes-e-seguranca.md`.

---

### Fase 4. Ações e ataques (G)

**Objetivo:** o turno fica jogável: economia de ação, ataques, reações e dano aplicado com as regras.

**Tarefas**
1. **Economia por combatente:** ação, ação bônus, reação, movimento (usado/restante), interação com objeto; reinício no início do turno (a reação reinicia no início do **próprio** turno); barra visível ao jogador.
2. **Ações padrão** como botões: Atacar, Conjurar (Fase 5), Correr, Desengajar, Esquivar, Ajudar, Esconder, Preparar, Procurar, Usar objeto; Esquivar/Desengajar/Correr aplicam os efeitos (desvantagem contra ele, sem ataque de oportunidade, deslocamento dobrado).
3. **Ataques:** o jogador escolhe a arma/ataque da ficha e o alvo no mapa; o site checa **alcance** (corpo a corpo, à distância, desvantagem com hostil adjacente, alcance longo), **cobertura** (manual na v1), vantagem/desvantagem **automáticas** por condições do atacante e do alvo (`combate.ts`), rola no 3D, compara com a CA do alvo e mostra acerto/erro/crítico; o dano rolado vira **dano pendente** para aplicar (confirmação do mestre ou auto-aprovação).
4. **Monstros:** o mestre dispara qualquer ação do stat block no turno do monstro (Ataques Múltiplos como sequência), com alvo no mapa e a mesma resolução.
5. **Resolução de dano:** resistência/vulnerabilidade/imunidade (do bestiário e da ficha), crítico dobra os dados, dano de tipos mistos, **PV temp**, **PV 0 → morte/inconsciência**, dano massivo, estabilizar, **cura** e reviver.
6. **Reações e janelas:** **ataque de oportunidade** sugerido ao sair do alcance (o mestre confirma); janela de reação aberta pelo mestre ou quando há reação possível (Escudo Arcano, Contrafeitiço, Parada…), com prompt ao jogador.
7. **Ações lendárias** (pontos por rodada, custo, uso ao fim do turno de outro), **ações de covil** (iniciativa 20), **Recarga X-Y** (rolagem no início do turno do monstro) e **usos por dia**.
8. **Solicitações do jogador:** ataque/ação que afeta outro jogador vira `proposta` (§8) que o mestre **aprova** e só então é aplicada; painel do mestre com fila, "aprovar", "recusar" e "aprovar tudo". Efeitos **só em monstros** seguem a regra de magias automáticas (dupla verificação, Fase 5).
9. **Vantagem/desvantagem explicada:** o painel mostra os motivos (ex.: "alvo caído a 1,5 m") e o mestre sempre pode anular.
10. **Fim do combate:** detecta "todos os inimigos derrotados" (sugere encerrar); jogador derrubado faz as salvaguardas de morte no turno dele.

**Critérios de aceite:** um goblin ataca um jogador: o mestre clica na ação, escolhe o alvo, rola, compara com a CA, aplica o dano com resistência e o PV da ficha muda; o ataque de oportunidade é sugerido ao sair de alcance; uma reação gasta fica marcada até o próximo turno; ação lendária desconta pontos.

**Testes:** `acoes.test.ts` (economia, vantagem/desvantagem por condição, alcance, crítico, dano misto, recarga, lendárias), regras das propostas.
**Base:** `tracking-de-combate.md`, `ficha-dnd5e.md` (como a ficha alimenta o combate), `fluxos/rodar-um-combate.md`.

---

### Fase 5. Magias (G)

**Objetivo:** conjurar a partir da ficha, escolher alvos e áreas no mapa, resolver salvaguardas e aplicar efeitos (detalhes em [`magias-no-combate.md`](magias-no-combate.md)).

**Tarefas**
1. **`MecanicaMagia` ampliada:** `alvos { max, quem: criatura|aliado|inimigo|ponto|objeto, dividivel }`, `cura/dano` com **valor fixo** (70 PV, 20 de dano), `salvaguarda { atributo, aoSucesso: metade|nada|condicao }`, `condicoes` com duração em rodadas, `duracao`, `concentracao`, `zona` (áreas persistentes), `dardos` e escala por círculo. **Migrar** as magias já cobertas e marcar o restante como "manual" (as 172 utilitárias seguem sem efeito automático). Teste de integridade do catálogo.
2. **Geometria de áreas (`regras/dnd5e/area.ts`):** esfera, cubo, cilindro, cone e linha (com largura) sobre grade quadrada e hex; origem e direção; regra de inclusão do token configurável (**centro**, **qualquer parte**, **manual**); verificador de **alcance** da magia (e linha reta quando houver paredes).
3. **Fluxo de conjuração:** "Conjurar" na ficha, com a extensão ligada, abre o fluxo do combate: magia e círculo (gasta o espaço; a concentração substitui a anterior), template segue o cursor, alvos sugeridos, ajuste manual, confirmar.
4. **Rolagens da magia:** ataque de magia contra a CA, ou **CD** com **salvaguarda por alvo** (monstros: bônus do bestiário automático; jogadores: pedido de teste, no cartão que já existe); resolve **dano cheio/metade/nada** e condições; **Mísseis Mágicos/Raios** com dardos distribuídos.
5. **Divisão por clique:** o total de cura/dano vira um "balde" a repartir entre alvos (resto zerado antes de aplicar); vale para Cura em Massa, Palavra de Cura, dardos e Raio Ardente.
6. **Aplicação (automática, com dupla verificação e undo):** no turno do jogador a magia se resolve sozinha, em dois passos obrigatórios: **(1) conferência do conjurador**, que vê o resumo "o que vai acontecer" (por alvo: dano, tipo, resistência, condição, espaço gasto) e confirma; **(2) revalidação automática** do sistema logo antes de gravar (espaço de magia disponível, é o turno dele e a ação/ação bônus não foi gasta, alcance e alvos ainda válidos, concentração, CD e bônus conferem, alvos não mudaram de PV/posição desde a prévia); qualquer divergência cancela e pede nova conferência. Depois aplica em lote. **O mestre vê tudo no log e pode desfazer (undo) qualquer aplicação**, restaurando PV, condições, espaço de magia, zonas e concentração. Resumo "o que vai acontecer" (por alvo: dano, tipo, resistência, condição), aplicar em lote; em outro jogador vira **solicitação aprovada pelo mestre** (§8); desfazer pelo log.
7. **Concentração:** dano sofrido gera teste de Con automático (CD); perda encerra a magia, as condições e as zonas ligadas.
8. **Casos especiais manuais:** Sono, Leque Cromático, Corrente de Relâmpagos, Convocações e polimorfias abrem um painel manual guiado (o mestre pode sempre resolver à mão).
9. **Magias de monstros e itens:** o monstro conjura pelo bestiário (CD própria, círculos/usos por dia); itens com cargas reutilizam o fluxo.

**Critérios de aceite:** Bola de Fogo: o jogador posiciona a esfera, vê os tokens atingidos, cada alvo rola Des contra a CD, o dano é cheio ou metade e o PV dos alvos atualiza em um clique; Cura Completa em Massa divide 700 PV entre 5 alvos; perder a concentração remove a condição aplicada.

**Testes:** `area.test.ts` (cada forma, quadrado e hex, bordas), `conjuracaoCombate.test.ts` (salvaguarda por alvo, metade, divisão, escala), integridade do catálogo.
**Base:** `tracking-de-combate.md`, `ficha-dnd5e.md`; `magias-no-combate.md` sai do planejamento.

---

### Fase 6. Efeitos e zonas (M)

**Objetivo:** o efeito é visível, vivo e persiste enquanto durar.

**Tarefas**
1. **Zonas persistentes (`zonas`):** forma, origem, dono, magia de origem, duração em rodadas, vínculo à concentração, cor/estilo e **gatilhos** (ao entrar, ao começar o turno na zona, ao terminar): avisa o mestre com um clique para aplicar dano/condição, ou aplica sozinho se configurado. Cobre Névoa, Teia, Muralha de Fogo, Escuridão, Silêncio, Espíritos Guardiões e terreno difícil por magia.
2. **Efeitos visuais:** biblioteca procedural (PixiJS) por escola/tipo de dano × forma (projétil, explosão, cone, linha, cura em anel, aura), com duração e intensidade; "sem animação" e `prefers-reduced-motion`; **sprite/GIF próprio** anexável pelo mestre a uma magia.
3. **Sincronização por evento:** cada cliente toca o efeito a partir do evento do log (sem trafegar mídia); atraso tolerado, sem bloquear a jogada.
4. **Feedback no token:** número flutuante de dano/cura, tremor, brilho de condição, transição suave de movimento.
5. **Som:** efeitos por tipo (padrão `som-dados`), volume e mudo; sinal de "sua vez".
6. **Câmera:** segue o token da vez, enquadra a área do efeito, com opção de travar para o jogador.
7. **Fim automático:** zonas e efeitos caem pela duração, pela concentração ou manualmente.

**Critérios de aceite:** Névoa Obscurecente aparece como zona e some quando a concentração cai; Bola de Fogo toca a explosão para todos; o jogador com "efeitos reduzidos" vê só o marcador.

**Testes:** `zonas.test.ts` (duração, expiração, gatilhos por posição/turno, vínculo com concentração); verificação visual em navegador.
**Base:** `tracking-de-combate.md`, `permissoes-e-seguranca.md` (zonas).

---

### Fase 7. Encerramento: XP e loot (M)

**Objetivo:** fechar o combate com recompensas e registro.

**Tarefas**
1. **Tela de encerramento:** resumo (rodadas, dano causado e sofrido, derrotados) e lista de monstros derrotados com ND/XP.
2. **XP:** soma por ND, **divisão** entre os jogadores presentes (ou pesos, ou manual), ajuste do mestre, aplicação à ficha com o **aviso de subida de nível** que já existe; XP avulso e de missão.
3. **Loot:** (a) **tesouro individual/acumulado do DMG** por ND (rolagem nas tabelas, resultado editável), (b) tesouro **definido pelo mestre** por encontro/monstro, (c) itens do **catálogo de equipamento** e mágicos por raridade, (d) moedas com conversão. Visão **só do mestre** até a liberação.
4. **Distribuição:** entregar a um personagem (vai ao inventário), ao **baú do grupo** (compartilhado) ou dividir moedas; registro de quem pegou o quê; aviso de capacidade de carga.
5. **Resumo salvo:** nota na sessão (padrão do "Encerrar e registrar" da Sessão ao vivo) com o log resumido.
6. **Pós-combate:** limpar condições temporárias e zonas, sugerir descanso curto/longo, arquivar o combate (consultável em modo leitura).

**Critérios de aceite:** derrotar 4 goblins dá o XP correto dividido entre 4 jogadores; um item sorteado vai ao inventário do jogador escolhido; o resumo aparece na nota da sessão.

**Testes:** `recompensas.test.ts` (XP, divisão, tabelas de tesouro com `rng` determinístico), entrega ao inventário.
**Base:** `tracking-de-combate.md`, `fichas.md`, `ficha-dnd5e.md` (XP/inventário), `sessoes-e-segredos.md`.

---

### Fase 8. Abertura e criatividade do mestre (M)

**Objetivo:** o combate vira plataforma; o mestre cria o que nós não previmos.

**Tarefas**
1. **Eventos no broker** (`lib/extensoes/eventos.ts`): `combate.iniciado/encerrado`, `rodada.avancada`, `turno.iniciado/terminado`, `dano.aplicado`, `cura.aplicada`, `condicao.aplicada/removida`, `magia.conjurada`, `token.movido`, `combatente.derrotado`, `zona.entrou/saiu`, com payload documentado.
2. **Capacidades** (`capacidades.ts`): ler combate/combatentes, mover token, aplicar dano/condição, criar zona, rolar, enviar mensagem; o **mestre aprova** o que cada extensão pode (padrão existente); limites de taxa.
3. **Encaixes de UI:** `combate.painel` (mestre) e `combate.jogador`; prompt da IA de extensões (`prompt.ts`) atualizado com eventos/capacidades do combate e exemplos.
4. **Macros do mestre:** gravar uma sequência de ações (explosão do dragão, terremoto, armadilha) e disparar em um clique, com parâmetros (área, dano, CD).
5. **Modelos:** encontros e macros **exportáveis/importáveis** (JSON) e reaproveitáveis entre mesas do mesmo mestre.
6. **Regras da casa:** painel de chaves (diagonais, desempate, crítico máximo, falha/sucesso automáticos, morte de monstro, cobertura, fadiga) com o padrão do livro.
7. **Gatilhos sem código:** "quando X, então Y" por formulário (ex.: "quando o chefe chegar a metade do PV, rolar a iniciativa dos reforços").
8. **Modo livre:** qualquer valor editável; combatente, ação e condição **personalizados** (ex.: condição inventada com texto e duração).

**Critérios de aceite:** uma extensão criada com IA reage a `combatente.derrotado`; uma macro dispara um efeito em área e aplica dano em lote; exportar e importar um encontro entre mesas.

**Testes:** `eventos.test.ts` do combate, permissões das capacidades, macros (sequência e parâmetros).
**Base:** `extensoes.md`, `tracking-de-combate.md`, `glossario.md`.

---

### Fase 9. Imersão (V1) (M)

**Objetivo:** acabamento de atmosfera e qualidade para fechar a V1. (Visão, luz, névoa de guerra e cobertura automática foram movidas para a **V2**, ver `FUTURE_CHANGES.md`.)

**Tarefas**
1. **Trilha sonora** por fase do combate (início, "chefe abaixo de 50%", vitória) escolhida pelo mestre.
2. **Replay do combate** pelo log (linha do tempo navegável e resumo narrativo exportável).
3. **Acessibilidade:** alto contraste, descrição textual do mapa para leitores de tela, atalhos de teclado nos fluxos principais.
4. **Desempenho:** teste de carga com 40 tokens e 10 zonas; ajustes de renderização.
5. **Revisão final da V1:** passada de consistência na base de conhecimento, testes de regras do Firestore e checklist de segurança (visibilidade, solicitações, undo).

**Critérios de aceite:** o replay reproduz um combate real; a trilha troca nos gatilhos configurados; a carga de 40 tokens roda sem travar em desktop.

**Testes:** replay a partir do log (determinismo), carga; verificação em navegador.
**Base:** `tracking-de-combate.md`, `permissoes-e-seguranca.md`.

---

### Visão de entregas

| Fase | Entrega principal | Esforço |
|---|---|---|
| 0 | Extensão opt-in por sistema + wizard + regras | M |
| 1 | Tracker compartilhado (iniciativa, PV, condições, log) | G |
| 2 | Bestiário, homebrew e construtor de encontros | G |
| 3 | Mapa (cena ou imagem calibrada), tokens, movimento | G |
| 4 | Ações, ataques, reações, lendárias | G |
| 5 | Magias com alvos, áreas e salvaguardas | G |
| 6 | Zonas persistentes e efeitos visuais | M |
| 7 | XP e loot | M |
| 8 | Eventos, macros, gatilhos, regras da casa | M |
| 9 | Trilha sonora, replay, acessibilidade, desempenho (fecha a V1) | M |

## 12. Testes e qualidade

- **Funções puras e testadas** (padrão do projeto): geometria de áreas (esfera/cone/linha/cubo sobre grade quadrada e hex), custo de movimento, alcance, XP/ND/orçamento de encontro, resolução de salvaguarda/metade, ordem de iniciativa e desempate, duração de condições/zonas, concentração. Ficam em `src/lib/regras/dnd5e/` (ex.: `area.ts`, `encontro.ts`, `turno.ts`, `acoes.ts`) com `*.test.ts`.
- **Regras do Firestore:** testes de que o jogador não lê dados ocultos nem escreve fora do permitido, e de que nada abre com a extensão desligada.
- **Verificação em navegador** de cada fase (mapa, arrastar, templates, efeitos), em desktop. Suporte a celular no mapa é tratado depois (`FUTURE_CHANGES.md`).
- **Desempenho:** teto de tokens/zonas por combate, efeitos pesados desligáveis, `onSnapshot` só no combate ativo.

## 13. Documentação a produzir ao implementar

Páginas novas em `docs/base-conhecimento/features/` (`tracking-de-combate.md`, `bestiario.md`), `fluxos/` (`rodar-um-combate.md`), e atualização de `extensoes.md`, `mesas-e-convites.md` (passo do wizard), `sessao-ao-vivo.md` (texto sobre a iniciativa fora de combate), `permissoes-e-seguranca.md`, `arquitetura.md`, `glossario.md` e `CHANGELOG.md`.
