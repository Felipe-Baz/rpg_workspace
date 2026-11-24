# Planejamento: Ficha D&D 5e totalmente automatizada

> **Status: plano. Nada disto existe ainda.** A ficha atual está descrita em [`features/ficha-dnd5e.md`](../base-conhecimento/features/ficha-dnd5e.md). Quando uma fase for entregue, a base de conhecimento é atualizada e a fase sai daqui.

> **Pendências consolidadas (limitações, itens adiados e o que ficou de fora das Fases 0 a 7):** [`pendencias-ficha-dnd5e.md`](pendencias-ficha-dnd5e.md).

## 1. Objetivo

Quando a mesa usa **D&D 5e** (`ehDnd5e(mesa.sistema)`), a ficha deixa de ser um formulário que "ajuda a conta" e passa a ser um **motor de regras**: o jogador *escolhe* (raça, classe, antecedente, magias, equipamento) e a ficha *deriva* tudo o mais (atributos finais, CA, PV, perícias, espaços, CD, ataques, recursos, limites). Meta de paridade com D&D Beyond / Foundry dnd5e / Roll20, com visual temático próprio.

Referência de conteúdo: `docs/referencias/playerbook/` (6 arquivos: 12 classes com tabelas de progressão e subclasses, 9 raças, 13 antecedentes, 361 magias com listas por classe, equipamento com preços/pesos/propriedades, 42 talentos e regras de multiclasse).

## 2. Onde estamos (já existe, não refazer)

| Já pronto | Onde |
|---|---|
| Modificadores, proficiência por nível, salvaguardas, perícias (0/1/2), iniciativa, percepção passiva, CD e ataque de magia | `src/lib/dnd5e.ts` |
| Rolagem com conta visível, vantagem/desvantagem, crítico, rolador 3D compartilhado | `PainelRolagem.tsx`, `rolagens.ts`, [dados-3d](../base-conhecimento/features/dados-3d.md) |
| 12 classes (dropdown), espaços completo/meio/pacto, limites de truques/preparadas/lista, "Conjurar" que gasta espaço | `CLASSES_CONJ`, `limitesMagia`, `conjurar` |
| Descanso curto (2 por longo) e longo, dados de vida, PV temporário, salvaguardas de morte | `descansoCurto`, `descansoLongo` |
| Inventário item a item, livro de história em markdown, importação do PDF oficial | `FichaDnd5e.tsx`, `LivroHistoria.tsx`, `importarFichaPdf.ts` |

**Lacunas que este plano fecha:** a ficha não *conhece* o conteúdo do livro. Raça, antecedente, subclasse, talentos e características são texto livre; magias são cadastradas à mão (campos vazios); não há CA por armadura, multiclasse, recursos com usos, condições, concentração, nem escolha guiada na criação/subida de nível.

## 3. Princípios de arquitetura

1. **Catálogo estático, ficha só guarda escolhas.** O conteúdo do livro vira dados versionados no repositório (não no Firestore). A ficha guarda **ids** + decisões do jogador (ex.: `raca: "alto-elfo"`, `magias: ["bola-de-fogo"]`) e **overrides** manuais. Tudo o mais é derivado em runtime, como já é hoje com modificador/proficiência. Vantagens: sem custo de leitura, correção de erro de regra corrige todas as fichas, documentos ficam pequenos.
2. **Motor de efeitos.** Toda fonte (raça, subclasse, característica de classe, antecedente, talento, item equipado, condição, magia ativa) declara **efeitos tipados** (`+2 Con`, `proficiência em Furtividade`, `CA base = 10 + Des + Con`, `resistência a fogo`, `vantagem em salvaguarda de Sab contra encantamento`, `deslocamento +3 m`). Uma função pura `derivar(ficha) → FichaCalculada` aplica a pilha de efeitos em ordem definida. Isso é o que torna a ficha "viva": equipar/desequipar, ativar Fúria ou ganhar um nível recalcula tudo.
3. **Sempre explicável.** Cada número derivado carrega sua **origem** (`CA 17 = 11 couro batido + 3 Des + 2 escudo + 1 anel`), já no espírito da ficha atual. Tooltip/painel mostra a fonte de cada parte.
4. **Override sempre possível.** Mesa tem regra da casa e itens homebrew: qualquer valor derivado aceita um ajuste manual (`bonus` / `substituir`) sinalizado visualmente. Nunca travar o jogador.
5. **Retrocompatível.** Fichas existentes e o importador de PDF continuam funcionando: `normalizar` migra texto livre para ids quando reconhece ("Alto Elfo" → `alto-elfo`) e preserva o resto como texto/override. Sem migração destrutiva.
6. **Puro e testável.** Motor sem React, com testes "golden" contra as tabelas do livro (§9).
7. **Confiança na mesa continua.** Automação *sugere e calcula*; o que o livro restringe é bloqueado só onde já é hoje (limites de magias ativas). Rolagem física segue como opção de primeira classe.

## 4. Conteúdo: catálogo do livro

### 4.1 Pipeline de dados
Os `.md` de referência têm estrutura regular (magias: `#### Nome` → `_3° nível de evocação_` → `- **Tempo de Conjuração:** ...` → texto → `**Em Níveis Superiores**`; classes: tabela de progressão por nível com colunas de espaços/truques/conhecidas). Plano: um **script de geração** (`scripts/gerar-catalogo-dnd5e.mjs`, roda manualmente, não no build) lê os `.md` e emite JSON tipado em `src/data/dnd5e/`:

| Arquivo | Conteúdo | Fonte |
|---|---|---|
| `magias.json` | id, nome, nível, escola, ritual, tempo, alcance, componentes (V/S/M + material), duração, concentração, descrição, nível superior, classes que a têm, **mecânica estruturada** (§4.2) | `dnd5e-magias.md` |
| `classes.json` | dado de vida, proficiências, salvaguardas, perícias a escolher, equipamento inicial, tabela nível→{proficiência, características, truques, conhecidas, espaços, recursos}, subclasses | `dnd5e-classes.md` |
| `racas.json` | bônus de atributo, tamanho, deslocamento, idiomas, traços, sub-raças | `dnd5e-racas.md` |
| `antecedentes.json` | perícias, ferramentas, idiomas, equipamento, característica, tabelas de personalidade (d6/d8) | `dnd5e-antecedentes.md` |
| `equipamento.json` | armas (dano, propriedades, alcance), armaduras (CA, req. de Força, desvantagem em furtividade), itens, pacotes, ferramentas, custos, pesos | `dnd5e-equipamento.md` |
| `talentos.json` | pré-requisitos e efeitos | `dnd5e-talentos-multiclasse.md` |
| `multiclasse.json` | pré-requisitos, proficiências ganhas, tabela de espaços por nível de conjurador | idem |

O JSON gerado é **commitado** e revisado (diff legível), com uma **revisão manual** onde o parser não for confiável. Typos conhecidos nas fontes (ex.: "encantmento", "Escrita ilusória") passam por uma lista de correções no script.

### 4.2 Mecânica estruturada das magias (o que torna a automação possível)
O texto livre é parseado só para exibição. Para automatizar rolagens, cada magia ganha um bloco `mecanica` com **revisão humana**, preenchido em duas passadas: (a) heurística/regex sobre o texto ("teste de resistência de Destreza", "8d6 de dano de fogo", "ataque à distância com magia", "em níveis superiores ... 1d6 para cada nível") e (b) conferência manual das ~361 (mais viável que parece: ~40% têm dano/cura/salvaguarda, o resto é utilitário).
```
mecanica: { ataque?: "corpo"|"distancia", salvaguarda?: Atributo, danos: [{dado, tipo}], cura?: dado,
            escalaNivel?: {dado, por}, escalaPersonagem?: [{nivel, dado}]  // truques: 5/11/17
            area?: {forma, tamanho}, condicoes?: string[], alvos?: texto }
```
Com isso: **ampliar** a magia recalcula o dado (`8d6` → `9d6` no 4º círculo); **truques escalam** com o nível do personagem; o botão certo aparece (ataque / salvaguarda com a CD / cura) sem o jogador cadastrar nada.

### 4.3 Tamanho e carregamento
~360 magias × ~1,2 KB ≈ 0,5 MB bruto: **import dinâmico** (`await import`) só ao abrir a aba Magias / o compêndio / o assistente; cacheado pelo navegador. Nada disso vai ao Firestore. Busca com índice em memória (nome sem acento, escola, classe).

### 4.4 Licença (decidido)
Catálogo completo **no repositório**, risco assumido pelo dono. O catálogo é fornecido em **pacotes de conteúdo** (`PacoteConteudo`: `phb` agora; Xanathar, Tasha, homebrew da mesa depois) atrás da interface `Catalogo` (`src/lib/regras/dnd5e/catalogo.ts`); todo item registra o pacote de origem e id repetido entre pacotes é erro. Escopo atual: só o Livro do Jogador.

## 5. Modelo de dados proposto

Ficha passa a ter um bloco `build` (escolhas) e mantém os campos atuais como override/legado. Derivado nunca é gravado.

```
build: {
  raca: {id, subId, escolhas}       // ex.: humano variante: 2 atributos + 1 perícia + 1 talento
  antecedente: {id, escolhas}       // perícias/idiomas/ferramentas escolhidos, personalidade
  classes: [{id, nivel, subclasse?, escolhas}]   // array → multiclasse nasce no modelo
  atributosBase: Record<Atributo,number>         // + método (padrão 15,14,13,12,10,8 / compra / manual)
  historicoNiveis: [{classe, pvRolado|"medio", incremento: {atributos|talento}}]
  talentos: id[]
}
magias: [{id, origem: classeId|"raca"|"talento"|"item", preparada, sempre}]  // grimório, conhecidas
inventario: [{catalogoId?|custom, qtd, equipado, sintonizado, cargas, notas}]
recursos: Record<id, {usados}>      // fúria, ki, inspiração bárdica, ...
condicoes: id[], concentracao?: magiaId, efeitosAtivos: id[]
overrides: Partial<...>             // ajustes manuais com rótulo
```
`classe`/`nivel` atuais viram `classes[0]`/soma dos níveis: `normalizar` converte, e o importador de PDF continua escrevendo o formato legado (que a normalização promove). Regras do Firestore: o caminho `mesas/{id}/personagens/{uid}` não muda; tamanho do documento cai, pois não guarda texto de magias/traços do catálogo.

## 6. Capacidades (o "bater de frente com os VTTs")

### 6.1 Criação guiada e subida de nível (assistente)
- Passo a passo: raça → classe → antecedente → atributos (padrão/compra/rolagem 4d6 descartando o menor, com rolador 3D) → perícias/equipamento → magias → revisão. Cada passo mostra o texto do livro e o efeito no resultado.
- **Subir de nível:** assistente que aplica o que a tabela dá naquele nível (novas características, truques/magias novas, incremento de atributo **ou** talento nos níveis 4/8/12/16/19, subclasse no nível certo, PV por dado/média) e aplica à ficha. Pode ser feito sem o assistente (manual) como hoje.
- Respeita multiclasse opcional: pré-requisitos de atributo, proficiências reduzidas, espaços pela tabela de conjurador multiclasse, soma de níveis de conjurador (completo + ½ + ⅓).

### 6.2 Compêndio e magias
- **Compêndio de magias** pesquisável (nome, círculo, escola, classe, ritual, concentração, componentes), com cartão de leitura completo e filtros salvos. Mesmo compêndio para itens, talentos e características.
- **Aba Magias inteligente:** "Aprender/Preparar" pela lista da classe (só oferece o que a classe pode), contadores de truques/preparadas/conhecidas vindos de `limitesMagia`, **grimório do mago** (copiar magia custa 50 po/círculo e 2 h/círculo, opcional), **magias sempre preparadas** (domínio, juramento), rituais sem gastar espaço quando a classe permite, bruxo com espaços de pacto e **Arcanum Místico**.
- **Conjurar de verdade:** escolher círculo (filtra os com espaço livre), checar componentes (material com custo, foco), rolar ataque/dano/cura/salvaguarda **já com a CD** e o dado escalado, registrar concentração.
- **Concentração:** uma por vez; conjurar outra pergunta se quer encerrar a atual; **dano sofrido sugere o teste de Con** (CD = máx(10, dano/2)) e rola com bônus de salvaguarda (incluindo *Conjurador de Guerra* se tiver o talento).
- Limites de slots por círculo e por nível vêm direto das tabelas (já existem para 8 classes; falta subclasses conjuradoras e multiclasse).

### 6.3 Combate e defesa
- **CA calculada** pelo equipamento equipado: armadura leve/média/pesada (Des com teto), escudo, "Defesa sem Armadura" de bárbaro/monge, *Armadura Arcana*, bônus mágicos. Alerta quando falta Força para armadura pesada e desvantagem em furtividade.
- **Ataques derivados das armas** do inventário: proficiência por categoria/arma, **acuidade** (maior entre For e Des), arremesso, versátil (dano de 1 ou 2 mãos), munição, alcance, **ataque desarmado**; cada arma equipada vira linha de ataque pronta. Ataque Extra mostrado como contagem de ataques por ação.
- **Rolagens automáticas e encadeadas:** clicar no ataque rola acerto; se acertar (ou o jogador confirmar), oferece o dano; **crítico em 20 natural** dobra os dados; **vantagem/desvantagem automáticas** a partir de condições (caído, envenenado, escondido...) e características (Ataque Descuidado, Astúcia Ardilosa), com o motivo à mostra.
- **Dano com tipo e defesas:** aplicar dano à ficha considera **resistência/vulnerabilidade/imunidade** (efeitos de raça/classe/magia), PV temporário primeiro (já existe), morte instantânea (dano restante ≥ PV máx), estabilizar e teste de morte automatizado (20 = 1 PV, 1 = 2 falhas).
- **Condições** (as 15 do livro + exaustão em 6 níveis): aplicar uma condição **propaga seus efeitos** (desvantagem, deslocamento 0, falha automática em For/Des, etc.) e aparece como selo na ficha e na tela do mestre.
- **Iniciativa e turno** integrados ao que já existe de sessão ao vivo (rolar iniciativa a partir da ficha, mostrar PV/CA/condições para o mestre no rastreador).

### 6.4 Recursos, descansos e características
- **Recursos com usos** declarados pela classe/subclasse/raça/talento (Fúria N/descanso longo, Pontos de Ki, Recuperação Arcana, Inspiração de Bardo, Canalizar Divindade, Surto de Ação, Pontos de Feitiçaria, Forma Selvagem...), com contador clicável e **tipo de recarga** (curto/longo/alvorada). Os descansos que já existem passam a recarregar o que é do tipo certo.
- **Características ativáveis** (Fúria: +dano, resistência, vantagem em For; Forma Selvagem; Ataque Furtivo com dado por nível; Imposição de Mãos como reserva de PV) com efeito automático enquanto ligadas.
- **Aba Características** agrupada por fonte (raça, classe, subclasse, antecedente, talentos) com o texto do livro, no lugar do textarea de traços (que continua como notas).

### 6.5 Inventário e economia
- Adicionar do **catálogo** (armas, armaduras, ferramentas, pacotes de equipamento que expandem em itens), peso/custo preenchidos; item custom continua possível. **Carga**: capacidade `15 × For`, regra opcional de sobrecarga (deslocamento reduzido). Moedas com **conversão** (pc/pp/pe/po/pl) e botão "trocar".
- **Sintonização** (máx. 3), cargas de itens mágicos com recarga, itens que concedem efeitos (anel +1 CA) ligados ao motor.
- Transferir item entre jogadores/mestre (via mestre, usando o que já existe de liberação de conteúdo — avaliar na fase).

### 6.6 Perícias, proficiências e testes
- Perícias com **fonte da proficiência** visível (raça/antecedente/classe/talento), **Jack of All Trades** (bardo, +metade da proficiência), **Mão Leve**, especialistas, proficiência em ferramentas e idiomas por fonte; **testes passivos** (Percepção, Intuição, Investigação) derivados.
- **Teste de grupo/contestado** não é escopo da ficha.
- Teste "com ferramenta": escolher perícia + ferramenta e somar proficiência da ferramenta.

### 6.7 Experiência do mestre
- Mestre vê todas as fichas **calculadas**, com filtro "preciso conferir" (valor fora do livro por override), pode **aplicar dano/cura/condição** a uma ficha de jogador (a regra de Firestore já permite escrita do mestre) e **conceder XP** (soma e aviso de "pode subir de nível").
- **Resumo do grupo** (CA, PV, CD, Percepção passiva, idiomas, proficiências cobertas) para planejar encontros.

## 7. Direção visual (tema D&D)

Hoje a ficha usa o tema roxo/dourado do site. Plano: um **tema de ficha** próprio sob a mesma base de tokens (`--gold`, `--card`...), sem criar um segundo design system:
- **Linguagem de pergaminho/tomo:** fundo de papel envelhecido no modo claro e couro/ébano no escuro, bordas com cantos ornamentados e **filetes dourados**, divisores com runas, cabeçalhos em fonte display serifada (a ficha já usa `font-display`), texto de leitura em serifada legível.
- **Layout de ficha clássica:** coluna de atributos em "medalhões" hexagonais/brasão (valor grande + modificador), CA em **escudo**, PV em **barra com gema/coração** que reage a dano (pulso vermelho) e a PV temporário (camada azul), iniciativa/deslocamento/proficiência em "runas", perícias com **losango** de proficiência (cheio/duplo para especialista).
- **Magias como cartas:** cartão com borda por **escola** (cor + ícone: abjuração, conjuração, adivinhação, encantamento, evocação, ilusão, necromancia, transmutação), selo de círculo, badge de concentração/ritual, componentes V/S/M como glifos; **espaços de magia como gemas** que escurecem ao gastar.
- **Dados e feedback:** botões "d20" em todo bônus clicável, animação de rolagem reaproveitando o rolador 3D, brilho em crítico e "tremor" em falha crítica, som já existente (`som-dados`).
- **Abas como "marcadores de livro"** e a aba História já em formato de livro (manter).
- **Responsivo:** em celular (jogador na mesa), modo **compacto "de combate"** (PV, CA, ataques, espaços, condições em uma tela) e as demais abas rolando; alvos de toque ≥ 44 px. Acessibilidade: contraste AA nos dois temas, ornamento nunca carrega informação sozinho, `prefers-reduced-motion` desliga animações.
- **Ativos:** ícones SVG próprios (escolas, condições, atributos, tipos de dano) para não depender de arte com licença; texturas leves (SVG/CSS) para não pesar. Uma rodada de design (Figma ou protótipo em artifact) antes da Fase 5.

## 8. Fases de entrega

Cada fase é **entregável sozinha**, mantém a ficha atual funcionando e atualiza a base de conhecimento ao final. Tamanhos: P ≈ dias, M ≈ 1–2 semanas, G ≈ 2–4 semanas (de uma pessoa; indicativo).

| # | Fase | Entrega visível | Tam. |
|---|---|---|---|
| 0 | **Decisões e fundação** (✅ código entregue: motor de efeitos, registro de sistemas, `build`, catálogo em pacotes, `derivar()` esqueleto, `validar()`; falta o protótipo visual) | Resolver licença (§4.4); desenho final do modelo `build`; interface `catalogo.ts`; esqueleto do motor `derivar()` + testes; protótipo visual aprovado | P |
| 1 | **Catálogo de magias + compêndio** (✅ entregue: JSON de 361 magias, gerador, compêndio e "Do catálogo"; pendentes: revisão humana da `mecanica` das ~177 magias sem extração e botões de rolagem com dado escalado na ficha, que seguem na Fase 2) | `magias.json` completo (com `mecanica`), compêndio pesquisável, "Adicionar do catálogo" na aba Magias (nome/escola/alcance/descrição preenchidos), cartão de leitura da magia, listas por classe | G |
| 2 | **Conjuração completa** (✅ entregue: lista da classe, escala por círculo/nível, CD, ritual, sempre preparada, concentração; ⏳ pendentes: grimório do mago, Arcanum Místico do bruxo, subclasses conjuradoras) | Aprender/preparar pela lista da classe, grimório, sempre preparadas, rituais, escala por círculo e por nível, CD/ataque/cura/salvaguarda automáticos, concentração com teste de Con, bruxo (pacto/Arcanum), subclasses conjuradoras (Cav. Místico, Trapaceiro Arcano) | G |
| 3 | **Raça, antecedente e classe como dados** (✅ entregue: catálogo, construção, valores calculados, Traços por fonte, opções da mesa; ⏳ pendentes: migração só reconhece o texto da raça/antecedente, escolhas da classe além das perícias (estilo de luta, especialização), Arcanum/grimório e tabelas de subclasse por nível) | Escolha de raça/sub-raça/antecedente/classe com efeitos aplicados (atributos, deslocamento, idiomas, proficiências, salvaguardas, PV, dados de vida); aba Características por fonte; migração de texto livre; opções da mesa (talentos) nas configurações | G |
| 4 | **Equipamento, CA e ataques derivados** (✅ entregue; ⏳ pendentes: efeitos de itens mágicos além de bônus numérico, cargas, sobrecarga com penalidade, transferência entre jogadores, Armadura Arcana na Fase 5) | Catálogo de itens, CA calculada, ataques das armas, proficiência/acuidade/versátil/arremesso, carga e sintonização, moedas com conversão | M |
| 5 | **Recursos, condições e combate** (✅ entregue o núcleo; ⏳ pendentes: dano do mestre atômico por campo, condições/PV na iniciativa da sessão (Fase 8), Artes Marciais, Arcana Mística, efeitos de mais características de classe) | Recursos com recarga ligados aos descansos, características ativáveis (Fúria etc.), condições com efeitos, resistências, morte e estabilização, vantagem/desvantagem automáticas, aplicar dano pelo mestre | G |
| 6 | **Assistentes** (✅ entregue: criação no 1º nível, subida de nível, atributos, XP; ⏳ pendentes: criar em nível acima de 1, equipamento inicial da classe, escolha de magias no assistente, desfazer subida) | Criação guiada e subida de nível (incluindo talentos e incremento de atributo), métodos de atributos, XP e aviso de nível | G |
| 7 | **Tema visual completo** (✅ aplicado à ficha, ao compêndio e aos títulos; ⏳ pendentes: protótipo de design aprovado, ícones próprios de dano/condição, texturas, tema nas demais telas do site) | Tema D&D aplicado (medalhões, escudo, gemas, cartas de magia), modo compacto de combate no celular, animações e acessibilidade | M |
| 8 | **Integração com a mesa** (✅ entregue: painel do grupo, iniciativa ao vivo, histórico com origem, dano por campo; ⏳ ver `pendencias-ficha-dnd5e.md`) | Painel do mestre com fichas calculadas e resumo do grupo, iniciativa/PV na sessão ao vivo, histórico de rolagens com origem ("Aria — Bola de Fogo, salvaguarda CD 15") | M |

| 9 | **Multiclasse** (último tema) (✅ entregue o núcleo; ⏳ limites de magias por classe, dados de vida por tipo, ver `pendencias-ficha-dnd5e.md`) | Opção da mesa ligada pelo mestre nas configurações; níveis em várias classes, pré-requisitos, proficiências reduzidas, espaços pela tabela de conjurador multiclasse | M |

Ordem sugerida: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9**, com a 7 podendo começar em paralelo a partir da 2 (as cartas de magia já pedem o visual). As fases 1–2 dão o maior salto percebido (o "wow" do catálogo de magias) e destravam a 5 (condições/concentração).

## 9. Qualidade e testes

- **Testes golden por tabela do livro:** para cada classe e nível 1–20, `derivar()` deve reproduzir proficiência, truques, conhecidas/preparadas e espaços das tabelas dos `.md` (o próprio script do catálogo gera os casos esperados). Mesmo para multiclasse (exemplos do livro).
- **Testes de efeitos:** pilha de efeitos com casos nomeados (monge sem armadura, bárbaro com escudo, mago com Armadura Arcana, humano variante + talento).
- **Testes de migração:** fichas antigas e saída do `importarFichaPdf` → `normalizar` → mesmos números de antes (sem regressão visível).
- **Validação do catálogo:** script verifica unicidade de ids, referências cruzadas (magia ↔ classe, item ↔ pacote) e campos obrigatórios; falha o CI se quebrar.
- Teste manual em celular e nos dois temas ao fim de cada fase (checklist por fase).

## 10. Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| Parser dos `.md` erra casos (texto livre, typos, magias com variantes) | Saída revisada em diff; correções declaradas no script; validação cruzada com as listas por classe do próprio arquivo |
| Regra com muitas exceções (Dádiva, subclasses, itens) vira motor gigante | Cobrir só o **Livro do Jogador** primeiro; efeito "texto + override" como válvula de escape; sem tentar modelar 100% (o que não for modelável fica como texto e vira lembrete) |
| Licença do conteúdo | §4.4: decisão antes da Fase 1; catálogo atrás de interface |
| Tamanho do bundle / lentidão | Import dinâmico, JSON sem texto repetido, busca em memória; medir antes/depois |
| Regressão em fichas existentes | Migração só aditiva, testes de migração, flag `versaoFicha` no documento |
| Automação "tira a graça" de quem rola dado físico | Princípio 7: tudo opcional, sempre "informar o dado da mesa" |
| Documento do Firestore crescer (itens/efeitos) | Guardar ids e escolhas, não cópias do catálogo |
| Edição simultânea (jogador e mestre aplicando dano) | `useDocSincronizado` já existe; operações de dano/cura viram atualizações atômicas por campo, não regravar a ficha inteira (avaliar na Fase 5) |

## 11. Decisões tomadas

1. **Licença:** catálogo completo no repositório (§4.4).
2. **Escopo:** só Livro do Jogador agora; **espaço para extensão** por pacotes de conteúdo (extras oficiais e homebrew do mestre depois).
3. **Multiclasse e talentos:** opções **por mesa**, desligadas por padrão, ligadas pelo mestre nas configurações (`SistemaRegras.opcoes`). A multiclasse é o **último** tema (Fase 9).
4. **Rigor:** a ficha **bloqueia** o que as regras da mesa proíbem (`validar` + `bloqueia("jogador", ...)`); o **mestre pode editar** passando por cima (e a ficha fica marcada como "fora do livro").
5. **Visual:** seguir a recomendação (protótipo na Fase 0, aplicação gradual). Ampliação: avaliar levar a temática de RPG ao **site inteiro**, mantendo a identidade atual (tokens `--gold`, `--card`...), não só à ficha.
6. **Multi-sistema:** o motor é genérico (`src/lib/regras/`: efeitos, contrato `SistemaRegras`, registro por nome de sistema da mesa); D&D 5e é o primeiro módulo (`regras/dnd5e/`). Outros sistemas entram como novos módulos sem mexer no motor.

## 12. Critério de "pronto" da iniciativa

Um jogador novo cria um personagem completo de qualquer das 12 classes (níveis 1–20, com ou sem multiclasse) só escolhendo opções, sem digitar um número; todos os valores batem com o livro e mostram a origem; rola ataque/dano/magia/perícia com um clique (ou informa o dado físico); gasta espaços, recursos e concentração corretamente; descansa e o estado se recupera; o mestre vê e atua sobre as fichas; o visual é coeso, temático e usável no celular.
