## Why

Toda a feature de mapas com IA depende de o modelo de imagem manter estilo consistente, entregar PNG com fundo transparente e respeitar a perspectiva. Se isso falhar, o resto do plano sofre. Precisamos de evidência antes de construir.

## What Changes

- Criar uma bancada de avaliação (script e relatório, fora do app em produção) que roda o mesmo conjunto de prompts em vários provedores de imagem.
- Medir: consistência de estilo com imagens de referência, alfa nativo, estabilidade de perspectiva top-down, custo e latência por imagem.
- Produzir um relatório com a recomendação dos provedores iniciais e das capacidades que cada um declara.
- Nenhuma mudança visível no site.

## Capabilities

### New Capabilities
- `avaliacao-provedores-imagem`: procedimento reproduzível e relatório de comparação de provedores de imagem.

### Modified Capabilities

## Impact

- Novo diretório `scripts/spike-imagem/` e relatório em `docs/01-spike-provedores-imagem.md`.
- Usa chaves de teste do próprio desenvolvedor via variáveis de ambiente; nada é commitado.
- Sem alteração em `src/`.
