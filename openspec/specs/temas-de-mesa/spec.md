# temas-de-mesa

## Purpose

Ver change arquivada 05-temas-e-perspectivas.

## Requirements

### Requirement: Criar tema com referências e texto
O mestre SHALL poder criar um tema enviando imagens de referência e um texto descritivo.

#### Scenario: Tema com análise por IA
- **WHEN** o mestre envia 3 referências e um texto e pede a análise
- **THEN** o sistema propõe um perfil de estilo (descrição, paleta, regras, termos proibidos) para revisão

#### Scenario: Tema sem IA
- **WHEN** nenhum provedor LLM está configurado
- **THEN** o mestre pode preencher o perfil manualmente e salvá-lo

### Requirement: Revisão antes de salvar
O perfil proposto pela IA SHALL ser editável e só persistir após confirmação do mestre.

#### Scenario: Editar proposta
- **WHEN** o mestre altera a descrição proposta e confirma
- **THEN** o tema é salvo com a versão editada

### Requirement: Vários temas por mesa
Uma mesa SHALL poder ter vários temas, e cada mapa de cena SHALL referenciar um deles.

#### Scenario: Escolher tema no mapa
- **WHEN** o mestre cria um mapa de cena e escolhe um tema
- **THEN** o mapa guarda o `temaId` e as próximas gerações usam esse perfil

### Requirement: Paleta extraída localmente
O sistema SHALL extrair a paleta das referências no cliente.

#### Scenario: Paleta exibida
- **WHEN** referências são enviadas
- **THEN** uma paleta de até 8 cores aparece mesmo sem chamar IA
