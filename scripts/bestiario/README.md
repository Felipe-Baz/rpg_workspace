# Gerador do bestiário

Converte `docs/referencias/dnd_bestiario.pdf` em `docs/referencias/bestiario/` (markdown por criatura, `index.json`, ilustrações `.webp`). Só precisa rodar de novo se o PDF mudar ou se o formato de saída mudar.

Fluxo (rode numa pasta de trabalho temporária; ela recebe `pages_*.json` e `raw/`):

1. A biblioteca `mupdf` já está no `package.json` (`npm install`).
2. Extração, em lotes de 30 páginas (a memória do WASM do mupdf não aguenta o PDF inteiro de uma vez; o PDF tem 352 páginas):
   `for a in 0 30 60 90 120 150 180 210 240 270 300 330; do node <repo>/scripts/bestiario/extract.mjs $a $((a+30)); done`
3. Geração: `node <repo>/scripts/bestiario/build.mjs [pasta-de-saida]` (padrão: `docs/referencias/bestiario`). Usa o `sharp` do projeto para converter as ilustrações.

Como funciona: `extract.mjs` lê cada página com estilo por caractere (negrito/itálico) e acha as imagens com posição; `events.mjs` classifica pela fonte (Century Schoolbook = texto de ambientação, Calibri = bloco de estatísticas e barras laterais) e monta parágrafos, tabelas e a linha de atributos; `toc.mjs` lê o sumário (página 3 do PDF); `build.mjs` divide por entrada do sumário, posiciona as imagens, grava os arquivos e confere que cada bloco tem nome. Os apêndices A e B viram um arquivo por criatura.

Conferência feita na geração: 431 ocorrências de "Nível de Desafio" no texto do livro; 428 viraram blocos (as demais são menções em texto corrido na introdução e no modelo Meio-Dragão).
