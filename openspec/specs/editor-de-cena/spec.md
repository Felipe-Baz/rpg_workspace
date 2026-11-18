# editor-de-cena

## Purpose

Ver change arquivada 03-mapas-cena-editor-manual.

## Requirements

### Requirement: Escolha do tipo de mapa
Ao criar um mapa, o mestre SHALL poder escolher entre "Imagem" (fluxo atual) e "Cena".

#### Scenario: Criar mapa de imagem
- **WHEN** o mestre escolhe "Imagem" e envia um arquivo
- **THEN** o mapa é criado exatamente como hoje

#### Scenario: Criar mapa de cena
- **WHEN** o mestre escolhe "Cena", define nome, modo e tamanho
- **THEN** o editor abre com uma cena vazia e o mapa aparece na lista com indicação de "Cena"

### Requirement: Edição de camadas e objetos
O editor SHALL permitir adicionar, selecionar, mover, redimensionar, rotacionar, espelhar, duplicar e remover objetos, e reordenar, ocultar e travar camadas.

#### Scenario: Camada travada
- **WHEN** uma camada está travada
- **THEN** seus objetos não podem ser selecionados nem alterados

### Requirement: Assets enviados pelo mestre
O editor SHALL permitir enviar PNGs com transparência e usá-los como carimbo.

#### Scenario: Carimbar asset
- **WHEN** o mestre escolhe um asset e clica no canvas
- **THEN** um objeto é criado naquele ponto, com snap quando o grid está ativo

### Requirement: Salvar e renderizar
Ao salvar, o sistema SHALL persistir a cena e atualizar `Mapa.imagem` com o render, mantendo a proporção.

#### Scenario: Salvar
- **WHEN** o mestre salva a cena
- **THEN** `Mapa.imagem` aponta para o novo render e a cena é reaberta fielmente

#### Scenario: Alterações não salvas
- **WHEN** o mestre fecha o editor com alterações pendentes
- **THEN** o sistema pede confirmação antes de descartar
