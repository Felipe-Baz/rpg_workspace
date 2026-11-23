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

---

# Validação do pipeline de assets (change 06, tarefa 5.4)

Status: **concluída** em 2026-11-18, com chave real (`gemini-3.1-flash-image`).
Script: `node --env-file=.env scripts/validar-assets.ts [ancora.png]` (`SO=mancha,barril` gera só alguns). Saída em `validacao-assets-saida/` (ignorada pelo git).

Roteiro: 10 assets do **mesmo tema** (pintura sombria, contorno fino, paleta terrosa), com a âncora `arvore.recorte.png` como referência, usando o pipeline real
(`comporPrompt` + cor-chave por asset + `executarPipeline`): 7 sprites, 1 decal, 1 textura e 1 pincel de caminho.

| Asset | Tipo | Cor-chave | Resultado final | Transparência | Observações |
|-------|------|-----------|-----------------|---------------|-------------|
| barril | sprite | magenta | 508x512 | 22% | Visto de cima (círculo com aros). Recorte limpo. |
| baú | sprite | ciano | 512x471 | 23% | Saiu em vista ~3/4 (não top-down). Recorte limpo. |
| mesa | sprite | magenta | 506x512 | 22% | Pediu 2 canecas, vieram 3. Recorte limpo. |
| tocha | sprite | magenta | 454x512 | 40% | Fogo e vãos internos transparentes, sem halo visível. |
| muro | sprite | magenta | 512x313 | 8% | Objeto retangular ocupa o quadro; transparência baixa é esperada. |
| canteiro | sprite | ciano | 512x356 | 11% | Ciano evitou o conflito com as flores rosa/roxo/amarelo. |
| arbusto | sprite | magenta | 512x331 | 22% | Contorno irregular preservado. |
| mancha | decal | ciano | 512x417 | 27% | Ver ajuste 1. |
| piso-pedra | textura | — | 512x512 | — | Correção de costura aplicada; sem emenda visível. |
| trilha | pincel | — | 1024x256 | — | Correção de costura aplicada; sem emenda visível. |

## Achados e ajustes
1. **Decal sem recorte vira retângulo opaco** (0% transparente na 1ª rodada). A decisão de projeto "decals sem recorte" foi revista:
   `precisaAlfa` agora vale para sprite **e** decal. Nova rodada: 27% transparente, bordas irregulares preservadas; resta um leve tom azulado
   (resíduo do ciano) em poucas bordas da mancha.
2. **Consistência de estilo: boa.** Com a âncora, os 10 itens compartilham contorno escuro fino, textura de pincel e paleta terrosa/dessaturada; barril, mesa, tocha e baú são reconhecíveis como o mesmo conjunto.
3. **Perspectiva não é 100% obedecida:** o baú veio em vista 3/4 apesar do fragmento "strict top-down". O fragmento da perspectiva fica no prompt, mas o mestre pode regenerar com instrução ("seen straight from above, no front face"). Sugestão futura: reforçar o fragmento top-down para objetos com frente.
4. **Contagem de itens não é garantida** (mesa com 3 canecas em vez de 2): tratar como variação aceitável ou regenerar.
5. **Margem e trim:** com a regra "generous empty margin", nenhum sprite encostou nas bordas e o `recortarAoConteudo` ajustou o quadro a cada objeto (resolve a ressalva da change 04).
6. **Cor-chave por asset (LLM)** escolheu ciano para os que têm flores/roxo e magenta para os demais; nenhum recorte precisou de ajuste de tolerância.
7. **Texturas:** a verificação de bordas acionou a costura nas duas; o resultado não mostra emenda, mas a mistura em faixa de 30% pode suavizar detalhes nas bordas.

---

# Validação da conversão em cena (change 08, tarefa 1.2)

Status: **rodada em 2026-11-20** (mapa de taverna 1408x768 gerado pelo próprio Gemini, `gemini-3.6-flash` + `gemini-3.1-flash-image`). Resultado: funciona de ponta a ponta, qualidade insuficiente (ver tabela). A implementação segue a decisão do design ("confirmar se o Gemini serve
como segmentador e como removedor de objeto no fundo"):

- **Segmentador** (`provedores/google-segmentacao.ts`, capacidade `segmentacao`): usa o modelo de LLM do Gemini com visão
  e o formato de máscaras descrito na doc de *image understanding* (`box_2d` em 0–1000 `[y0, x0, y1, x1]`, `mask` PNG
  do tamanho da caixa, `label`). Se o modelo devolver só caixas (sem `mask`), o segmento vale pela caixa inteira.
- **Inpainting**: o provedor de imagem declara `inpainting: "instrucao"` e tem `editar`, então `suportaInpainting` é verdadeiro.
  Sem máscara nativa, o servidor pinta cada buraco de magenta, pede para preencher só o magenta e **compõe só os pixels do
  buraco** de volta no original; fora dele o fundo é o original pixel a pixel. Se mais de 20% do buraco continuar magenta,
  a reconstrução conta como falha e a conversão inteira é desfeita.
- Provedor de imagem sem inpainting: a conversão é parcial (objetos continuam também no fundo), com aviso.

Roteiro: `node --env-file=.env scripts/validar-conversao.ts caminho/mapa.jpg [maxObjetos]` (opcional: `GEMINI_LLM`,
`GEMINI_MODELO`). Conferir em `validacao-conversao-saida/`:

| Item | Resultado | Observações |
|------|-----------|-------------|
| Segmentação devolve JSON com `box_2d` | OK | Só caixas: 20 objetos certos (lareira, estante, balcão, mesas, barris, banquinhos) em 9 s. |
| Máscaras por pixel (`mask`) | Não serve | Pedindo máscaras: 1 objeto, ~10 mil tokens, 79 s; PNG vem sem o prefixo data:. O segmentador agora pede só caixas. |
| Rótulos úteis | OK | Em inglês ("bar counter", "stool"). |
| Fundo reconstruído sem magenta | OK | 3 chamadas para 12 objetos, ~28 s. |
| Qualidade do fundo | Fraca | Remendos retangulares visíveis: tábuas em outra direção e tom; o buraco da lareira cobriu parte da parede de pedra. Barris ficaram bons. |
| Sprites | Retangulares | Sem máscara, o sprite leva o piso e pedaços dos vizinhos (mesa com cantos de banquinho). |
| "Incompleto" | Exagerado | Com caixas, quase todos encostam em outra caixa e saem marcados. |
| Fundo fora dos buracos idêntico ao original | Garantido | Composição local, não depende do modelo. |

Se a segmentação do Gemini não servir, cadastre outro segmentador (ex.: SAM hospedado) como novo arquivo em
`provedores/` e uma linha em `registro.ts`; nada mais muda.
