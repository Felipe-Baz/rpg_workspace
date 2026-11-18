## Why

Para que todos os mapas de uma mesa sigam a mesma identidade visual, o mestre precisa definir um tema a partir de referências e texto. Para cenários, ele também precisa escolher a perspectiva. Esta change entrega as duas coisas e já as aplica ao editor manual: o mestre passa a ter um tema e perspectiva por mapa, mesmo antes de qualquer geração.

## What Changes

- Tema da mesa: upload de imagens de referência e texto, análise por modelo de visão e geração de um perfil de estilo editável (descrição, paleta, regras, termos proibidos, imagens âncora).
- Vários temas por mesa; cada mapa de cena aponta para um.
- Registro de perspectivas cadastráveis (top-down, isométrica, lateral...), cada uma com imagem de exemplo, fragmento de prompt e regra de ordenação.
- Seletor de perspectiva mostrando a imagem de exemplo de cada uma.
- Regra: mapas em grid são sempre top-down; cenários aceitam qualquer perspectiva cadastrada.
- O editor passa a ordenar objetos conforme a regra da perspectiva.

## Capabilities

### New Capabilities
- `temas-de-mesa`: criação, edição e seleção de temas com perfil de estilo.
- `perspectivas-de-mapa`: registro de perspectivas, seletor com exemplos e regras de ordenação.

### Modified Capabilities
- `cena-de-mapa`: a cena passa a referenciar `temaId` e `perspectivaId` válidos, e a ordenação de objetos segue a perspectiva.

## Impact

- Novos: `src/lib/mapas-ia/temas/*`, `src/lib/mapas-ia/perspectivas/*`, telas de tema e seletor.
- Usa o provedor LLM de visão configurado em `04-provedores-ia-config` apenas para analisar referências; sem ele o mestre pode escrever o perfil manualmente.
- Depende de `03-mapas-cena-editor-manual` e `04-provedores-ia-config`.
