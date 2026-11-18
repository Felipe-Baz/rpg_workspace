## ADDED Requirements

### Requirement: Bancada reproduzível de avaliação
O repositório SHALL conter um script que executa o conjunto fixo de casos contra cada provedor configurado por variáveis de ambiente.

#### Scenario: Execução completa
- **WHEN** o desenvolvedor roda o script com chaves de dois provedores
- **THEN** são geradas as imagens de todos os casos para ambos e uma galeria HTML comparativa

#### Scenario: Provedor sem chave
- **WHEN** a chave de um provedor não está definida
- **THEN** o provedor é ignorado com aviso e os demais continuam

### Requirement: Verificação de transparência real
A bancada SHALL verificar se cada sprite possui canal alfa útil.

#### Scenario: Fundo falso detectado
- **WHEN** um sprite vem com fundo opaco ou quadriculado desenhado
- **THEN** o caso é marcado como "sem alfa nativo" no relatório

### Requirement: Relatório de recomendação
O spike SHALL produzir `docs/01-spike-provedores-imagem.md` com capacidades, custo, latência, notas de estilo e recomendação dos provedores iniciais.

#### Scenario: Relatório publicado
- **WHEN** o spike termina
- **THEN** o relatório lista, por provedor, `alfaNativo`, `imagensReferencia`, `inpainting`, `seed` e tamanhos suportados
