## ADDED Requirements

### Requirement: Cena referencia tema e perspectiva
Uma cena SHALL referenciar um `perspectivaId` registrado e, opcionalmente, um `temaId` existente na mesa.

#### Scenario: Tema removido
- **WHEN** um tema referenciado por uma cena é excluído
- **THEN** a exclusão é recusada enquanto houver mapas que o usam

#### Scenario: Cena sem tema
- **WHEN** a cena não tem `temaId`
- **THEN** ela continua editável manualmente, sem perfil de estilo aplicado

### Requirement: Paleta de assets filtrada por perspectiva
O editor SHALL listar apenas assets da perspectiva da cena.

#### Scenario: Asset de outra perspectiva
- **WHEN** o mestre abre a paleta de uma cena top-down
- **THEN** assets isométricos não aparecem
