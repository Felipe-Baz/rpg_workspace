# IA: temas e perspectivas

## O que é
- **Tema da mesa:** perfil de estilo reaproveitado por toda geração (descrição, paleta de até 8 cores, regras, "proibidos", imagens âncora e referências). Uma mesa pode ter vários temas.
- **Perspectiva:** o ponto de vista do mapa (`topdown`, `isometrica`), com fragmento de prompt, imagem de exemplo e regra de ordenação.

## Por que existe
IA gera cada imagem de forma independente: sem um perfil comum, os assets da mesma cena saem com estilos diferentes. O tema dá **consistência visual** entre gerações; a perspectiva evita misturar ângulos (um sprite top-down num mapa isométrico).

## Como funciona
- **Criar tema:** o mestre descreve em texto e/ou envia imagens de referência (reduzidas no cliente). `POST /api/ia/analisar-tema` usa o **LLM com visão** do mestre e devolve um perfil **proposto**; nada é salvo até o mestre revisar e editar. A **paleta é extraída localmente** por quantização de cor (`paleta.ts`, median cut), sem gastar IA.
- **Normalização:** `normalizarPerfil` limita tamanhos (itens ≤ 300 caracteres, listas ≤ 20, paleta ≤ 8) e só aceita cores `#rrggbb`.
- **Âncoras:** imagens do próprio estilo (geradas ou escolhidas) usadas como referência em novas gerações.
- **Uso:** a cena guarda `temaId` e `perspectiva`. O compositor de prompt (`assets/prompt.ts`) junta: perfil do tema + fragmento da perspectiva + pedido do mestre + regras do tipo de asset.
- **Perspectivas (`perspectivas/registro.ts`):** adicionar = arquivo + imagem de exemplo em `public/perspectivas/` + **uma linha** no registro. Campos: `fragmentoPrompt`, `ordenacao` (`porZ`/`porY`/`nenhuma`), `projecaoGrid`, `permiteGrid`.
- **Regras:** mapa em **grid é sempre top-down** (seletor oculto); só **cenário** escolhe perspectiva. A paleta de assets do editor é filtrada pela perspectiva da cena. Trocar a perspectiva de uma cena existente exige confirmação.

## Regras e limites
- Temas (`temas/{id}`) só o mestre lê/escreve.
- O LLM só recebe texto e as imagens enviadas; nunca chaves nem dados de outras mesas.

## Onde está no código
`src/lib/mapas-ia/temas/*`, `perspectivas/*`, `assets/prompt.ts`, `src/components/mapas/cena/TemasMestre.tsx`, `src/app/api/ia/analisar-tema`. Specs: `temas-de-mesa`, `perspectivas-de-mapa`.

## Relações
[ia-assets](ia-assets.md), [editor-de-cena](editor-de-cena.md), [ia-configuracao-e-limites](ia-configuracao-e-limites.md).
