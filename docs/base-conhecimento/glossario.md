# Glossário

| Termo | Significado |
|---|---|
| **Mesa** | A campanha. Unidade de tudo: jogadores, conteúdo e permissões vivem em `mesas/{id}`. |
| **Mestre** | Dono da mesa (`donoUid`). |
| **Jogador / membro** | Usuário em `membros` sem ser dono. |
| **Personagem** (`Jogador` no código) | Item de `mesa.jogadores[]`: nome, personagem, foto, `uid` de quem o controla. Pode existir sem `uid` (cadastrado pelo mestre, ainda não reivindicado). |
| **Código de convite** | Código curto que leva a uma mesa (`convites/{codigo}`). |
| **Visão do mestre / do jogador** | Dois "shells" com a mesma linguagem visual e navegações diferentes (`/mesas/{id}` × `/mesas/{id}/jogador`). |
| **Liberar** | O mestre torna um item visível para todos (`todos`) ou para jogadores específicos (`liberadoPara`). |
| **Ficha** | Registro com nome, foto e texto em Markdown. Categorias: `npc`, `inimigo`, `importante`, `item`. Do jogador (privada) ou do mestre (liberável). |
| **Etapa pendente** | Passo de missão ainda oculto. Só existe na visão completa do mestre. |
| **Mundo** | Lore da campanha em JSON validado (seções e blocos). |
| **Mapa** | Imagem exibida aos jogadores, com coberturas e zonas. |
| **Imagem (handout)** | Mesmo formato do mapa, rótulo diferente. |
| **Cobertura** | Polígono preto sobre o mapa que o mestre pode revelar; agrupado por **zona** (ex.: um cômodo). |
| **Pino** | Marcação privada do jogador num mapa. |
| **Cena** | Mapa editável em camadas e objetos (modelo `Cena`), com grid opcional. Pode ser renderizada para um mapa de imagem. |
| **Camada** | `terreno`, `caminhos`, `decals`, `objetos`, `rotulos`. |
| **Asset** | Peça reutilizável da biblioteca: `sprite`, `textura`, `pincel`, `decal`. |
| **Comando** | Mutação reversível da cena (`aplicar` devolve cena nova + comando inverso). Base do desfazer/refazer e da IA. |
| **Tema** | Perfil de estilo da mesa (descrição, paleta, regras, proibidos, imagens âncora). |
| **Perspectiva** | Ponto de vista do mapa (`topdown`, `isometrica`) com fragmento de prompt e imagem de exemplo. |
| **Provedor** | Integração de IA: `imagem`, `llm` ou `segmentacao`. Provedores do mesmo fabricante compartilham a credencial. |
| **Credencial** | Chave de API do mestre, cifrada no servidor. |
| **Teto** | Limite de gerações de IA por mesa e período (mensal). |
| **Job** | Geração de asset em andamento, acompanhada em tempo real. |
| **Agente** | LLM com ferramentas que propõe um plano de comandos para a cena; o mestre aprova passo a passo. |
| **Segmentação / inpainting** | Detectar objetos numa imagem / reconstruir o fundo sob eles (conversão de imagem em cena). |
| **VTT** | Mesa virtual (Roll20, Foundry…). Exportamos `.dd2vtt`/`.uvtt` (Universal VTT). |
| **Extensão** | Mini-app em HTML único, executado em iframe isolado. Criada com IA; instalada por mesa. |
| **Biblioteca (de extensões)** | Extensões do mestre, reaproveitáveis em várias mesas (`extensoes/{id}`). |
| **Manifesto** | Declara os **encaixes** de uma extensão. |
| **Permissão (de extensão)** | O que uma extensão pode ler (`ler:jogadores`, `ler:missoes`…). A extensão pede no manifesto; o mestre aprova ao publicar. |
| **Broker** | Intermediário no app que atende `RPG.ler`/`RPG.rolar` da extensão: valida, confere a permissão aprovada e lê com as credenciais de quem usa. |
| **Modo ensaio** | Prévia do criador com permissões simuladas e dados da mesa ou de exemplo. |
| **Encaixe (slot)** | Ponto do app onde uma extensão pode aparecer: `sidebar`, `diario.jogador`, `visao-geral`, `sessao.painel`, `ctrlk`. |
| **Extensão nativa** | Módulo React que o app entrega, exclusivo de certas mesas (hoje, Marcas de Pacto). O mestre pode ocultá-la dos jogadores. |
| **Marca (de Pacto)** | Poder/pacto de personagem em "O Juramento de Cinzas", com mecânica secreta. |
| **Enigma / puzzle** | Desafio por Marca que o mestre libera por etapas e avalia. |
| **Quadro** | Quadro de investigação do jogador (notas, textos, imagens e ligações). |
| **Diário** | Anotações privadas do jogador por sessão. |
| **Segredos** | Notas só do mestre (campanha, sessões, jogadores). |
| **Sessão** | Registro de um encontro: data, título, resumo público e nota secreta. |
| **Sessão ao vivo** | Modo "estou jogando agora" (dados, iniciativa, cronômetro, notas rápidas). |
| **Paleta de comandos** | Busca global Ctrl/⌘+K. |
| **`instant`** | Export do Next 16; `false` desliga a validação de navegação instantânea numa página. |
