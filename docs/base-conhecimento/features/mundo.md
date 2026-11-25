# Mundo (lore público)

## O que é
Enciclopédia da campanha que todos os membros leem: seções com blocos de **texto**, **destaque**, **cartões** e **tabelas**, com Markdown. **Não há conteúdo padrão**: cada mesa é um universo próprio e o mestre cadastra o mundo (editor estruturado ou importação de JSON).

## Por que existe
Dar a toda a mesa a mesma base de lore (o que "qualquer pessoa do mundo sabe") sem o mestre repetir. O formato é dado (JSON), não código, para o mestre (ou uma IA) gerar o conteúdo e colar.

## Como funciona
- Modelo: `Mundo { titulo, subtitulo?, introducao?, secoes[] }`; cada `Secao` tem `blocos[]` (`texto`, `destaque`, `cartoes` com 1–3 colunas, `tabela`).
- `lerMundoJson(json)` → `validarMundo`: valida estrutura e tipos e lança erro **com o caminho do campo** ("secoes[2].blocos[0].titulo: deve ser texto"), para o mestre corrigir.
- `salvarMundo` grava o JSON (como texto) em `mesas/{id}/mundo/principal`; `apagarMundo` apaga o documento (a mesa volta a "sem mundo").
- `useMundo` devolve `mundo: null` quando a mesa não tem conteúdo (ou ele está inválido); a tela mostra um estado vazio (mestre: "Escrever o mundo" / "Importar JSON"; jogador: aviso de que o mestre ainda não cadastrou).
- O mestre cadastra pelo **editor estruturado** (`MundoEditor`: título/intro, seções e blocos texto/destaque/cartões/tabela, reordenar e remover) ou importa um `.json` (a janela de importação oferece **baixar template** com um exemplo de cada bloco, e baixar o mundo atual); o jogador lê em `/jogador/mundo`.
- O Valgreth da campanha "O Juramento de Cinzas" **não está no código**: foi semeado no Firestore só na mesa `5010347d-14e3-49e2-adb9-eb3bc0952013` com `node --env-file=.env scripts/semear-mundo.mjs [mesaId] [arquivo] [--forcar]` (fonte: `jsons/mundo-valgreth.json`; não sobrescreve sem `--forcar`).
- A janela de importação explica o formato e oferece o link público `/mcp/ia/mundo-json.txt` (arquivo estático em `public/mcp/ia/`, sem login): instruções em texto puro para o mestre mandar a uma IA converter a história no JSON. **Se o formato mudar (`validarMundo`), atualize esse arquivo, o template e a ajuda em `Mundo.tsx`.**
- Extensão (`RPG.mundo`): sem conteúdo cadastrado devolve mundo vazio.

## Regras e limites
- Só o mestre escreve; qualquer membro lê.
- Entrada inválida nunca é salva (validação na borda).

## Onde está no código
`src/lib/mundo.ts`, `src/components/Mundo.tsx` (leitura/importação), `src/components/MundoEditor.tsx` (editor), `TelaMundo.tsx`, `public/mcp/ia/mundo-json.txt`, `scripts/semear-mundo.mjs`, `jsons/mundo-valgreth.json`.

## Relações
Documentos de lore específicos de campanha vivem em `docs/rpg-especifico/` (não versionado). Ver [marcas-de-pacto](marcas-de-pacto.md).
