# Mapas e imagens

## O que é
Biblioteca de **mapas** e de **imagens (handouts)** da mesa. Os dois têm o mesmo formato (`Colecao = "mapas" | "imagens"`), só mudam rótulos e coleção. O mestre sobe, organiza e libera; o jogador vê o que foi liberado.

## Por que existe
Mapa é o artefato mais mostrado na mesa. O mestre precisa **revelar aos poucos** (coberturas) e liberar só para quem deve ver; o jogador precisa marcar o próprio mapa sem poluir o do grupo.

## Como funciona
- **Documento** `mesas/{id}/mapas|imagens/{id}`: `nome`, `imagem` (data URL comprimido ou URL no Storage), `todos`, `liberadoPara[]`, `zonas`, `cobertas`, `origem` (`imagem` por padrão; `cena` quando vem de uma cena) e `cenaId`.
- **Upload:** `comprimirImagem` reduz o lado (início 2200 px) e recomprime em até 8 tentativas para caber em ~900 KB. Com Storage configurado o arquivo vai para o Storage (até 15 MB) e o documento guarda a URL.
- **Coberturas (fog manual):** polígonos pretos sobre o mapa (`Cobertura`: `pontos` em fração 0–1, `zonaId`, `revelada`), agrupados em **zonas** (ex.: um cômodo). O mestre revela/oculta por zona; vale para mestre e jogadores.
- **Pinos:** marcações **privadas** do jogador (`pinos/{uid}`), com título e texto. Posição em fração da imagem.
- **Liberação:** `todos` ou `liberadoPara`. Ver [liberacao-de-conteudo](liberacao-de-conteudo.md).
- **Mapa de cena:** `origem: "cena"` guarda em `imagem` o **render** da cena; remover a cena deixa um mapa de imagem válido (compatibilidade, `lib/cena/compat.ts`). O jogador só enxerga o render, nunca a cena.
- Visores: `VisorMestre` (com ferramentas), `MapasJogador` (somente leitura + pinos), `CamadaCobertura`.

## Regras e limites
- Pontos em objetos `{x,y}` (o Firestore não aceita arrays aninhados).
- A leitura do arquivo no Storage é aberta a membros: quem obtiver a URL de um mapa não liberado consegue abri-lo (nomes aleatórios; limite conhecido).

## Onde está no código
`src/lib/mapas.ts`, `src/components/mapas/{MapasMestre,MapasJogador,VisorMestre,CamadaCobertura}.tsx`, `TelaMapas`, `TelaImagens`, `src/lib/storage.ts`.

## Relações
[editor-de-cena](editor-de-cena.md), [ia-conversao-imagem-em-cena](ia-conversao-imagem-em-cena.md), [exportacao-vtt](exportacao-vtt.md).
