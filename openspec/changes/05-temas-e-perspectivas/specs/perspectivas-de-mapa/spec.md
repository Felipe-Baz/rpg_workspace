## ADDED Requirements

### Requirement: Registro de perspectivas
O sistema SHALL manter um registro de perspectivas, cada uma com id, nome, imagem de exemplo, fragmento de prompt, regra de ordenação e se permite grid.

#### Scenario: Adicionar perspectiva
- **WHEN** um desenvolvedor adiciona um arquivo de perspectiva, uma imagem de exemplo e uma linha ao registro
- **THEN** ela aparece no seletor sem outras mudanças

### Requirement: Seletor com exemplos
O seletor SHALL mostrar a imagem de exemplo de cada perspectiva disponível.

#### Scenario: Escolher perspectiva
- **WHEN** o mestre abre o seletor ao criar um cenário
- **THEN** vê cada perspectiva com sua imagem de exemplo e pode escolher qualquer uma

### Requirement: Grid sempre top-down
Mapas em modo grid SHALL usar a perspectiva top-down.

#### Scenario: Grid ignora escolha
- **WHEN** o mestre escolhe modo grid
- **THEN** a perspectiva fica fixa em top-down e o seletor não aparece

### Requirement: Ordenação conforme a perspectiva
O render SHALL ordenar objetos segundo a regra da perspectiva do mapa.

#### Scenario: Isométrica por Y
- **WHEN** dois objetos se sobrepõem em um mapa isométrico
- **THEN** o que tem maior Y é desenhado na frente

### Requirement: Troca de perspectiva protegida
A perspectiva SHALL NOT ser trocada depois que o mapa tem objetos.

#### Scenario: Tentar trocar
- **WHEN** o mestre tenta mudar a perspectiva de um mapa com objetos
- **THEN** a troca é recusada com explicação
