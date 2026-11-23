# compatibilidade-mapa-imagem

## Purpose

Ver change arquivada 03-mapas-cena-editor-manual.

## Requirements

### Requirement: Mapa de cena se comporta como mapa de imagem
Todo recurso que opera sobre mapas (zonas de cobertura, revelar, pinos, notas, liberação para todos ou individual, visor do mestre e do jogador) SHALL funcionar de forma idêntica para mapas de cena, sem código específico de cena.

#### Scenario: Cobertura em mapa de cena
- **WHEN** o mestre cria uma zona de cobertura sobre um mapa de cena e revela uma área
- **THEN** o jogador vê o mesmo comportamento de um mapa de imagem

#### Scenario: Liberação para jogador
- **WHEN** o mestre libera um mapa de cena para um jogador
- **THEN** o jogador vê apenas o render, sem acesso à cena nem aos assets

### Requirement: Cena é opcional
Um mapa de cena SHALL continuar válido se a referência à cena for removida.

#### Scenario: Remover cenaId
- **WHEN** `cenaId` é removido de um mapa de cena
- **THEN** o mapa passa a funcionar como mapa de imagem com o último render

### Requirement: Re-render preserva coberturas
Salvar uma cena editada SHALL NOT deslocar coberturas, zonas ou pinos existentes.

#### Scenario: Editar depois de cobrir
- **WHEN** o mestre edita a cena e salva, tendo coberturas definidas
- **THEN** as coberturas permanecem nas mesmas frações da imagem

### Requirement: Mapas de imagem inalterados
Mapas existentes SHALL continuar funcionando sem migração.

#### Scenario: Mapa antigo
- **WHEN** um mapa sem `origem` é aberto
- **THEN** é tratado como mapa de imagem

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
