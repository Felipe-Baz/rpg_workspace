# provedores-ia

## Purpose

Ver change arquivada 04-provedores-ia-config.

## Requirements

### Requirement: Contrato de provedor
Todo provedor SHALL implementar a interface do seu tipo e declarar suas capacidades.

#### Scenario: Provedor conforme
- **WHEN** um provedor é executado na suíte de contrato
- **THEN** ele passa nos testes de campos, capacidades e tratamento de erro

### Requirement: Adicionar provedor com um arquivo
O sistema SHALL permitir adicionar um provedor criando um arquivo e registrando-o em uma linha, sem alterar UI ou núcleo.

#### Scenario: Novo provedor aparece
- **WHEN** um desenvolvedor adiciona um provedor ao registro
- **THEN** ele aparece na tela de configuração com seus campos, sem outras mudanças

### Requirement: Degradação por capacidade
O orquestrador SHALL compensar capacidades ausentes.

#### Scenario: Sem alfa nativo
- **WHEN** o provedor ativo não declara `alfaNativo`
- **THEN** o sprite gerado passa por remoção de fundo antes de ser salvo

#### Scenario: Sem imagens de referência
- **WHEN** o provedor não aceita imagens de referência
- **THEN** o perfil de estilo é enviado apenas como texto

### Requirement: Provedor inicial Google Gemini
O sistema SHALL incluir adaptadores de imagem e de LLM para o Google Gemini, usando uma única chave Google configurada pelo mestre, com o modelo escolhido pelo mestre.

#### Scenario: Uma chave para imagem e LLM
- **WHEN** o mestre configura a chave Google
- **THEN** os provedores de imagem e de LLM do Google ficam disponíveis com a mesma chave

#### Scenario: Escolher o modelo
- **WHEN** o mestre altera o campo `modelo` do provedor Google
- **THEN** as próximas gerações usam o modelo informado sem alteração de código

### Requirement: Remoção de fundo por chroma key
Quando o provedor não tem alfa nativo, o sistema SHALL gerar o sprite sobre fundo de cor-chave e remover essa cor localmente.

#### Scenario: Sprite recortado
- **WHEN** um sprite é gerado pelo Gemini
- **THEN** o resultado salvo tem canal alfa, sem a cor-chave visível nas bordas

#### Scenario: Cor-chave presente no objeto
- **WHEN** o objeto contém tons próximos da cor-chave
- **THEN** o sistema escolhe outra cor-chave para aquele asset

### Requirement: Cor-chave escolhida por asset
Antes de gerar um sprite, o sistema SHALL escolher a cor de fundo (cor-chave) em função das cores que o objeto terá: o LLM ativo lista a paleta do objeto e o sistema escolhe, entre as candidatas, a mais distante de todas elas. Sem LLM, ou se ele falhar, SHALL usar uma heurística por palavras-chave, sem bloquear a geração.

#### Scenario: Muro de pedra
- **WHEN** o asset é um muro de pedra (cinzas e marrons)
- **THEN** a cor-chave escolhida é magenta

#### Scenario: Canteiro de flores
- **WHEN** o asset é um canteiro com flores rosa, roxas e vermelhas
- **THEN** a cor-chave escolhida não é magenta nem vermelha (ex.: ciano) e as flores permanecem opacas após o recorte

#### Scenario: LLM indisponível
- **WHEN** a consulta ao LLM falha ou devolve paleta inválida
- **THEN** o sistema usa a heurística por palavras-chave e a geração prossegue

### Requirement: Provedor LLM da Anthropic
O sistema SHALL incluir um adaptador LLM da Anthropic (Claude Sonnet) com modelo configurável pelo mestre, usando a credencial `anthropic`.

#### Scenario: Agente com Claude e imagem com Gemini
- **WHEN** o mestre ativa Claude como LLM e Gemini como provedor de imagem
- **THEN** o agente conversa e chama ferramentas via Claude e os assets são gerados via Gemini

### Requirement: Ferramentas neutras traduzidas por adaptador
Cada provedor LLM SHALL converter o schema neutro de ferramentas para o formato do seu fornecedor e devolver chamadas no formato neutro.

#### Scenario: Mesma ferramenta, dois LLMs
- **WHEN** a ferramenta `colocar_objeto` é oferecida a um LLM Google e a um Anthropic
- **THEN** ambos produzem chamadas equivalentes no formato neutro, aceitas pela mesma validação
