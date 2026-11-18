## ADDED Requirements

### Requirement: Chat dentro do editor
O editor SHALL oferecer um chat em que o mestre descreve o que quer e o agente responde com um plano.

#### Scenario: Pedido simples
- **WHEN** o mestre escreve "adicione uma lareira no canto norte"
- **THEN** o agente responde com um plano de um passo e a prévia do resultado

### Requirement: Contexto de seleção
O agente SHALL receber a seleção atual como contexto.

#### Scenario: Referência à seleção
- **WHEN** há uma árvore selecionada e o mestre escreve "deixe maior"
- **THEN** apenas o objeto selecionado tem a escala alterada

### Requirement: Passos revisáveis e reversíveis
Cada passo SHALL ser aplicado como um grupo único de undo e SHALL poder ser revertido sem afetar passos anteriores.

#### Scenario: Reverter um passo
- **WHEN** o mestre reverte o passo 2 de 3
- **THEN** só as mudanças do passo 2 são desfeitas

### Requirement: Estimativa e confirmação para geração
Passos que geram assets SHALL mostrar estimativa de custo e pedir confirmação.

#### Scenario: Geração em lote
- **WHEN** o plano exige gerar 5 assets novos
- **THEN** o mestre vê a estimativa, confirma, e o teto de gasto é respeitado

### Requirement: Modo apenas sugerir
O mestre SHALL poder pedir ao agente que apenas sugira, sem aplicar.

#### Scenario: Sugestão
- **WHEN** o modo "só sugerir" está ativo
- **THEN** o agente mostra a prévia e nada é aplicado até o mestre aceitar
