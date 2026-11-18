## ADDED Requirements

### Requirement: Exportar imagem do mapa
O mestre SHALL poder exportar o render da cena em alta resolução, com ou sem grid.

#### Scenario: Exportar sem grid
- **WHEN** o mestre exporta sem grid
- **THEN** o arquivo baixado contém apenas a arte, sem linhas de grid

### Requirement: Exportar metadados para VTT
O sistema SHALL exportar um arquivo de metadados em formato Universal VTT com grid, paredes e luzes quando definidos.

#### Scenario: Mapa com paredes
- **WHEN** a cena tem camada de paredes e o mestre exporta para VTT
- **THEN** o arquivo inclui as paredes e a imagem com a resolução do grid

#### Scenario: Mapa sem paredes
- **WHEN** a cena não tem paredes
- **THEN** o arquivo é gerado apenas com imagem e grid
