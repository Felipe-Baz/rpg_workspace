## ADDED Requirements

### Requirement: Ferramentas mapeiam para comandos da cena
Toda ferramenta do agente SHALL produzir apenas comandos já suportados pela cena e SHALL NOT alterar a cena por outro caminho.

#### Scenario: Colocar objeto
- **WHEN** o agente chama `colocar_objeto` com asset, posição e escala válidos
- **THEN** é produzido um comando de adicionar objeto que pode ser desfeito

### Requirement: Validação de argumentos
Argumentos inválidos SHALL ser rejeitados sem alterar a cena.

#### Scenario: Posição fora do canvas
- **WHEN** o agente propõe um objeto fora do canvas
- **THEN** a ferramenta devolve erro descritivo e nenhum comando é aplicado

### Requirement: Buscar antes de gerar
O agente SHALL consultar a biblioteca antes de gerar um asset.

#### Scenario: Asset existente
- **WHEN** o agente precisa de "mesa" e a biblioteca já tem um asset compatível
- **THEN** ele o reutiliza sem iniciar geração

### Requirement: Espalhar sem sobreposição
`espalhar` SHALL distribuir objetos em uma região com densidade dada, sem sobreposição excessiva e de forma reproduzível pela semente.

#### Scenario: Floresta
- **WHEN** o agente espalha árvores em uma região com densidade média e uma semente
- **THEN** o resultado é idêntico se repetido com a mesma semente
