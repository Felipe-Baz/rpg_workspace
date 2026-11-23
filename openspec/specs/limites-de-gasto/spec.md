# limites-de-gasto

## Purpose

Ver change arquivada 04-provedores-ia-config.

## Requirements

### Requirement: Teto de gasto por mesa
O sistema SHALL aplicar um teto configurável de gerações por mesa e período.

#### Scenario: Teto atingido
- **WHEN** a mesa atinge o teto
- **THEN** novas gerações são recusadas com mensagem clara e opção de aumentar o teto

### Requirement: Estimativa antes de lote
Ações que geram várias imagens SHALL mostrar estimativa de quantidade e exigir confirmação.

#### Scenario: Lote de 20 imagens
- **WHEN** uma ação vai gerar 20 imagens
- **THEN** o mestre vê a estimativa e confirma antes de iniciar

### Requirement: Registro de uso
Cada geração SHALL ser registrada com provedor, tipo e data.

#### Scenario: Consultar uso
- **WHEN** o mestre abre o painel de uso
- **THEN** vê o total do período e por provedor
