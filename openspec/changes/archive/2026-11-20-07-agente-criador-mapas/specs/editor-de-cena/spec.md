## ADDED Requirements

### Requirement: Autoria dos comandos
Cada comando SHALL registrar se foi feito por humano ou pela IA, e o editor SHALL permitir destacar e reverter ações da IA.

#### Scenario: Reverter tudo da IA
- **WHEN** o mestre escolhe "reverter ações da IA nesta sessão"
- **THEN** apenas os comandos de autoria IA são desfeitos e os feitos à mão permanecem

### Requirement: Histórico agrupado em passos
O histórico do editor SHALL agrupar comandos de um mesmo passo da IA.

#### Scenario: Ver histórico
- **WHEN** o mestre abre o histórico
- **THEN** vê cada passo da IA como uma entrada única, expansível
