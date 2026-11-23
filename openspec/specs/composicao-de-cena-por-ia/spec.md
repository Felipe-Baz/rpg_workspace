# composicao-de-cena-por-ia

## Purpose

Ver change arquivada 07-agente-criador-mapas.

## Requirements

### Requirement: Gerar mapa completo em grid
Dado um pedido textual e dimensões em células, o agente SHALL compor um mapa em grid com objetos alinhados ao grid.

#### Scenario: Taverna 30x20
- **WHEN** o mestre pede "taverna de beira de estrada, 30x20, com lareira"
- **THEN** a cena criada tem grid 30x20, paredes e objetos alinhados às células, no tema da mesa

### Requirement: Gerar cenário
O agente SHALL compor cenários na perspectiva do mapa, respeitando a ordenação da perspectiva.

#### Scenario: Floresta isométrica
- **WHEN** o mestre pede uma clareira em um mapa isométrico
- **THEN** os objetos são ordenados conforme a regra isométrica

### Requirement: Edição pontual sem refazer o mapa
Pedidos de ajuste SHALL alterar apenas os objetos afetados.

#### Scenario: Remover mesas do canto
- **WHEN** o mestre pede "tire as mesas do canto sul"
- **THEN** só as mesas daquela região são removidas e o resto da cena permanece idêntico

### Requirement: Consistência de estilo
Todos os assets usados SHALL pertencer ao tema da cena ou ser gerados com o perfil dele.

#### Scenario: Asset de outro tema
- **WHEN** o agente busca assets para a cena
- **THEN** não usa assets de outro tema sem aviso explícito ao mestre
