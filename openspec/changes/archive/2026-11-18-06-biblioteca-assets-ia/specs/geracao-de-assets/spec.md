## ADDED Requirements

### Requirement: Gerar asset no estilo do tema
O sistema SHALL gerar assets usando o perfil de estilo, as âncoras do tema e o fragmento da perspectiva.

#### Scenario: Gerar sprite
- **WHEN** o mestre pede "barril de madeira" com um tema selecionado
- **THEN** um sprite com fundo transparente é salvo na biblioteca com o tema e a perspectiva da cena

### Requirement: Pipeline conforme capacidades
O pipeline SHALL aplicar remoção de fundo apenas quando o provedor não tem alfa nativo.

#### Scenario: Provedor sem alfa
- **WHEN** o provedor não declara alfa nativo
- **THEN** a etapa de remoção de fundo é executada antes de salvar

### Requirement: Texturas repetíveis
Texturas SHALL ser verificadas quanto à continuidade das bordas.

#### Scenario: Borda descontínua
- **WHEN** a diferença entre bordas opostas excede o limite
- **THEN** o sistema aplica correção ou sinaliza a textura como "não repetível" e oferece regerar

### Requirement: Jobs com progresso
A geração SHALL rodar como job assíncrono com status visível em tempo real.

#### Scenario: Acompanhar geração
- **WHEN** o mestre inicia uma geração
- **THEN** vê o status mudar de "na fila" para "gerando" e "pronto" sem recarregar a página

#### Scenario: Falha do provedor
- **WHEN** o provedor retorna erro
- **THEN** o job termina como "falhou" com mensagem clara e sem cobrança no contador de uso

### Requirement: Variações e regeneração
O mestre SHALL poder gerar variações de um asset e regenerar um asset específico.

#### Scenario: Regenerar um objeto
- **WHEN** o mestre pede para regenerar um asset com nova instrução
- **THEN** uma nova versão é criada e a anterior permanece até ser descartada
