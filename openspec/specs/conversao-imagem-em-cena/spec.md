# conversao-imagem-em-cena

## Purpose

Ver change arquivada 08-importar-imagem-em-camadas.

## Requirements

### Requirement: Converter mapa de imagem em cena
O mestre SHALL poder converter um mapa de imagem em um novo mapa de cena, mantendo o original intacto.

#### Scenario: Conversão básica
- **WHEN** o mestre aciona "Converter em cena" em um mapa de imagem
- **THEN** é criado um novo mapa de cena e o mapa original permanece sem alterações

### Requirement: Revisão das máscaras
O sistema SHALL mostrar as máscaras sugeridas e permitir aceitar, descartar, juntar, dividir e nomear antes de converter.

#### Scenario: Descartar máscara
- **WHEN** o mestre descarta uma máscara
- **THEN** aquela região permanece no fundo e não vira objeto

### Requirement: Reconstrução do fundo
Para cada objeto aceito, o sistema SHALL reconstruir o fundo por inpainting quando o provedor suporta.

#### Scenario: Mover objeto convertido
- **WHEN** o mestre move um objeto convertido
- **THEN** o local de origem mostra o fundo reconstruído, sem buraco

#### Scenario: Sem inpainting
- **WHEN** o provedor não suporta inpainting
- **THEN** a conversão é parcial, com aviso, e os objetos permanecem no fundo

### Requirement: Objetos viram assets
Cada objeto aceito SHALL virar um asset na biblioteca e um objeto da cena.

#### Scenario: Reutilizar objeto
- **WHEN** a conversão termina
- **THEN** os objetos aparecem na biblioteca e podem ser usados em outros mapas

### Requirement: Estimativa e limite
A conversão SHALL mostrar estimativa de custo e respeitar um limite de objetos.

#### Scenario: Muitos objetos
- **WHEN** a segmentação sugere mais objetos que o limite
- **THEN** o mestre escolhe quais converter antes de iniciar
