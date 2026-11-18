## ADDED Requirements

### Requirement: Biblioteca por mesa
A mesa SHALL ter uma biblioteca de assets com tipo, tags, tema, perspectiva e origem.

#### Scenario: Buscar por tag
- **WHEN** o mestre busca "árvore" na paleta do editor
- **THEN** aparecem os assets com essa tag compatíveis com a perspectiva da cena

### Requirement: Reutilização antes de gerar
Antes de gerar, o sistema SHALL oferecer assets existentes que correspondam à descrição.

#### Scenario: Asset já existe
- **WHEN** o mestre pede "carvalho" e já há um asset com essa tag no mesmo tema
- **THEN** o sistema oferece reutilizá-lo ou gerar uma variação

### Requirement: Exclusão segura
Um asset em uso por alguma cena SHALL NOT ser excluído sem substituição.

#### Scenario: Excluir asset em uso
- **WHEN** o mestre tenta excluir um asset usado em 2 cenas
- **THEN** o sistema lista as cenas e pede um substituto ou cancela
