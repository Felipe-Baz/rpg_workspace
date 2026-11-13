# Spec: Site de Marcas de Pacto — "O Juramento de Cinzas"

## Contexto

Site de apoio para uma mesa de RPG de dark fantasy (D&D 5e, tom Berserk/The Witcher) chamada **"O Juramento de Cinzas"**. Os jogadores interpretam **Marcados**: personagens que venderam algo de si em troca de uma **Marca de Pacto**. Existem **20 Marcas** pré-definidas (lore completa anexada abaixo), cada uma com: o que foi vendido, uma Passiva, um Fardo, uma Habilidade ativa, um build-alvo, uma progressão de 9 estágios ("Os Nove Círculos") e um puzzle de Remoção.

Ponto central de design do RPG: **o jogador nunca deve receber a mecânica da própria Marca de bandeja**. Ele descobre a Passiva, o Fardo, a Habilidade e os estágios através de role-play em sessão — nunca por explicação direta do Mestre. O site existe para dar suporte a essa descoberta gradual, não para entregá-la.

Usuários do site: **1 Mestre** e **N jogadores** (hoje 5, mas deve suportar qualquer número).

## Objetivo do site

1. O Mestre atribui uma das 20 Marcas a cada jogador.
2. Cada Marca atribuída só é visível a **duas pessoas**: o jogador que a possui e o Mestre. Nenhum outro jogador pode ver qual Marca um colega tem, nem o conteúdo das anotações dele.
3. A tela do jogador mostra a "foto"/ícone da sua Marca e dá a ele um espaço para:
   - escrever **post-its** livres (pistas, teorias, coisas que ouviu em jogo);
   - preencher campos estruturados e guiados — **Passiva**, **Fardo**, **Habilidade** — com o que ele mesmo já concluiu/descobriu em jogo. Esses campos começam **vazios**: o site nunca pré-popula a resposta certa, só guia o jogador a registrar o que ele descobriu.
4. O Mestre tem um painel para:
   - atribuir/trocar a Marca de cada jogador;
   - consultar, só para si, a lore completa e "correta" de qualquer Marca (a resposta real — Passiva, Fardo, Habilidade, tabela dos Nove Círculos, Remoção), como gabarito de mestre;
   - acompanhar o que cada jogador já anotou (para calibrar o ritmo da campanha), sem que isso seja visível a outros jogadores.

## Requisitos funcionais

### Visão do Mestre
- Lista/cadastro dos jogadores que já acessaram o site (nome resolvido pela conta deles).
- Para cada jogador: seletor para atribuir uma das 20 Marcas (ou remover a atribuição).
- Grade com as 20 Marcas, mostrando ícone, nome, build-alvo e **a quem está atribuída** (se a ninguém, dizer isso claramente).
- Ao clicar numa Marca, expandir um "gabarito" só-Mestre com: o que foi vendido, Passiva (nome + texto), Fardo, Habilidade (nome + texto), tabela completa dos Nove Círculos (coluna Círculo / Gatilho / O que muda) e o puzzle de Remoção. Esse conteúdo **nunca** pode estar acessível a um jogador, nem mesmo inspecionando o código-fonte da página.
- Para cada jogador com Marca atribuída, visão somente-leitura do que ele anotou: Passiva/Fardo/Habilidade (como ele mesmo descreveu), palpite de em qual Círculo ele acha que está, e a lista de post-its.

### Visão do jogador
- Se ainda não tem Marca atribuída: mensagem de espera, nada mais.
- Se tem Marca atribuída:
  - Ícone/imagem da Marca + nome da Marca + frase "o que você vendeu" + tag do build-alvo. (Esses quatro dados **podem** aparecer de cara: são lore de personagem, não spoiler de mecânica.)
  - Um seletor "em qual Círculo você acredita que está" — é só o palpite do próprio jogador, puramente para ele se situar narrativamente; não é a verdade mecânica controlada pelo Mestre.
  - Três campos de texto livre, claramente rotulados **Passiva**, **Fardo**, **Habilidade**, vazios por padrão, com uma dica de uma linha em cada (ex.: "o efeito constante que você sente sempre ativo") — o jogador preenche com o que ele mesmo concluiu jogando.
  - Um mural de **post-its**: cartões de nota livre, pode adicionar, editar e remover, cada um independente.
  - Tudo deve salvar automaticamente (sem botão "salvar" obrigatório), com algum feedback discreto de que salvou.
- Um jogador nunca deve conseguir ver a Marca, as anotações ou os post-its de outro jogador — nem por navegação na UI, nem inspecionando chamadas de rede/código. Isso precisa ser garantido por regra de acesso no nível dos dados, não só escondido na interface.

## Modelo de dados

Quatro coleções, uma linha (documento) por jogador em três delas:

- `players/{userId}` — registro de quem já abriu o site (criado pelo próprio jogador ao entrar). `{ joinedAt }`
- `assignments/{userId}` — a Marca atribuída a esse jogador. Só o Mestre escreve. `{ markId, assignedAt }`
- `notes/{userId}` — as anotações desse jogador. Jogador lê/escreve a própria; Mestre lê todas (read-only). `{ passiva, fardo, habilidade, circleGuess, postits: [{ text }], updatedAt }`
- `lore/{markId}` — gabarito completo de cada uma das 20 Marcas, só-Mestre (leitura e escrita). `{ sold, passivaNome, passiva, fardo, habilidadeNome, habilidade, circles: [{ circulo, gatilho, mudanca }] (9 linhas), remocao }`

### Regra de acesso (resumo da intenção, não de uma sintaxe específica)

| Coleção | Leitura padrão | Exceção |
|---|---|---|
| `players` | só Mestre | — |
| `players/{self}` | só Mestre | o próprio jogador pode **ler e criar** seu próprio registro |
| `assignments` | só Mestre | — |
| `assignments/{self}` | só Mestre | o próprio jogador pode **ler** (não escrever) sua própria atribuição |
| `notes` | só Mestre (leitura e escrita, para poder supervisionar) | — |
| `notes/{self}` | só Mestre | o próprio jogador pode **ler e escrever** suas próprias notas |
| `lore` | só Mestre, leitura e escrita | nenhuma exceção — nunca enviado ao cliente/jogador |

Ponto crítico: o conteúdo de `lore` (a mecânica real de cada Marca) **não pode** ser embutido no código/HTML/JS que todo mundo baixa — precisa viver atrás de uma barreira de permissão do lado do servidor, só lida pelo Mestre. Dados de lore não-spoiler (nome da Marca, "o que foi vendido", build-alvo, ícone) podem estar no código, pois são visíveis a qualquer jogador por design.

## Dados de referência (não-spoiler, podem ir no código)

20 Marcas, cada uma com `id`, `name`, `sold` ("o que foi vendido") e `build` (build-alvo):

1. `eco-vazio` — Marca do Eco Vazio — "a dor e o medo — os primeiros avisos de que um corpo está em perigo." — Marcial de linha de frente / tanque
2. `maos-que-lembram` — Marca das Mãos que Lembram — "a memória contínua de rostos, nomes e do próprio passado." — Perícia e versatilidade social
3. `sangue-que-nega` — Marca do Sangue que Nega — "a conexão com a vida — cicatrização natural e aceitação instintiva de criaturas vivas." — Combate sustentado sem suporte de cura
4. `voz-perdida` — Marca da Voz Perdida — "o próprio nome verdadeiro e a liberdade de mentir." — Face / social
5. `reflexo-partido` — Marca do Reflexo Partido — "a própria imagem — o reconhecimento contínuo de que existe para o mundo." — Furtivo / infiltração
6. `juramento-cinzento` — Marca do Juramento Cinzento — "a possibilidade de ser perdoado por uma convicção pessoal quebrada." — Convicção / zelote
7. `segundo-pacto` — Marca do Segundo Pacto — "a autonomia da própria vontade dentro de qualquer poder emprestado." — Caster de fonte externa
8. `pagina-que-esquece` — Marca da Página que Esquece — "a confiabilidade da própria mente como ferramenta de aprendizado e registro." — Conhecimento e utilidade
9. `sono-roubado` — Marca do Sono Roubado — "o sono tranquilo e os sonhos como refúgio." — Suporte / vidência
10. `fome-eterna` — Marca da Fome Eterna — "a saciedade — a sensação de 'já basta'." — Força bruta / burst de dano
11. `coracao-de-ferro` — Marca do Coração de Ferro — "a capacidade de se apegar emocionalmente a alguém novo." — Resistência mental / estoico
12. `maos-manchadas` — Marca das Mãos Manchadas — "a inocência — não carregar visivelmente o peso do que fez." — Dano concentrado / assassino
13. `tempo-perdido` — Marca do Tempo Perdido — "a percepção linear e confiável do tempo." — Controle / tática
14. `fera-interior` — Marca da Fera Interior — "o controle total sobre os próprios instintos mais básicos." — Primal / natureza
15. `silencio-divino` — Marca do Silêncio Divino — "a capacidade de ser ouvido por qualquer força divina." — Divino / anti-divino
16. `sombra-viva` — Marca da Sombra Viva — "o controle total sobre a própria sombra, que ganhou vontade parcial." — Reconhecimento / batedor
17. `preco-justo` — Marca do Preço Justo — "o senso de 'o suficiente' — a capacidade de recusar uma barganha vantajosa." — Negociação / suporte de grupo
18. `pele-de-vidro` — Marca da Pele de Vidro — "a confiabilidade da própria resistência física." — Dano concentrado / demolição
19. `ultimo-suspiro` — Marca do Último Suspiro — "a certeza de uma morte natural." — Morte / necromancia
20. `coro-silencioso` — Marca do Coro Silencioso — "a solidão da própria alma." — Suporte de grupo

Os nomes de estágio para o seletor de "palpite de Círculo" do jogador (puramente de sabor, 0 = ainda não despertou):
`Ainda não despertou, I — Limbo, II — Luxúria, III — Gula, IV — Avareza, V — Ira, VI — Heresia, VII — Violência, VIII — Fraude, IX — Traição`

O conteúdo completo de cada Marca (Passiva, Fardo, Habilidade, as 9 linhas de gatilho/mudança, e o puzzle de Remoção) está no documento-fonte do projeto `claude/as-cinco-marcas.md` e deve ser carregado para a coleção `lore/{markId}` — nunca para o código-fonte do site.

## Ícone/imagem da Marca

Não existem artes prontas. Gerar um **símbolo/sigilo original** por Marca (SVG simples, abstrato — círculos, raios, pequenas formas nas pontas) derivado de forma determinística do índice da Marca, para que cada uma tenha uma aparência visualmente distinta e consistente, sem depender de imagens externas (a página não pode carregar imagens remotas).

## Estilo visual

Dark fantasy — paleta escura (quase preto), tons de cinza/osso, vermelho sangue como destaque, dourado envelhecido para elementos de hierarquia (ex.: nomes de seção, tags). Tipografia de exibição gótica/serifada (ex. Cinzel) para títulos, serifada legível (ex. EB Garamond) para corpo de texto. Nada de clichê genérico (sem gradiente roxo-azul, sem "dark mode" neutro sem personalidade).

## Critérios de aceite

- [ ] Mestre consegue atribuir e trocar a Marca de qualquer jogador.
- [ ] Um jogador comum só vê a própria Marca; nunca a de outro jogador, nem por UI nem inspecionando a aplicação.
- [ ] Os campos Passiva/Fardo/Habilidade do jogador começam vazios e são preenchidos manualmente por ele — o sistema nunca revela a resposta correta a um jogador.
- [ ] Mestre tem acesso a um "gabarito" completo de qualquer Marca (lore real + Nove Círculos + Remoção), que não é acessível a jogadores.
- [ ] Jogador consegue criar, editar e remover post-its livremente, e tudo persiste entre sessões/recarregamentos.
- [ ] Mudanças salvam automaticamente, sem perder dados ao atualizar a página.
- [ ] Visual coerente com o tom dark fantasy da campanha, com ícone/sigilo único por Marca.

## Observação de implementação

Este site se encaixa bem como uma aplicação de página única com um backend simples de documentos (uma linha por jogador/Marca) e controle de acesso por linha (cada jogador só lê/escreve a própria linha; o Mestre lê/escreve tudo). Qualquer stack que suporte isso serve — o requisito não-negociável é o **isolamento de dados por jogador** e a separação entre dado público de personagem (nome da Marca, "o que foi vendido", build) e dado de mestre (mecânica real, Nove Círculos, Remoção).
