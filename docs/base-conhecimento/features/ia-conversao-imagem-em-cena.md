# IA: conversão de mapa de imagem em cena

## O que é
Transforma um **mapa de imagem** já existente (feito por IA, comprado ou desenhado) em uma **cena editável**: os objetos viram assets/sprites separados, o fundo é reconstruído onde eles estavam, e o resultado vira um **novo mapa**.

## Por que existe
Muita gente já tem mapas prontos. Sem conversão, só uma cena nova do zero se beneficia do editor. A conversão leva o acervo existente para o mesmo fluxo de edição, IA e exportação VTT.

## Como funciona
1. **Segmentar:** `POST /api/ia/segmentar { mesaId, mapaId }`. O servidor lê a imagem **do documento do mapa** (nunca de URL do corpo) e o segmentador do mestre (Gemini visão) devolve **caixas** de objetos (coordenadas 0–1000). Máscaras viajam em **RLE**. Resolução de trabalho: lado maior = 1024 px; máximo de 12 objetos por conversão.
   - *Decisão de custo/tempo:* pedir só caixas e derivar a máscara no servidor é muito mais rápido que pedir máscaras ao modelo (20 objetos em ~9 s contra ~79 s por objeto).
2. **Revisão:** o mestre vê as máscaras sugeridas, aceita, recusa, **junta** ou **divide** os segmentos antes de gastar IA no inpainting. A tela mostra a estimativa de uso.
3. **Inpainting:** `POST /api/ia/inpaint` pinta os buracos de **magenta (#FF00FF)** com folga (`RAIO_BURACO`) e pede ao provedor de imagem para preencher **só** o magenta continuando o terreno. Em lotes de 4 objetos. Se mais de 20 % do buraco ainda estiver magenta, a reconstrução é dada como falha.
4. **Recorte:** cada objeto vira sprite (PNG recortado) na biblioteca de assets (`convertidoDe` = mapa de origem; `incompleto` se estava cortado/encoberto).
5. **Criação:** uma **cena** nova com fundo reconstruído e os objetos nas posições originais, mais um **novo mapa** `origem: "cena"`.

## Regras e limites
- O **mapa original nunca é escrito**. Em falha, tudo o que foi criado é **desfeito**.
- Se o provedor de imagem não reconstrói o fundo (`inpainting: "nenhum"`), a conversão é **parcial**: aviso `AVISO_SEM_INPAINTING` (os objetos continuam desenhados no fundo).
- Recortes de mapas do mestre **nunca** vão à biblioteca pública (arte do mestre).
- Conta no teto de uso; lote exige confirmação.

## Onde está no código
`src/lib/mapas-ia/conversao/*`, `provedores/google-segmentacao.ts`, `src/lib/servidor/conversao.ts`, `src/app/api/ia/{segmentar,inpaint}`, `src/components/mapas/ConverterCena.tsx`. Specs: `conversao-imagem-em-cena`, `compatibilidade-mapa-imagem`.

## Relações
[mapas-e-imagens](mapas-e-imagens.md), [editor-de-cena](editor-de-cena.md), [ia-assets](ia-assets.md), [fluxo converter-mapa-em-cena](../fluxos/converter-mapa-em-cena.md).
