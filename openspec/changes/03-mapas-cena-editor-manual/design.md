## Context

`Mapa` tem `imagem`, `zonas`, `cobertas`, `todos`, `liberadoPara`. `VisorMestre`, `MapasJogador` e `CamadaCobertura` leem só `imagem` e usam frações 0 a 1 da imagem. Pinos dos jogadores ficam em `mesas/{id}/pinos/{uid}`.

## Goals / Non-Goals

**Goals:**
- Editor manual completo e útil sem IA.
- Zero mudança nos consumidores existentes de `Mapa`.
- Modelo de cena pronto para a IA usar via os mesmos comandos.

**Non-Goals:**
- Geração por IA, temas, múltiplas perspectivas.
- Iluminação dinâmica e importação de imagem em camadas.

## Decisions

- **Compatibilidade por construção**: mapa de cena mantém `imagem` renderizada. Zonas, coberturas e pinos ficam no `Mapa`, nunca na cena.
- **Campos opcionais**: `origem?: "imagem" | "cena"` (ausente = imagem) e `cenaId?`. Remover `cenaId` deixa um mapa de imagem válido.
- **Cena em documento próprio** `mesas/{id}/cenas/{cenaId}`. Se passar de ~800 KB, o JSON da cena vai para o Storage e o documento guarda a referência.
- **Coordenadas** de objetos em fração 0 a 1 do canvas.
- **Comandos**: toda mutação é um comando `{tipo, ...}` com `aplicar` e `desfazer`. A pilha de undo/redo é única e será usada pela IA.
- **Render**: PixiJS (WebGL, bom para muitos sprites) para edição; o render final usa `extract` do Pixi para PNG/JPEG no tamanho do canvas, enviado ao Storage.
- **Aspect ratio travado** após criar; o canvas só muda de resolução, nunca de proporção.
- **Grid**: quadrado ou hex, tamanho de célula e offset; é uma camada de overlay, incluída ou não no render conforme opção.
- **Assets enviados**: sprites PNG do próprio mestre, guardados em `mesas/{id}/assets`. A biblioteca gerada por IA vem na change `06-biblioteca-assets-ia`, mas o tipo `Asset` já nasce aqui.
- Ler `node_modules/next/dist/docs/` sobre componentes cliente e carregamento dinâmico antes de integrar o Pixi.

## Risks / Trade-offs

- Desempenho com centenas de objetos → culling e sprites em atlas; meta de 60 fps com 500 objetos.
- Render muito grande estoura memória em celulares → limitar o lado maior a 4096 px.
- Reescalar o canvas poderia deslocar coberturas → bloqueado por design.
- Uma biblioteca nova de renderização aumenta o bundle → carregar o editor sob demanda.
