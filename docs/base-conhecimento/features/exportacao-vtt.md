# Exportação para VTT

## O que é
Exporta uma cena como imagem + metadados no formato **Universal VTT** (`.dd2vtt` / `.uvtt`), aceito por Foundry, Roll20 (com import), Fantasy Grounds e outros, além de exportar só a imagem.

## Por que existe
O mestre que usa uma mesa virtual não deve refazer o mapa lá. Levar grade, paredes e luzes junto economiza horas.

## Como funciona
- `lib/cena/vtt.ts` (puro): `planoGrade(cena, colunas?)` decide a grade (a do mapa em modo grid; em cenário livre, `colunas` células na largura, sugerido ≈ largura/70 px). `montarUvtt(cena, plano, imagemBase64)` monta o JSON.
- Coordenadas em **unidades de grid** (fração do canvas × tamanho do mapa em células).
- Metadados exportados: resolução/tamanho da grade, imagem em PNG base64, **paredes** (linha de visão) e **luzes** (cor e intensidade a partir dos objetos `@luz`).
- Nome de arquivo saneado (`nomeArquivo`). A UI é `ExportarCena`.

## Regras e limites
- Só o mestre exporta.
- Paredes não aparecem no render do mapa, só no arquivo VTT.

## Onde está no código
`src/lib/cena/vtt.ts`, `src/components/mapas/cena/ExportarCena.tsx`. Spec: `openspec/specs/exportacao-vtt`.

## Relações
[editor-de-cena](editor-de-cena.md).
