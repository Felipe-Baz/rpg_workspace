## Why

Hoje um mapa é uma imagem achatada. Para o mestre montar mapas por camadas e objetos (estilo Inkarnate) e, depois, deixar a IA ajustar peças individuais, o mapa precisa de uma fonte editável. Esta change entrega o editor manual completo, útil por si só e sem IA, e garante que tudo que existe sobre mapas (zonas de cobertura, revelar, pinos, liberação) funcione igual.

## What Changes

- Novo tipo de mapa, "mapa de cena", ao lado do "mapa de imagem". O mestre escolhe ao criar.
- Modelo de cena: camadas (terreno, caminhos, decals, objetos, rótulos), objetos com transformação, grid opcional (quadrado ou hexagonal) ou cenário livre.
- Editor visual: painel de camadas, seleção e transformação, carimbo de assets enviados pelo mestre, undo/redo, grid com snap.
- Ao salvar, a cena é renderizada para uma imagem e gravada em `Mapa.imagem` (URL do Storage). Zonas, coberturas, pinos, liberação e visores seguem sem alteração.
- `Mapa` ganha apenas campos opcionais: `origem` e `cenaId`.
- O aspect ratio do canvas fica travado após a criação.
- Perspectiva fixa em top-down nesta fase.

## Capabilities

### New Capabilities
- `cena-de-mapa`: formato da cena, camadas, objetos, grid e comandos reversíveis.
- `editor-de-cena`: interface de edição manual, assets enviados e salvamento com render.
- `compatibilidade-mapa-imagem`: contrato de que mapas de cena se comportam como mapas de imagem para todos os recursos existentes.

### Modified Capabilities

## Impact

- `src/lib/mapas.ts` (campos opcionais), novo `src/lib/cena/*`, novo `src/components/mapas/cena/*`.
- `MapasMestre` ganha a escolha "Imagem" ou "Cena" ao criar.
- `firestore.rules`: nova subcoleção `mesas/{id}/cenas` só para o mestre.
- Depende de `02-infra-storage-servidor`.
- Dependência nova provável: PixiJS (confirmar no design).
