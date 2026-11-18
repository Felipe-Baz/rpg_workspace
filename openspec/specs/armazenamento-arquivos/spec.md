# armazenamento-arquivos

## Purpose

Ver change arquivada 02-infra-storage-servidor.

## Requirements

### Requirement: Upload de arquivos por mesa
O sistema SHALL permitir que o mestre envie arquivos para o Storage no caminho da própria mesa.

#### Scenario: Mestre envia arquivo
- **WHEN** o mestre da mesa envia uma imagem de até 15 MB
- **THEN** o arquivo é salvo em `mesas/{mesaId}/...` e uma URL é retornada

#### Scenario: Não-mestre tenta enviar
- **WHEN** um jogador tenta gravar em `mesas/{mesaId}/...`
- **THEN** a regra do Storage nega a escrita

### Requirement: Leitura restrita a membros
O sistema SHALL permitir leitura de arquivos da mesa apenas a membros dela.

#### Scenario: Usuário de fora
- **WHEN** um usuário que não é membro tenta ler um arquivo da mesa
- **THEN** o acesso é negado

### Requirement: Mapa de imagem com URL do Storage
Um mapa de imagem SHALL poder usar URL do Storage no campo `imagem`, funcionando em todos os visores como a data URL.

#### Scenario: Mapa grande
- **WHEN** o mestre sobe uma imagem de 8 MB
- **THEN** o mapa é criado com URL do Storage e as zonas de cobertura funcionam normalmente

#### Scenario: Mapa antigo
- **WHEN** um mapa existente usa data URL
- **THEN** ele continua sendo exibido sem alteração
