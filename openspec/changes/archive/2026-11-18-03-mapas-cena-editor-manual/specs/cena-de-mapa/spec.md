## ADDED Requirements

### Requirement: Estrutura da cena
Uma cena SHALL conter canvas (largura, altura), modo (`grid` ou `cenario`), perspectiva, e uma lista ordenada de camadas com visibilidade, trava e opacidade.

#### Scenario: Criar cena em grid
- **WHEN** o mestre cria uma cena em modo grid de 30x20 células quadradas
- **THEN** a cena registra o grid e o canvas com a proporção 3:2 travada

#### Scenario: Criar cena de cenário
- **WHEN** o mestre cria uma cena em modo cenário
- **THEN** a cena não tem grid e usa a perspectiva top-down

### Requirement: Objetos com transformação
Cada objeto SHALL referenciar um asset e ter posição (fração 0 a 1), escala, rotação, espelhamento e ordem z.

#### Scenario: Mover objeto
- **WHEN** um objeto é movido
- **THEN** apenas a posição dele muda e os demais objetos permanecem iguais

### Requirement: Comandos reversíveis
Toda alteração da cena SHALL ser um comando com desfazer e refazer.

#### Scenario: Desfazer remoção
- **WHEN** o mestre remove um objeto e aciona desfazer
- **THEN** o objeto volta à mesma posição, camada e ordem

#### Scenario: Refazer após desfazer
- **WHEN** o mestre desfaz e depois refaz
- **THEN** o estado final é idêntico ao anterior ao desfazer

### Requirement: Aspect ratio travado
Depois de criada, a proporção do canvas SHALL NOT ser alterada.

#### Scenario: Tentar mudar a proporção
- **WHEN** o mestre tenta alterar largura sem manter a proporção
- **THEN** a operação é recusada com explicação
