## ADDED Requirements

### Requirement: Cena referencia tema e perspectiva
Uma cena SHALL referenciar um `perspectivaId` registrado e, opcionalmente, um `temaId` existente na mesa.

#### Scenario: Tema removido em cascata
- **WHEN** o mestre exclui um tema referenciado por cenas e digita o nome do tema como confirmação
- **THEN** o tema, os mapas de cena que o usam (cena e render) e os assets do tema são apagados
- **AND** sem a digitação correta do nome a exclusão não é executada

#### Scenario: Cena sem tema
- **WHEN** a cena não tem `temaId`
- **THEN** ela continua editável manualmente, sem perfil de estilo aplicado

### Requirement: Paleta de assets filtrada por perspectiva
O editor SHALL listar apenas assets da perspectiva da cena.

#### Scenario: Asset de outra perspectiva
- **WHEN** o mestre abre a paleta de uma cena top-down
- **THEN** assets isométricos não aparecem
