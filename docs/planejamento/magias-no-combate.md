# Planejamento: magias aplicadas no combate (tracking de combate)

> **Status: plano. Nada disto existe ainda.** Depende de um **tracking de combate** (iniciativa, turnos, alvos no mapa) que o site ainda não tem. Hoje a ficha só **rola** os dados das magias; quem aplica o resultado (tirar PV de alguém, curar, marcar condição) é o jogador/mestre à mão. Contexto: [`features/ficha-dnd5e.md`](../base-conhecimento/features/ficha-dnd5e.md) (catálogo de magias, `mecanica`, `planoDeConjuracao`) e [`ficha-dnd5e-automatizada.md`](ficha-dnd5e-automatizada.md).

## 1. Ideia

Quando existir o tracking de combate, conjurar uma magia deixa de ser "rolar e anotar" e passa a **aplicar o efeito nos alvos**, com o jogador escolhendo por clique **quem recebe o quê**.

Exemplo-guia: uma cura de **20 PV** (rolada ou fixa, como Cura Completa = 70, Palavra de Poder Curar) pode ser **dividida entre vários alvos**: 5 para mim e 15 para outra pessoa. O jogador distribui o total clicando nos alvos (ou ajustando valores), e o site aplica cada parte nos PV certos.

## 2. O que a magia precisa dizer (já existe em parte)

O catálogo (`MecanicaMagia`, `src/lib/regras/dnd5e/magias.ts`) já traz: ataque, salvaguarda e CD, `danos` (com tipo), `cura`, `extras` (PV temporários, PV afetados), escala por círculo/nível, `dardos`/raios e `area` (forma + metros). O que **falta** para o combate:
- **Alvos:** quantos, quem pode ser alvo (criatura, aliado, inimigo, ponto) e se o total é **dividível** entre eles (Cura Completa em Massa: "até 700 PV divididos à escolha"; Mísseis Mágicos: dardos distribuídos).
- **Efeito do sucesso/falha** na salvaguarda (metade do dano, nada, condição).
- **Efeitos duradouros:** condições (enfeitiçado, caído), concentração ligada aos alvos, duração em rodadas.
- **Valores fixos sem dado** (70 PV, 20 de dano): hoje não geram botão; o combate precisa deles.

## 3. Comportamentos desejados

1. **Distribuir cura/dano por clique:** o total da rolagem vira um "balde" a repartir. UI de divisão (ex.: 20 = 5 em mim + 15 no aliado), com resto obrigatório a zero antes de aplicar. Vale para cura, PV temporários e dano dividido (dardos, raios, Mísseis Mágicos, Raio Ardente).
2. **Escolher alvos no mapa:** clicar nos tokens para marcar os alvos; a **área** da magia (esfera, cone, linha, cubo) é desenhada no mapa e pega os tokens dentro dela, com ajuste manual.
3. **Salvaguarda por alvo:** para cada alvo, rolar/informar a salvaguarda contra a CD, aplicar dano cheio ou pela metade conforme o resultado.
4. **Aplicar no PV do alvo:** reaproveitar as regras que a ficha já tem (dano consome PV temporário primeiro; cura zera as salvaguardas de morte; resistência/vulnerabilidade quando existirem no motor).
5. **Mudanças no mapa:** magias que alteram o terreno ou criam áreas persistentes (Muralha de Fogo, Névoa Obscurecente, Teia, Escuridão, Silêncio) viram **objetos/camadas no mapa** com duração e dono, removidos ao acabar a magia ou a concentração. Aproveita o editor de cena em camadas ([`features/editor-de-cena.md`](../base-conhecimento/features/editor-de-cena.md)).
6. **Concentração:** a ficha já guarda uma concentração por vez; o combate liga o teste de Constituição ao dano sofrido de fato e encerra os efeitos/objetos da magia quando a concentração cai.
7. **Quem aplica:** o jogador escolhe e propõe; o mestre pode aprovar/ajustar. Decisão em aberto (ver §5).

## 4. Dependências

- Tracking de combate: ordem de iniciativa, turno atual, lista de combatentes com PV (jogadores e NPCs/monstros, ligando a [`fichas`](../base-conhecimento/features/fichas.md) e [`jogadores-e-personagens`](../base-conhecimento/features/jogadores-e-personagens.md)).
- Tokens no mapa com posição e tamanho (hoje há pinos e coberturas em [`mapas-e-imagens`](../base-conhecimento/features/mapas-e-imagens.md), não combatentes).
- Sessão ao vivo para sincronizar o resultado entre todos ([`sessao-ao-vivo`](../base-conhecimento/features/sessao-ao-vivo.md), [`dados-3d`](../base-conhecimento/features/dados-3d.md)).
- Regras de acesso: o jogador só escreve na **própria** ficha; aplicar PV em outra pessoa exige um caminho autorizado (via mestre/sessão), a desenhar junto com [`permissoes-e-seguranca.md`](../base-conhecimento/permissoes-e-seguranca.md).

## 5. Decisões em aberto

- Onde mora o estado do combate (documento da sessão? subcoleção da mesa?) e como o jogador altera PV de outro sem abrir a regra de leitura/escrita das fichas.
- Modelo para valores fixos e "total dividível" em `MecanicaMagia` (ex.: `cura: { fixo: 70 }`, `divisivel: true`, `alvos: { max, tipo }`), e como migrar o catálogo (a maioria das 172 magias sem mecânica seguirá sem efeito automático).
- Granularidade da automação: sugerir e confirmar (padrão) versus aplicar direto; mestre sempre pode desfazer.
- Casos especiais que não cabem num formato único (Sono, Leque Cromático: PV afetados em ordem crescente; Corrente de Relâmpagos: alvos extras; Convocações) podem ficar manuais.

## 6. Ordem sugerida (quando chegar a hora)

1. Tracking de combate básico (iniciativa, combatentes, PV compartilhado).
2. Aplicar dano/cura de **um alvo** a partir do plano de conjuração.
3. Divisão do total entre vários alvos por clique.
4. Alvos por área no mapa + salvaguarda por alvo.
5. Efeitos persistentes no mapa e ligação com concentração.
