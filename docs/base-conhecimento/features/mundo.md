# Mundo (lore público)

## O que é
Enciclopédia da campanha que todos os membros leem: seções com blocos de **texto**, **destaque**, **cartões** e **tabelas**, com Markdown. Vem com um conteúdo padrão (Valgreth) e o mestre pode substituí-lo.

## Por que existe
Dar a toda a mesa a mesma base de lore (o que "qualquer pessoa do mundo sabe") sem o mestre repetir. O formato é dado (JSON), não código, para o mestre (ou uma IA) gerar o conteúdo e colar.

## Como funciona
- Modelo: `Mundo { titulo, subtitulo?, introducao?, secoes[] }`; cada `Secao` tem `blocos[]` (`texto`, `destaque`, `cartoes` com 1–3 colunas, `tabela`).
- `lerMundoJson(json)` → `validarMundo`: valida estrutura e tipos e lança erro **com o caminho do campo** ("secoes[2].blocos[0].titulo: deve ser texto"), para o mestre corrigir.
- `salvarMundo` grava o JSON em `mundo/{doc}`; `restaurarMundoPadrao` apaga o documento e volta ao padrão (`content/valgreth.ts`).
- `useMundo` serve o conteúdo da mesa ou o padrão se não houver.
- O mestre edita e pré-visualiza na tela Mundo; o jogador lê em `/jogador/mundo`.

## Regras e limites
- Só o mestre escreve; qualquer membro lê.
- Entrada inválida nunca é salva (validação na borda).

## Onde está no código
`src/lib/mundo.ts`, `src/content/valgreth.ts`, `TelaMundo.tsx`.

## Relações
Documentos de lore específicos de campanha vivem em `docs/rpg-especifico/` (não versionado). Ver [marcas-de-pacto](marcas-de-pacto.md).
