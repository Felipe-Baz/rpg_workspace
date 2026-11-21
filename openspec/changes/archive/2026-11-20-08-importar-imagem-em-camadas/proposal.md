## Why

Muitos mestres já têm mapas prontos em imagem e querem editar partes deles (mover uma mesa, trocar uma árvore) sem refazer tudo. Converter uma imagem em camadas e objetos dá a esses mapas o mesmo poder de edição de um mapa de cena. É a parte mais incerta do plano, por isso vem por último e é tratada como "melhor esforço".

## What Changes

- Ação "Converter em cena" em um mapa de imagem, que cria um mapa de cena a partir dele.
- Segmentação da imagem em objetos (SAM ou serviço equivalente) com revisão manual das máscaras.
- Reconstrução do fundo por inpainting sob cada objeto removido.
- Cada objeto vira um asset e um objeto da cena; o fundo vira uma camada de terreno.
- Exportação do mapa de cena para formatos de VTT (imagem com grid, metadados de paredes e luzes).
- O mapa original é preservado; a conversão cria uma cópia e nunca altera o original nem suas coberturas.

## Capabilities

### New Capabilities
- `conversao-imagem-em-cena`: segmentação, revisão de máscaras, inpainting de fundo e criação da cena.
- `exportacao-vtt`: exportação da cena para formatos de mesa virtual.

### Modified Capabilities
- `compatibilidade-mapa-imagem`: a conversão preserva coberturas, zonas e pinos do mapa original na cópia.

## Impact

- Novos: `src/lib/mapas-ia/conversao/*`, rotas `POST /api/ia/segmentar` e `POST /api/ia/inpaint`, interface de revisão de máscaras e exportadores.
- Exige um provedor com segmentação e inpainting, via novas capacidades no contrato de provedores.
- Depende de `03` a `07`.
