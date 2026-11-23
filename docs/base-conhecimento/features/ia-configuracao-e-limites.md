# IA: configuração, provedores e limites de gasto

## O que é
Tela `/configuracoes/ia` onde o mestre cadastra as **próprias chaves**, escolhe o provedor ativo por função e define o **teto de gerações** por mesa.

## Por que existe
- **Chave do mestre, não da plataforma:** o custo e a conta de IA são dele; a plataforma não paga nem revende IA.
- **Provedores trocáveis:** os fabricantes mudam rápido. O núcleo depende só de interfaces.
- **Custo previsível:** teto, estimativa e confirmação evitam surpresa na fatura.

## Como funciona
- **Registro de provedores (`mapas-ia/registro.ts`):** `googleImagem` (família Nano Banana), `googleLlm` (Gemini), `anthropicLlm` e `googleSegmentacao`. **Adicionar um provedor = um arquivo em `provedores/` + uma linha no registro.**
- **Três funções ativas por mestre:** `provedorImagemAtivo`, `provedorLlmAtivo`, `provedorSegmentacaoAtivo`. A UI é gerada a partir dos `campos` de cada provedor (texto ou segredo).
- **Credenciais:** provedores do mesmo fabricante compartilham `credencialId` (uma chave serve Imagem + LLM + Segmentação do Google). Guardadas cifradas (**AES-256-GCM**) em `usuarios/{uid}/segredos/{cred}`; `GET /api/ia/config` devolve só "configurada" e os 4 últimos caracteres.
- **Testar:** `POST /api/ia/testar` faz uma chamada mínima com a chave salva; erros voltam sem a chave.
- **Capacidades declaradas** (`CapacidadesImagem`: alfa nativo, nº de imagens de referência, inpainting `nenhum`/`instrucao`/`mascara`, seed, tamanhos; `CapacidadesLlm`: visão, ferramentas). O pipeline se adapta às capacidades em vez de assumir um fabricante.
- **Teto (`lib/mapas-ia/limites.ts`):** padrão **50 gerações por mesa por mês** (`periodoDe` = `YYYY-MM`). `verificarTeto` recusa o que passar do teto com mensagem clara; o mestre pode aumentar o teto (`PUT /api/ia/uso`).
- **Estimativa e confirmação:** ações que geram várias imagens mostram a quantidade e exigem `confirmado: true` (`estimarLote`: qualquer lote com mais de 1 geração, `LIMITE_SEM_CONFIRMAR = 1`).
- **Registro de uso:** cada geração grava em `uso`/`usoRegistros` (provedor, tipo, data) via Admin SDK; o painel mostra total do período e por provedor.

## Regras e limites
- Só o mestre dono da mesa chama as rotas; jogador recebe `403`.
- A mesma credencial do **mestre dono** é usada mesmo que outra pessoa dispare a ação.
- Imagens de referência e dados enviados ao LLM **nunca** incluem chaves nem dados de outras mesas.

## Onde está no código
`src/lib/mapas-ia/{tipos,registro,limites,http}.ts`, `provedores/*`, `src/lib/servidor/{ia,cifra,admin}.ts`, `src/app/api/ia/{config,testar,uso,gerar}`, `src/components/ia/ConfigIa.tsx`. Specs: `provedores-ia`, `configuracao-ia-mestre`, `segredos-por-mestre`, `limites-de-gasto`, `rotas-servidor-autenticadas`.

## Relações
[permissoes-e-seguranca](../permissoes-e-seguranca.md), [ia-assets](ia-assets.md), [ia-agente-criador-de-mapas](ia-agente-criador-de-mapas.md).
