# Ficha de personagem D&D 5e

## O que é
Ficha editável e automatizada de **D&D 5e** para cada jogador: identidade, atributos, salvaguardas, perícias, PV, ataques, espaços de magia, lista de magias/truques, traços, inventário (itens cadastrados um a um) e história. Só aparece quando o **sistema da mesa** é D&D 5e (`ehDnd5e(mesa.sistema)`).

## Por que existe
Tirar a conta de cabeça (modificadores, proficiência, CD de magia) é o que mais atrasa a mesa. A ficha calcula e **mostra de onde vem cada número**, sem obrigar a rolagem digital: muita gente rola dados físicos.

## Como funciona
- **Onde fica:** `mesas/{mesaId}/personagens/{uid do jogador}` (um documento por jogador). Salva sozinha (debounce, via `useDocSincronizado`). Campos que faltam são completados por `normalizar`.
- **Valores derivados** (nunca gravados): modificador, bônus de proficiência por nível, salvaguardas, perícias (sem proficiência / proficiente / especialista, mais bônus extra), iniciativa, percepção passiva, CD e bônus de ataque de magia.
- **Rolagens:** clicar num bônus abre o painel com a conta, ex.: `1d20 + 5 (Carisma) + 2 (Proficiência)`. O jogador pode (a) **rolar no site**, com vantagem/desvantagem e crítico no dano (dobra os dados), (b) **copiar** a conta, ou (c) **informar o dado que rolou na mesa** e ver o total. Rolar no site usa o rolador 3D único da mesa ([dados-3d](dados-3d.md)): os dados caem na tela de todos que estão online e o painel mostra o resultado quando eles param.
- **Ataques:** lista editável (atributo, proficiência, bônus, dado de dano, tipo) com botões de ataque e de dano.
- **Magias:** atributo de conjuração, espaços por círculo (marcar gasto), preenchimento pela tabela de conjurador completo ou meio-conjurador, lista agrupada por círculo com "preparada", botão de ataque de magia e de dano quando a magia tem rolagem. Os campos de escola, alcance, componentes, duração e **descrição** já são guardados; uma tela de leitura/lançamento a partir da descrição é a próxima etapa (ainda não existe).
- **Inventário:** moedas e itens um a um (nome, quantidade, peso, equipado, descrição) com peso total somado; o texto livre antigo de equipamento continua como "anotações".
- **História:** aba própria em forma de livro de duas páginas (`livro`: uma string por página, folhas adicionáveis, título editável em `tituloLivro`); cada página aceita **markdown** (títulos, negrito, listas, citações) com barra de formatação e modo "Ler" para ver o texto formatado; o texto único antigo (`historia`) vira a primeira página.
- **Automações:** dano consome PV temporários primeiro; cura zera as salvaguardas de morte; **descanso longo** recupera tudo (PV, espaços de magia, todos os dados de vida, contador de descansos curtos); o **descanso curto** é limitado a **2 por descanso longo** (`descansosCurtos`), restaura todos os espaços de magia, gasta 1 dado de vida e abre a rolagem de cura (dado de vida + Constituição) com botão para aplicar o total aos PV (rolado no site ou informado da mesa); "Gastar dado de vida" gasta mais um dado do mesmo jeito.
- **Importar do PDF:** botão "Importar PDF" no cabeçalho lê o formulário oficial **"D&D 5ed - Ficha Editável"** (3 páginas) preenchido e **substitui** os dados da ficha, após confirmação (mostra um resumo). A leitura é toda no navegador (`pdf-lib`, carregado sob demanda); o arquivo não é enviado a lugar nenhum. O PDF não nomeia os campos ("Campo de Texto12"), então `importarFichaPdf.ts` tem um mapa campo → ficha levantado pela posição na página; se a ficha oficial mudar de layout, o mapa precisa ser refeito. PDFs que não sejam essa ficha são recusados. Como converte:
  - **Atributos:** aceita valor ou modificador em qualquer das duas caixas (sinal `+`/`−` indica modificador).
  - **Classe e nível:** "Mago 5" vira classe + nível; várias classes somam os níveis e o texto fica inteiro em classe.
  - **Perícias:** a caixa marca proficiência; se o valor escrito for o dobro da proficiência vira **especialista**; qualquer diferença restante vira "bônus extra", para o número na tela bater com o do PDF. Iniciativa e ataques seguem a mesma ideia (o excedente vai para o bônus extra).
  - **Ataques:** as 3 linhas da ficha; força/destreza e proficiência são escolhidas para deixar o bônus extra mínimo; "1d6+1 contundente" vira dado, bônus e tipo.
  - **Magias:** truques e 1º ao 9º círculo (nome + "preparada"), espaços totais/usados e atributo de conjuração. Escola, alcance, descrição etc. não existem no PDF e ficam vazios.
  - **Textos:** equipamento + tesouros, traços + traços adicionais, idiomas, personalidade/ideais/vínculos/fraquezas, aparência (idade, altura, peso, cabelo, pele, olhos), história (1ª página do livro) e aliados/organizações + anotações de ataques (em `notas`).
  - **Não importa:** imagem de aparência e símbolo da organização (campos de imagem), valores calculados (CA, proficiência, percepção passiva, salvaguardas numéricas) e dados de vida usados.

## Regras e limites
- O jogador lê e edita a própria ficha; o **mestre lê e edita todas**; outros jogadores não leem (regra `personagens/{donoId}`).
- A ficha é do jogador (uid), não do personagem: precisa ter assumido um personagem na mesa para o mestre vê-la na lista.
- Nível 1–20; atributos 1–30; até 9 espaços por círculo. Não há cálculo de CA por armadura, nem multiclasse (espaços de multiclasse se preenchem à mão).

## Onde está no código
`src/lib/dnd5e.ts` (modelo e regras, com `dnd5e.test.ts`), `src/lib/fichaPersonagem.ts`, `src/lib/importarFichaPdf.ts` (importação do PDF, com `importarFichaPdf.test.ts`; PDF de referência em `docs/referencias/`), `src/components/dnd/FichaDnd5e.tsx`, `src/components/dnd/PainelRolagem.tsx`, `src/components/telas/TelaFichaDnd.tsx`; rotas `/mesas/{id}/jogador/ficha` (jogador) e `/mesas/{id}/personagens` (mestre); itens de menu em `src/components/shell/navegacao.ts`.

## Relações
[mesas-e-convites](mesas-e-convites.md) (sistema da mesa), [jogadores-e-personagens](jogadores-e-personagens.md), [sessao-ao-vivo](sessao-ao-vivo.md) (rolador de dados), [fichas](fichas.md) (outro conceito: NPCs e itens).
