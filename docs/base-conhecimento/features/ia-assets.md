# IA: geração de assets e biblioteca

## O que é
Geração de **assets** (`sprite`, `textura`, `pincel`, `decal`) por IA no estilo do tema da mesa, com **biblioteca** por mesa para reutilizar antes de gerar e uma **biblioteca pública** de assets gerados.

## Por que existe
O mapa é montado com peças. Gerar a peça uma vez e reutilizar em várias cenas poupa dinheiro (teto) e mantém o estilo. Sprites precisam de transparência e texturas precisam repetir sem emenda, algo que a IA de imagem não entrega "de fábrica".

## Como funciona
- **Pedido (`PedidoAsset`):** tipo, descrição, nome, tags, tema, perspectiva, `escalaBase` (largura em células ao carimbar), `quantidade` (variações, máx. 8) e, para **regeneração**, `baseAssetId` + `instrucao` (herda as características do asset base e parte da imagem dele).
- **Job:** `POST /api/ia/gerar-asset` cria `mesas/{id}/jobs/{jobId}` em `na-fila`, responde **202** e processa depois; o cliente acompanha o progresso por `onSnapshot`. Status: `na-fila` → `gerando` → `pronto` | `falhou`. Jobs presos expiram (10 min, `jobExpirado`). Atualizações de progresso são em série para nenhuma chegar depois do status final.
- **Pipeline (`assets/pipeline.ts`):** gerar → (remover fundo) → recortar ao conteúdo → normalizar tamanho → verificar (textura) → salvar. A rota executa a orquestração; o provedor só declara **capacidades**; `planejarGeracao` decide se é preciso remover o fundo localmente (provedor sem alfa nativo e tipo que exige transparência).
- **Remover fundo por chroma key (`fundo.ts`, `corChave.ts`):** o prompt pede fundo de cor sólida; `corChave` escolhe a cor que menos se parece com o objeto (muro de pedra → magenta, canteiro de flores → ciano). O removedor é um ponto de extensão (`RemovedorFundo`).
- **Texturas repetíveis:** `pixels.ts` trata continuidade de bordas e `verificarTextura`; texturas que falham ficam marcadas `naoRepetivel` com aviso.
- **Biblioteca (`assets/biblioteca.ts`):** busca por **tags** e tipo, `sugerirReuso` (acha asset parecido antes de gerar), exclusão segura (`cenasQueUsam`, `decidirExclusao`: se há cenas usando, exige substituto; `substituirAsset` troca nos objetos).
- **Biblioteca pública (`assetsPublicos`):** gerados por IA podem ter cópia pública (`publico: true`, mesmo id); o arquivo no Storage é compartilhado e a mesa não o apaga. **Assets enviados (PNG) e recortes de mapas do mestre nunca entram na pública** (`paraPublico`, `convertidoDe`).
- Cada geração conta no teto de uso e pede confirmação em lote.

## Regras e limites
- Só o mestre dispara; a chave usada é a do mestre.
- Assets da mesa (`assets/{id}`) só o mestre lê/escreve.
- Assets antigos sem os campos novos continuam válidos (`tipo` ausente = `sprite`; `perspectivaId` ausente = top-down).

## Onde está no código
`src/lib/mapas-ia/assets/*`, `fundo.ts`, `corChave.ts`, `orquestrador.ts`, `src/lib/servidor/assets.ts`, `src/app/api/ia/gerar-asset`, `src/components/mapas/cena/{GerarAsset,BibliotecaAssets}.tsx`. Specs: `geracao-de-assets`, `biblioteca-de-assets`.

## Relações
[ia-temas-e-perspectivas](ia-temas-e-perspectivas.md), [ia-configuracao-e-limites](ia-configuracao-e-limites.md), [ia-agente-criador-de-mapas](ia-agente-criador-de-mapas.md).
