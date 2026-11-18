# Validação manual do Gemini (change 04, tarefa 6.4)

Status: **concluída** em 2026-11-18, com chave real: rodada sem referência e rodada com referência (`arvore.bruto.png`).

## Pendências de confirmação (tarefa 2.4)

- A documentação oficial atual (aistudio.google.com/docs) descreve a **Interactions API**
  (`POST /v1beta/interactions`, blocos `type: image`, `response_format`), enquanto os adaptadores
  usam `generateContent` (`/v1beta/models/{modelo}:generateContent`). Confirmar qual formato a chave aceita;
  se necessário, ajustar apenas `google-imagem.ts` e `google-llm.ts`.
- Modelos padrão (editáveis na tela): imagem `gemini-3.1-flash-image`, LLM `gemini-3.6-flash`
  (IDs vistos na documentação em 2026-11-18).
- Confirmados na doc: até 14 imagens de referência no total; `aspect_ratio` e `image_size` (1K/2K/4K).
  Não cobertos pela doc lida: alfa nativo, seed, inpainting por máscara (mantidos como "não"/"instrução").

## Roteiro

1. Configurar a chave em /configuracoes/ia e usar "Testar conexão".
2. Gerar 5 sprites (fundo magenta) e 2 texturas; aplicar `RemovedorFundoChroma`.
3. Conferir bordas/halo e consistência com uma imagem de referência.

## Resultado (rodada sem referência, `gemini-3.1-flash-image`)
Script: `node --env-file=.env scripts/validar-gemini.ts` (+ `scripts/reprocessar-recortes.ts` para reaplicar o chroma sem custo).

| Item | Resultado | Observações |
|------|-----------|-------------|
| Teste de conexão | OK | GET do modelo valida chave e nome. |
| Formato `generateContent` | OK | As 5 gerações de sprite e as 2 texturas foram aceitas e devolveram imagem (inlineData). Interactions API não é necessária. |
| Fundo magenta pedido | OK | Os 5 sprites vieram sobre magenta chapado (medido ≈ 252,10,247), sem sombra nem gradiente visíveis. |
| Alfa nativo | Não | Retorna PNG opaco; chroma key é de fato necessário. |
| Recorte (chroma) | OK | Transparência: barril 67%, mesa 59%, tocha 71%, árvore 44%, baú 25%. Buracos internos (aro da tocha, vãos da copa) ficaram transparentes. |
| Halo nas bordas | Aceitável | Antes do despill: contorno roxo em fundo escuro (forte na árvore). Depois: restam pontos roxos isolados na árvore e fumaça da tocha com tom roxo. |
| Texturas 1–2 | Geradas | `piso-pedra`, `grama`: aspecto bom; emenda (seamless) **não verificada**. |
| Consistência com referência | OK | Ver seção abaixo. |

## Achados
- A cor-chave deve ser **medida nas bordas** (`detectarCorFundo`), não a pedida: o modelo não acerta o magenta exato. O primeiro `escolherCorChave` amostrava o fundo e falhava (0% de transparência); corrigido.
- O despill só atua em pixels vizinhos de área transparente (raio 2), para não desbotar objetos realmente roxos.
- Limite: roxos muito vivos (ex.: 150,50,200) caem na faixa de transição do magenta e perdem opacidade; nesses casos pedir outra cor-chave (verde/ciano) ao gerar.
- O modelo devolve 1408x768 (proporção ~16:9) mesmo para objetos; o objeto às vezes encosta nas bordas (baú) — o pipeline da change 06 deve pedir margem e recortar ao conteúdo (trim).
- Sem controle de `seed` testado; `tamanhos`/`aspect_ratio` não testados.

## Rodada com referência (`arvore.bruto.png`)
Mesmos 5 sprites e 2 texturas, enviando a árvore como imagem de referência e o texto "match the art style…".
- **Estilo:** muda de forma nítida e coerente com a referência: contorno escuro fino, pintura com textura, paleta mais terrosa e dessaturada. Barril e mesa (conferidos visualmente) ficaram mais próximos da árvore do que na rodada sem referência, onde o estilo era mais liso. Baú, árvore e tocha só tiveram os números de recorte conferidos nesta rodada.
- **Recorte:** continua bom (barril 57%, baú 23%, mesa 61%, árvore 44%, tocha 63% transparentes; fundo medido ≈ 251,14,245). Halo praticamente ausente nos previews claro e escuro.
- **Texturas:** `grama` com referência ficou ilustrada com contorno, no mesmo estilo; repetição de padrão visível mas sem emenda óbvia. Seamless ainda não verificado de forma automática.
- **Ressalvas:** o objeto ocupa quase todo o quadro (barril encosta no topo e na base); a mesa saiu em vista ~3/4 (com espessura lateral) apesar de "seen from above". O pipeline da change 06 deve pedir margem, fixar a perspectiva no prompt e fazer trim ao conteúdo.

## Correção: pontos roxos entre as folhas (árvore)
Causa: não era fundo esquecido, e sim (a) contaminação de cor de 3–6 px a partir das bordas e (b) bolsões
de fundo pequenos, em magenta **escurecido** (ex.: 155,62,152), que escapavam da tolerância por distância
e ficavam semitransparentes ou opacos. Correções em `fundo.ts`:
1. Despill em raio 8 (mapa de distância ao transparente), em vez de 2.
2. Critério por matiz: pixel com forte tom de chave e canais altos equilibrados (R≈B no magenta) vira fundo,
   mesmo escurecido (`HUE_MIN/HUE_MAX/HUE_EQUILIBRIO`).
3. Pontos isolados com tom de chave e vizinhança normal são trocados pela cor média dos vizinhos.
Resultado na árvore: pixels magenta opacos 10.480 → 71; previews claro/escuro sem pontos visíveis.
Efeito colateral aceito: objetos muito rosados/roxos (R≈B≫G) podem ser lidos como fundo; nesses casos
usar outra cor-chave (`escolherCorChave`).

## Cor-chave escolhida por asset (`corChave.ts`)
O LLM (Gemini, mesma chave) lista as cores do objeto; o sistema escolhe, entre magenta/ciano/verde/amarelo/azul/vermelho,
a mais distante de toda a paleta (empate: ordem de preferência) e a pede no prompt ("no <cor> anywhere on the object").
Sem LLM, ou se falhar, usa heurística por palavras-chave. Teste real:
- **muro de pedra** -> paleta cinzas/marrons/verde-musgo -> **magenta** -> recorte limpo, 50% transparente.
- **canteiro de flores** (rosa, vermelho, amarelo, roxo, azul) -> **ciano** -> flores intactas, 43% transparente, sem halo.
Rodar só esses: `SO=muro,canteiro node --env-file=.env scripts/validar-gemini.ts` (`SEM_LLM=1` força a heurística).
