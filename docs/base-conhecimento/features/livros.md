# Livros (biblioteca de regras do mestre)

## O que é
Uma tela **só do mestre** (`/mesas/{id}/livros`, item "Livros" no grupo Mesa) com as regras de D&D 5e para consultar durante a sessão. Cada livro é uma **aba**; hoje existe uma só, o **Livro do Jogador**. O livro abre num início com **consulta rápida** (atalhos) e a lista de capítulos; dentro dele há busca no livro inteiro.

## Por que existe
Na mesa o mestre precisa achar uma regra em segundos (condição, cobertura, descanso, uma magia, um item) sem folhear PDF. Os resumos do livro estavam só em `docs/referencias/`, fora do app. A divisão por abas de livro deixa espaço para os próximos (Guia do Mestre, Bestiário) sem redesenhar a tela.

## Como funciona
- **Capítulos do Livro do Jogador:** Regras de mesa, Compêndio de magias, Regras de conjuração, Classes, Raças, Antecedentes e detalhes, Talentos e multiclasse, Equipamento.
- **Regras de mesa** é o único texto escrito para o mestre: resume os caps. 7 a 9 e o apêndice A do livro (testes e CDs, vantagem, viagem, luz e visão, descanso, combate passo a passo, 0 PV e salvaguardas contra a morte, condições, exaustão). Os demais capítulos vêm dos resumos já existentes, com um acréscimo: **"Riqueza na vida real"** (em Equipamento > Riqueza) converte moedas e preços em reais (1 po ≈ R$ 150, a diária de um artesão, que o livro põe em 1 po) e dá um guia de equilíbrio de riqueza. É régua de mesa, não regra do livro; para mudar a âncora, edite o `.md` e rode o gerador.
- **Dentro de um capítulo de texto:** lista de seções à esquerda (agrupada, com filtro quando é longa; no celular vira um seletor), a seção à direita com um sumário "Nesta seção" que leva aos títulos internos, e botões anterior/próxima.
- **Compêndio de magias** (capítulo próprio): as 361 magias do catálogo, com busca por nome, círculo, escola, classe, ritual e concentração, mais o cartão da magia. É uma versão embutida na página do mesmo catálogo do compêndio da ficha (`CompendioMagias` é a versão em janela, com "adicionar à ficha").
- **Busca no livro:** a partir de 2 letras indexa todos os capítulos uma vez (sem acento, sem maiúsculas); todas as palavras precisam aparecer, título pesa mais que corpo, e os resultados mostram um trecho com os termos marcados. Nomes de magia aparecem à parte.
- **Endereço compartilhável:** o local atual vai no hash (`#classes/mago`, `#magias/bola-de-fogo`); abrir a URL leva direto à seção.
- **Visibilidade:** o item de menu só aparece em mesa D&D 5e (`ehDnd5e`), e a rota fica dentro do shell do mestre. Não há versão para o jogador.

## Regras e limites
- Os textos **não** são lidos do disco em tempo de execução: o script `scripts/gerar-livros.mjs` converte `docs/referencias/playerbook/*.md` em `src/data/livros/jogador/<capitulo>.json` (seções = cabeçalhos; tabelas com cabeçalho vazio do PDF são arrumadas). **Alterou um `.md`? Rode o script e versione os JSON.**
- Cada capítulo é um `import()` dinâmico; só o aberto (ou todos, na primeira busca) entra no navegador. As magias vêm de `src/data/dnd5e/phb/magias.json`, não do `.md`, e as listas de magias por classe não são texto: o filtro por classe do compêndio as substitui.
- Capítulo de conjuração é cortado antes das listas de magias por classe (o catálogo as deriva).
- A tela usa a largura estendida do shell (`max-w-7xl`) por ter lista lateral + texto.
- Conteúdo é o do Livro do Jogador (público do jogo), sem material de campanha. Lore e segredos continuam fora daqui.

## Onde está no código
- Tela e rota: `src/components/telas/TelaLivros.tsx`, `src/app/mesas/[id]/(workspace)/livros/page.tsx`.
- Leitor, markdown e magias: `src/components/livros/` (`LeitorLivro`, `LivroMarkdown`, `NavegadorMagias`); estilos `.livro-*` em `src/app/globals.css`.
- Registro de livros/capítulos, atalhos, carga e busca: `src/lib/livros.ts` (+ `livros.test.ts`).
- Dados e gerador: `src/data/livros/`, `scripts/gerar-livros.mjs`; fontes em `docs/referencias/playerbook/` (a nova `dnd5e-regras-mestre.md` é o resumo para o mestre).
- Menu: `gruposNav` em `src/components/shell/navegacao.ts`.

## Relações
[navegacao-e-busca](navegacao-e-busca.md) (item na sidebar), [ficha-dnd5e](ficha-dnd5e.md) (mesmo catálogo de magias), [permissoes-e-seguranca](../permissoes-e-seguranca.md) (a rota é do shell do mestre).

Para adicionar outro livro: crie as fontes `.md`, inclua-as em `CAPITULOS` do script, registre o livro em `LIVROS` e os imports em `CARREGADORES` (`src/lib/livros.ts`); a aba aparece sozinha.
