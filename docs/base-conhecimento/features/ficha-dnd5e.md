# Ficha de personagem D&D 5e

## O que é
Ficha editável e automatizada de **D&D 5e** para cada jogador: identidade, atributos, salvaguardas, perícias, PV, ataques, espaços de magia, lista de magias/truques, traços, inventário (itens cadastrados um a um) e história. Só aparece quando o **sistema da mesa** é D&D 5e (`ehDnd5e(mesa.sistema)`).

## Por que existe
Tirar a conta de cabeça (modificadores, proficiência, CD de magia) é o que mais atrasa a mesa. A ficha calcula e **mostra de onde vem cada número**, sem obrigar a rolagem digital: muita gente rola dados físicos.

## Como funciona
- **Onde fica:** `mesas/{mesaId}/personagens/{uid do jogador}` (um documento por jogador). Salva sozinha (debounce, via `useDocSincronizado`). Campos que faltam são completados por `normalizar`.
- **Valores derivados** (nunca gravados): modificador, bônus de proficiência por nível, salvaguardas, perícias (sem proficiência / proficiente / especialista, mais bônus extra), iniciativa, percepção passiva, CD e bônus de ataque de magia.
- **Rolagens:** clicar num bônus abre o painel com a conta, ex.: `1d20 + 5 (Carisma) + 2 (Proficiência)`. O jogador pode (a) **rolar no site**, com vantagem/desvantagem e crítico no dano (dobra os dados), (b) **copiar** a conta, ou (c) **informar o dado que rolou na mesa** e ver o total. Rolar no site usa o rolador comum (`src/lib/dados.ts`).
- **Ataques:** lista editável (atributo, proficiência, bônus, dado de dano, tipo) com botões de ataque e de dano.
- **Magias:** atributo de conjuração, espaços por círculo (marcar gasto), preenchimento pela tabela de conjurador completo ou meio-conjurador, lista agrupada por círculo com "preparada", botão de ataque de magia e de dano quando a magia tem rolagem. Os campos de escola, alcance, componentes, duração e **descrição** já são guardados; uma tela de leitura/lançamento a partir da descrição é a próxima etapa (ainda não existe).
- **Inventário:** moedas e itens um a um (nome, quantidade, peso, equipado, descrição) com peso total somado; o texto livre antigo de equipamento continua como "anotações".
- **Automações:** dano consome PV temporários primeiro; cura zera as salvaguardas de morte; **descanso longo** restaura PV, espaços de magia e metade dos dados de vida.

## Regras e limites
- O jogador lê e edita a própria ficha; o **mestre lê e edita todas**; outros jogadores não leem (regra `personagens/{donoId}`).
- A ficha é do jogador (uid), não do personagem: precisa ter assumido um personagem na mesa para o mestre vê-la na lista.
- Nível 1–20; atributos 1–30; até 9 espaços por círculo. Não há cálculo de CA por armadura, nem multiclasse (espaços de multiclasse se preenchem à mão).

## Onde está no código
`src/lib/dnd5e.ts` (modelo e regras, com `dnd5e.test.ts`), `src/lib/fichaPersonagem.ts`, `src/components/dnd/FichaDnd5e.tsx`, `src/components/dnd/PainelRolagem.tsx`, `src/components/telas/TelaFichaDnd.tsx`; rotas `/mesas/{id}/jogador/ficha` (jogador) e `/mesas/{id}/personagens` (mestre); itens de menu em `src/components/shell/navegacao.ts`.

## Relações
[mesas-e-convites](mesas-e-convites.md) (sistema da mesa), [jogadores-e-personagens](jogadores-e-personagens.md), [sessao-ao-vivo](sessao-ao-vivo.md) (rolador de dados), [fichas](fichas.md) (outro conceito: NPCs e itens).
