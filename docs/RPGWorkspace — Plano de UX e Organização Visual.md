# RPGWorkspace — Plano de UX e Organização Visual

Nov 23, 2026 · @felipe

## O que o World Anvil faz bem (e vale copiar)

A aba que você tem aberta (editor de mapa) mostra um padrão clássico de **workspace de criador**, não de site institucional — e é esse o padrão certo para o RPGWorkspace também. Três camadas se destacam:

1. **Sidebar esquerda fixa e escura, organizada por tipo de conteúdo** — Articles & World, Maps, Timelines, Manuscripts, Statblocks, Images, Secrets, Advanced Tools, World Configuration. Cada módulo é uma seção de primeiro nível, com ícone + rótulo, e a sidebar é colapsável (ícone "«" no rodapé). Isso funciona porque o mestre pensa em *tipos de ferramenta*, não em hierarquia de páginas.
2. **Canvas central full-bleed com painéis flutuantes contextuais** — o mapa ocupa 100% da área útil; não há "página" ao redor dele. Ferramentas aparecem como painéis sobrepostos: um menu de abas no topo (MAP / MARKERS / MARKER GROUPS / LAYERS / MAP SETTINGS) muda o que é editável, uma barra inferior traz as ferramentas de desenho (pino, texto, linha, círculo, polígono, camadas, lista), e os controles de zoom ficam presos no canto. Nada disso rouba espaço do conteúdo.
3. **Rail direita de ações utilitárias, separada do conteúdo** — notificações, biblioteca, modo desenvolvedor, segredos, grupo/jogadores, notas, ajuda, e um bloco de ações rápidas coloridas (check verde, nota laranja, ferramenta azul, "+" cinza) na parte de baixo. É a camada de "coisas que eu preciso em qualquer tela", separada da navegação principal.

Outros acertos: paleta escura de alto contraste (quase preto) com um único acento de cor por ação (vermelho para upgrade/CTA pago, azul para seleção ativa), hierarquia tipográfica simples (tudo caixa alta e peso médio nos rótulos de navegação, sem ruído visual), e presença de "Campaign" e "Storyteller Screen" como atalhos fixos abaixo da navegação principal — ou seja, as ações mais usadas *durante* uma sessão de jogo ficam sempre visíveis, não enterradas em um menu.

O ponto fraco a não copiar: a IA de informação do World Anvil cresceu organicamente e hoje mistura categorias de conteúdo (Maps, Timelines) com categorias de produto (Secrets, Advanced Tools, World Configuration) no mesmo nível — isso fica confuso conforme mais módulos são adicionados. O RPGWorkspace deve separar esses dois eixos desde o início.

## Princípios de design para o RPGWorkspace

1. **Dois eixos de navegação, nunca misturados.** Eixo A = *onde estou* (Minhas Mesas → uma Mesa específica). Eixo B = *qual ferramenta estou usando dentro da mesa* (Mapas, Artigos, Fichas, Extensões...). O World Anvil mistura os dois; o RPGWorkspace separa: trocar de mesa nunca deveria estar no mesmo menu que trocar de ferramenta.
2. **O canvas é o produto, o chrome é coadjuvante.** Mapa, artigo ou ficha ocupam a tela inteira; sidebar, barras de ferramentas e painéis contextuais flutuam por cima e podem ser recolhidos. Nenhuma ferramenta deveria "roubar" uma página inteira só para mostrar suas próprias opções.
3. **Extensões são cidadãs de primeira classe, não um plugin escondido.** Como o RPGWorkspace promete extensibilidade via IA como diferencial central, uma extensão ativa deve aparecer na mesma sidebar das ferramentas nativas (Mapas, Artigos...), com o mesmo peso visual — talvez com uma etiqueta discreta "Extensão" — em vez de ficar num submenu "Add-ons".
4. **Mestre e jogador compartilham o motor visual, não a tela.** Mesma linguagem de componentes (cores, tipografia, cards, botões) para manter consistência de marca, mas a IA de informação do jogador é radicalmente mais enxuta: ele não precisa ver 10 ferramentas de mestre, só as que o mestre liberou.
5. **Estado da mesa (ativa / inativa / planejamento) é informação de primeira linha, não um filtro escondido.** Com N mesas ativas e N inativas por mestre, o dashboard precisa comunicar status num relance (cor, badge, agrupamento), porque é a decisão mais comum do mestre ao abrir o produto: "qual mesa eu abro hoje?".
6. **Progressive disclosure para um produto que vai crescer.** Hoje são poucas ferramentas (mapas, artigos); no futuro serão quase todas as do World Anvil. A sidebar precisa suportar agrupamento por categoria (Mundo, Jogo, Mesa, Extensões) desde a v1, mesmo com poucos itens, para não precisar de redesign quando a lista crescer.
7. **A criação de extensões é um fluxo conversacional, não um formulário.** Como é feita "junto com a IA", a UI deve lembrar um chat/editor lado a lado (like Claude Artifacts ou v0), não uma tela de configuração de plugin tradicional.

## Arquitetura de informação e fluxo de entrada

&#91;embedded content: fluxo de entrada · 8 telas, 2 rotas convergentes\]

Os dois fluxos pedidos (cadastro e login) são, na prática, o mesmo fluxo com uma bifurcação no início: quem nunca usou o produto cria conta e, na sequência, cria sua primeira mesa (não há "mesa vazia" — o cadastro da mesa é parte do onboarding); quem já tem conta faz login e escolhe uma mesa existente. A partir daí, mestre e extensões vivem dentro do mesmo nível de navegação — ferramentas nativas e extensões criadas com IA são duas saídas irmãs do mesmo workspace, nunca telas separadas.

## Passo a passo dos dois fluxos

| Etapa | Tela | Ação do usuário | O que o sistema mostra |
| --- | --- | --- | --- |
| 1 | Landing Page | Clica em "Começar" ou "Entrar" | Hero com proposta de valor ("engine para RPG de mesa"), prova social, CTA duplo |
| 2a | Cadastro | Preenche nome, e-mail, senha (ou OAuth Google/Discord) | Formulário curto, sem perguntar ainda se é mestre ou jogador |
| 2b | Login | E-mail + senha ou OAuth | Formulário curto, link "esqueci minha senha" |
| 3 | Cadastro da mesa *(só no fluxo novo)* | Nome da mesa, sistema de jogo (D&D, Tormenta, genérico...), privacidade | Wizard de 1 tela só, com valores padrão sensatos — o usuário deve conseguir pular quase tudo e editar depois |
| 4 | Dashboard de mesas *(só no fluxo recorrente)* | Escolhe uma mesa ativa, inativa ou em planejamento | Grid de cards de mesa agrupados por status |
| 5 | Workspace da mesa | Escolhe uma ferramenta na sidebar (Mapas, Artigos...) ou abre Extensões | Canvas central muda de acordo com a ferramenta; sidebar e painéis contextuais permanecem |

Dois detalhes de fluxo que vale decidir cedo:

- **O cadastro não pergunta "você é mestre ou jogador?" antes da hora.** Todo usuário cadastrado é potencialmente mestre (cria mesas) e jogador (entra em mesas de outros) ao mesmo tempo — o papel é definido por mesa, não por conta. Isso evita um fork de onboarding desnecessário.
- **Entrar numa mesa como jogador é um fluxo paralelo e mais curto**, acionado por convite (link ou código), não pelo "Cadastro da mesa": Landing/Login → aceitar convite → cai direto na Visão do Jogador daquela mesa.

## Dashboard de Mesas do Mestre

Essa é a tela de abertura de todo usuário recorrente, então ela precisa responder "qual mesa eu abro?" sem exigir leitura. Um mestre pode ter N mesas ativas e N inativas ou em planejamento ao mesmo tempo — o status é a informação mais importante do card, não um detalhe.

| Região | Conteúdo | Comportamento |
| --- | --- | --- |
| Topo | Nome do usuário, avatar, busca de mesas, botão "+ Nova mesa" | Busca filtra por nome da mesa ou sistema de jogo em tempo real |
| Abas de status | "Ativas" (padrão), "Em planejamento", "Inativas/Arquivadas" | Contagem num badge em cada aba; "Ativas" sempre abre primeiro |
| Grid de cards (mesa) | Capa/ilustração da mesa, nome, sistema de jogo, nº de jogadores, última sessão ("há 3 dias") | Clique abre direto no Workspace da Mesa; menu de contexto (…) permite arquivar, duplicar, convidar jogadores |
| Card de mesa — cor do status | Ativa = acento de cor viva na borda; Em planejamento = borda tracejada; Inativa = card esmaecido/monocromático | O olho distingue os três grupos mesmo sem ler o texto |
| Sidebar lateral (opcional, se N mesas for grande) | Atalho "Minhas mesas" / "Mesas que jogo" | Separa claramente o papél de mestre do papél de jogador dentro do mesmo dashboard |

Se o usuário também é jogador em mesas de outros mestres, essas mesas aparecem numa seção ou aba separada ("Mesas que eu jogo") — nunca misturadas com as mesas que ele mestra, porque o card de jogador tem menos ações (sem arquivar, sem configurar) e abre a Visão do Jogador, não o Workspace do Mestre.

## Workspace da Mesa — a tela onde o mestre vive

Aqui é onde o padrão do World Anvil se aplica quase 1:1: sidebar fixa + canvas full-bleed + painéis contextuais flutuantes. A diferença principal é agrupar a sidebar em categorias desde a v1, para o RPGWorkspace crescer sem precisar reorganizar tudo depois.

| Região | Conteúdo | Comportamento |
| --- | --- | --- |
| Cabeçalho da sidebar | Nome da mesa + seletor rápido (∨) para trocar de mesa sem voltar ao dashboard | Clicar no seletor abre uma lista curta das outras mesas ativas, não o dashboard inteiro |
| Sidebar — grupo "Mundo" | Artigos, Mapas, Linha do Tempo, Imagens | Ferramentas de construção de conteúdo, usadas fora da sessão |
| Sidebar — grupo "Jogo" | Fichas/Statblocks, Segredos, Manuscritos | Ferramentas de regras e preparação |
| Sidebar — grupo "Extensões" | Extensões ativas da mesa, com etiqueta discreta "Extensão" + ícone próprio; "+ Criar extensão" sempre no fim do grupo | Mesmo peso visual das ferramentas nativas — não é um apêndice |
| Rodapé da sidebar | Configurações da mesa, convidar jogadores, colapsar sidebar | Fixo, sempre visível, separado visualmente do restante |
| Canvas central | Conteúdo da ferramenta ativa (mapa, editor de artigo, ficha...) | Ocupa 100% do espaço disponível; nunca compartilha a tela com uma segunda ferramenta |
| Barra/painéis contextuais sobre o canvas | Abas específicas da ferramenta (ex.: no editor de mapa: Mapa / Marcadores / Camadas) | Flutuante, recolhível, nunca empurra o canvas — sobrepõe com leve blur/sombra |
| Atalho fixo "Tela do Mestre" (storyteller screen) | Painel rápido com o que o mestre mais usa durante a sessão ao vivo (iniciativa, rolagens, notas da sessão) | Fica fora da navegação principal, como um botão de destaque — é o modo "estou jogando agora", diferente do modo "estou preparando" |

Uma decisão de IA de informação importante: o seletor de mesa (trocar de mesa) e o menu de ferramentas (trocar de módulo) precisam ficar visualmente separados — o primeiro no cabeçalho, o segundo no corpo da sidebar — para que o usuário nunca confunda "estou mudando de ferramenta" com "estou mudando de mesa".

## Criação de Extensões com IA

É o diferencial competitivo do produto, então merece uma tela própria — não um modal de configuração. O padrão certo é "chat + preview lado a lado" (como Claude Artifacts ou v0), porque o mestre está descrevendo uma necessidade em linguagem natural ("quero uma ferramenta de gerador de tesouro aleatório pro meu sistema caseiro") e precisa ver o resultado tomando forma:

1. **Entrada** — mestre clica em "+ Criar extensão" no grupo Extensões da sidebar. Abre uma tela dedicada (não um modal pequeno) dividida em duas colunas.
2. **Coluna esquerda — conversa com a IA** — chat onde o mestre descreve o que quer; a IA faz perguntas de escopo quando necessário ("isso deve salvar dados por mesa ou só gerar na hora?").
3. **Coluna direita — preview ao vivo** — a extensão sendo construêda renderiza em tempo real, já utilizável para testar enquanto é editada (igual a testar um formulário antes de publicá-lo).
4. **Publicar na mesa** — botão explícito que adiciona a extensão à sidebar daquela mesa especificamente (extensões são por mesa, não globais, a menos que o mestre escolha "reaproveitar em outra mesa").
5. **Gestão** — uma tela "Minhas extensões" (acessível pelo rodapé da sidebar ou pelo perfil) lista tudo que o mestre já criou, com botão "usar em outra mesa", editar ou arquivar.

Essa conversa de criação pode (e deve) ficar separada visualmente do chat de jogo/sessão, se um dia existir um — são dois contextos de IA diferentes (criar ferramenta vs. jogar a mesa) e não devem compartilhar a mesma interface para não confundir o usuário sobre o que está sendo "salvo" em cada conversa.

## Visão do Jogador

Mesmo motor visual (cores, tipografia, componentes), I.A. muito mais enxuta. O jogador não precisa — e não deve — ver as ferramentas de construção do mestre; ele vê o que foi liberado e um espaço próprio de anotações.

| Aspecto | Visão do Mestre | Visão do Jogador |
| --- | --- | --- |
| Sidebar | Todas as ferramentas + extensões, agrupadas | Só o que o mestre marcou como "visível para jogadores" (artigos, mapas liberados) |
| Edição de conteúdo do mundo | Pode criar/editar qualquer artigo, mapa, ficha | Somente leitura nesse conteúdo |
| Anotações | Não aplicável (ele edita o conteúdo original) | Camada própria de notas pessoais sobre qualquer artigo/mapa — privada, só o jogador vê as suas |
| Segredos | Vê tudo, inclusive o que está marcado como segredo | Nunca vê conteúdo marcado como segredo, mesmo que o artigo relacionado esteja visível |
| Extensões | Cria e gerencia | Usa apenas as que o mestre publicou e marcou como disponíveis para jogadores (se a extensão tiver essa opção) |
| Dashboard inicial | Mesas que mestra, agrupadas por status | Mesas em que é jogador, sem conceito de "em planejamento/inativa" controlado por ele |

Na prática isso significa duas rotas de componente para a mesma ferramenta: um "Artigo" renderizado para o mestre mostra botões de editar e um indicador de segredo; o mesmo artigo para o jogador mostra só o conteúdo público e um botão "+ Adicionar minha anotação". Vale desenhar esses dois estados do mesmo componente desde o início, em vez de criar duas telas totalmente separadas — isso mantém a consistência visual e reduz retrabalho conforme novas ferramentas forem adicionadas.

## Sistema visual

**Cor.** Base escura de alto contraste (o World Anvil acerta nisso: um workspace de criador é usado por horas seguidas, então fadiga visual importa mais que em um site institucional). Sugestão de paleta:

- Fundo base: quase preto com leve matiz (não preto puro, que é cansativo) — ex.: `#15131a` a `#1c1a22`.
- Superfícies elevadas (sidebar, painéis): um tom acima do fundo, ex.: `#211e28`.
- Um único acento primário para ação/seleção ativa — algo que remeta a fantasia/RPG sem ser genérico (âmbar queimado ou roxo arcano funcionam melhor que o azul SaaS padrão, que já está saturado na categoria).
- Cor semantica separada do acento de marca: verde para "ativa", cinza para "inativa", tracejado/amarelo para "em planejamento" nos cards de mesa.
- Extensões criadas por IA podem levar uma cor de destaque própria e discreta (não o mesmo acento das ferramentas nativas), para o mestre identificar de relance o que é "da casa" vs. "customizado" sem precisar ler o rótulo.

**Tipografia.** Uma só família sans-serif para UI (legível em telas por horas); se quiser personalidade temática, reservar uma serif/display só para títulos de artigos/mundo (nomes de reinos, capítulos), nunca na navegação ou em botões — rótulos de UI devem ser lidos instantaneamente, não "saboreados".

**Grid e componentes.** Sidebar fixa (\~240–280px, colapsável para ícones), canvas fluido, painéis contextuais com largura fixa (\~320–360px) flutuando sobre o canvas com leve sombra/blur para indicar que estão "por cima", não no mesmo plano. Cards de mesa em grid responsivo (3–4 colunas em desktop, empilhando em telas menores). Botões e controles com cantos arredondados moderados (8–10px) — suave o suficiente para não parecer corporativo, reto o suficiente para não parecer infantil.

**Densidade.** Dashboard e telas de configuração podem ser mais espaçadas (o mestre está decidindo, não executando); o workspace de ferramenta (mapas, fichas) deve ser denso e eficiente, porque ali o mestre está produzindo conteúdo por longos períodos.

## Recomendações finais

1. Comece o MVP já com a sidebar agrupada por categoria (Mundo / Jogo / Extensões), mesmo com 1–2 itens por grupo — é mais barato agrupar cedo do que reorganizar depois de 15 ferramentas.
2. Prototipe primeiro o Workspace da Mesa e o fluxo de criação de Extensões — são as duas telas onde o produto se diferencia; Landing Page e Cadastro podem usar padrões genéricos de SaaS sem risco.
3. Defina o componente "Artigo"/"Mapa" com os dois estados (mestre/jogador) desde o design inicial, não como refatoração posterior.
4. Valide a paleta de cores em sessão longa (2h+) simulada — é fácil aprovar uma paleta escura em 5 minutos de demo e descobrir fadiga visual só depois de uso real.
5. Trate "mesa em planejamento" como estado de primeira classe desde o schema de dados, não como um filtro de UI em cima de um único status binário ativa/inativa — isso evita retrabalho quando o dashboard crescer.
