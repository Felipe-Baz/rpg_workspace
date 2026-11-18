## Why

Cada objeto do mapa precisa existir como asset reutilizável no estilo do tema. Reaproveitar assets garante consistência visual e reduz custo de geração. Esta change entrega a biblioteca e a geração de sprites, texturas, pincéis e decals, já utilizáveis no editor manual, antes do agente autônomo.

## What Changes

- Biblioteca de assets por mesa com tags, busca, tema, perspectiva e origem (enviado ou gerado).
- Geração de assets pelo provedor ativo, injetando o perfil de estilo e as imagens âncora do tema.
- Pipeline de sprite: gerar, remover fundo se preciso, recortar, normalizar escala e salvar.
- Texturas repetíveis (verificação de continuidade nas bordas) e pincéis de caminho.
- Variações de um asset e regeneração de um asset específico.
- No editor, painel "Gerar asset" com estimativa de custo e teto de gasto.
- Jobs assíncronos com status em tempo real.

## Capabilities

### New Capabilities
- `biblioteca-de-assets`: armazenamento, tags, busca, reutilização e exclusão segura.
- `geracao-de-assets`: geração, pipeline de pós-processamento, variações e jobs.

### Modified Capabilities

## Impact

- Novos: `src/lib/mapas-ia/assets/*`, `src/app/api/ia/gerar-asset`, coleção `mesas/{id}/assets` e `mesas/{id}/jobs`.
- `editor-de-cena` ganha o painel de geração e a paleta com busca por tag.
- Depende de `04-provedores-ia-config` e `05-temas-e-perspectivas`.
