## ADDED Requirements

### Requirement: Conversão preserva coberturas, zonas e pinos
A cópia criada pela conversão SHALL manter zonas, coberturas e pinos do mapa original nas mesmas frações da imagem.

#### Scenario: Converter mapa com coberturas
- **WHEN** um mapa com 3 zonas e coberturas é convertido
- **THEN** o novo mapa de cena tem as mesmas zonas e coberturas nas mesmas posições

### Requirement: Original nunca é alterado
O mapa de origem SHALL permanecer inalterado após a conversão, inclusive em caso de falha.

#### Scenario: Falha no meio da conversão
- **WHEN** o inpainting falha durante a conversão
- **THEN** nenhum mapa parcial é publicado aos jogadores e o original continua igual
