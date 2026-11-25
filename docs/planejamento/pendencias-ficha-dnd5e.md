# Pendências da ficha D&D 5e automatizada (Fases 0 a 7)

> Lista consolidada de **limitações, itens despriorizados e o que ficou de fora** das fases já entregues (0 a 9) de [`ficha-dnd5e-automatizada.md`](ficha-dnd5e-automatizada.md), para revisão posterior. Nada aqui está implementado. Todas as fases do plano principal (0 a 9) já foram entregues no código. O comportamento atual está em [`features/ficha-dnd5e.md`](../base-conhecimento/features/ficha-dnd5e.md).
>
> Legenda de esforço: **P** = dias, **M** = 1–2 semanas, **G** = 2–4 semanas. Legenda de origem: *(despriorizado)* = estava no plano e foi adiado; *(limitação)* = decisão técnica que restringe o uso; *(risco)* = pode causar problema se não for tratado; *(validação)* = ainda não conferido por um humano ou num navegador.

## 0. Validações gerais ainda não feitas

- [ ] **Teste visual no navegador de tudo da Fase 1 em diante.** Todo o trabalho foi checado por testes automatizados (351), `tsc`, lint e `next build`, mas as telas (compêndio, painel de construção, assistentes, catálogo de equipamento, card de estado, tema, modo combate) **não foram abertas num navegador**: a ficha exige login no Firebase. *(validação)*
- [ ] **Conferir os dois temas (claro e escuro) e o celular** com a ficha real de um personagem, incluindo o modo combate. *(validação)*
- [ ] **Lint:** 2 erros pré-existentes de `react-hooks/set-state-in-effect` em `FichasJogador.tsx` e `MapasJogador.tsx` (não fazem parte desta iniciativa). *(risco)*
- [X] **Commit/PR:** nada foi commitado; tudo está na branch `feature/melhorias-dnd-5ed`, com arquivos novos sem rastreio. Revisar o diff antes. *(validação)*
- [ ] **Testes de interface:** só o motor (`src/lib/regras`) tem testes; os componentes React não têm teste automatizado. *(limitação)*
- [ ] **Regras do Firestore:** o bloqueio de talentos/multiclasse e o limite de sintonização valem **só na interface**. Um jogador que escrevesse direto no banco passaria por cima. Serve como guia da mesa, não como segurança. *(limitação)*

## Fase 0: fundação

- [ ] **Protótipo visual aprovado** (artifact/Figma) antes de aplicar o tema. Foi pulado: o tema foi aplicado direto. *(despriorizado)*
- [ ] **Segundo sistema de regras** (Tormenta20, Pathfinder...): o contrato `SistemaRegras` e o registro existem, mas só D&D 5e tem módulo. Falta validar a abstração com um segundo sistema de verdade; é provável que alguns tipos (ex.: atributos fixos de D&D em `Atributo`) precisem ser generalizados. *(limitação)*
- [ ] **Extensão do catálogo por pacotes** (Xanathar, Tasha, homebrew do mestre): a estrutura `PacoteConteudo` aceita, mas só o pacote `phb` existe e não há tela para o mestre criar conteúdo homebrew por mesa. *(despriorizado)*

## Fase 1: catálogo de magias e compêndio

- [ ] **Revisão humana da `mecanica` das magias.** A extração é por heurística (regex). Cerca de metade das 361 magias tem mecânica; as demais são em geral utilitárias, mas há casos com padrão de texto diferente (dano "extra", dano do tipo escolhido, valores fixos). Falta conferir magia por magia. Correções entram em `scripts/dnd5e/correcoes-magias.json` e o gerador reaplica. *(validação)*
- [ ] **Valores fixos sem dado** (ex.: Cura Completa = 70 PV, 20 de dano fixo) não geram botão de rolagem. *(limitação)*
- [ ] **Magias com mais de um efeito/modo** (escolha de dano, de forma, de alvo) têm só a primeira interpretação extraída. *(limitação)*
- [ ] **Dado de dano escalado só no primeiro tipo de dano** da magia (as demais parcelas não escalam por círculo). *(limitação)*
- [ ] **Listas por classe de subclasses conjuradoras** (Cavaleiro Místico, Trapaceiro Arcano) usam a lista de mago, mas sem restrição de escola nem tabela de espaços própria. *(limitação)*
- [ ] **Busca do compêndio** é só por nome (sem acento). Não busca por texto da descrição nem salva filtros. Mesmo compêndio para itens, talentos e características não existe (hoje cada um é lista própria). *(despriorizado)*
- [ ] **Typos conhecidos da fonte** são corrigidos por lista no script; novos erros só aparecem ao revisar. *(validação)*

## Fase 2: conjuração completa

- [ ] **Grimório do mago** (copiar magia custa 50 po e 2 h por círculo; opcional). *(despriorizado)*
- [ ] **Arcana Mística do bruxo** (uma magia de 6º a 9º círculo por descanso longo, sem espaço) e o ajuste fino dos espaços de pacto. *(despriorizado)*
- [ ] **Subclasses conjuradoras** (Cavaleiro Místico, Trapaceiro Arcano): sem limites de magias nem tabela de espaços. *(despriorizado)*
- [ ] **Componentes materiais com custo e foco**: não são checados ao conjurar. *(despriorizado)*
- [ ] **Conjurador de Guerra** (vantagem na concentração) e outros talentos que mexem na conjuração não alteram o teste de Constituição. *(despriorizado)*
- [ ] **Recuperação Arcana** devolve espaços? Hoje só controla o uso (recurso); não devolve os espaços sozinha. *(limitação)*
- [ ] **Magias que mudam a CA ou dão PV temporários** além de Armadura Arcana (Escudo da Fé, Armadura de Agathys, Vitalidade Falsa...) não aplicam efeito. *(despriorizado)*
- [ ] **Truques por nível do personagem** sobre `dardos` (Rajada Mística) funcionam; outros truques com mais de uma parcela por nível não foram revisados. *(validação)*
- [ ] **Aplicar o efeito nos alvos** (dividir cura, escolher alvos no mapa, salvaguarda por alvo): coberto por [`magias-no-combate.md`](magias-no-combate.md), que depende de um tracking de combate que ainda não existe.

## Fase 3: raça, antecedente e classe

- [ ] **Migração reconhece só texto de raça, antecedente e subclasse.** Outros campos livres (idiomas, ferramentas, traços) ficam como estão; escolhas da raça (ex.: o +1 do meio-elfo) ficam pendentes para o jogador completar. *(limitação)*
- [ ] **Escolhas da classe além das perícias**: estilo de luta, especialização (ladino, bardo), invocações do bruxo, metamagia, manobras, pacto, expertise. Hoje as características aparecem como texto e a escolha é anotada à mão. *(despriorizado)*
- [ ] **Tabelas de subclasse por nível** (quando cada característica de subclasse chega): a ficha mostra todas as características da subclasse escolhida, sem filtrar pelo nível. *(limitação)*
- [ ] **Características de classe sem efeito automático**: quase todas são só texto. Já valem Defesa sem Armadura (CA), Fúria, Ataque Descuidado, Armadura Arcana e os recursos listados na Fase 5. *(despriorizado)*
- [ ] **Raça: traços sem efeito** (Visão no Escuro, Sensibilidade à Luz, vantagens em salvaguarda contra condição, Magia Drow, Legado Infernal, Ancestral Dracônico além da resistência) aparecem como texto; magias raciais não entram na ficha. O truque do alto elfo é escolhido mas não vira magia cadastrada. *(despriorizado)*
- [ ] **Antecedente**: equipamento inicial só como texto; tabelas de personalidade (d8/d6) estão no catálogo mas **não há rolagem/escolha** delas na criação. Variações (Mercador de Guilda, Gladiador, Espião...) não estão no catálogo. *(despriorizado)*
- [ ] **Talentos**: só os efeitos numéricos óbvios (+1 de atributo, Alerta, Robusto, Mobilidade, armaduras) são aplicados; a maioria é texto. Pré-requisitos dos talentos **não são validados**. Resiliente não concede a proficiência em salvaguarda do atributo escolhido; Perito e Poliglota guardam as escolhas, mas ferramentas do Perito não entram. *(limitação)*
- [ ] **Tamanho, idade, altura/peso e tendência** da raça não são usados (altura/peso aleatórios por raça não estão modelados). *(despriorizado)*
- [ ] **Subraças de outros livros** (Duergar etc.) e raças opcionais não existem; só as 9 do Livro do Jogador (com 18 subraças e variantes). *(limitação)*
- [ ] **Transferir XP/PV rolados** ao importar o PDF: o importador do PDF continua gravando o formato antigo; ele **remove** a construção pelo livro ao importar. *(limitação)*
- [ ] **Configurações da mesa** só têm as opções de talentos e multiclasse; faltam outras regras da casa (ex.: sobrecarga variante, aceitar sub-raça de outro livro). *(despriorizado)*

## Fase 4: equipamento, CA e ataques

- [ ] **CA e ataques das armas só com a construção pelo livro ativa**; fichas antigas continuam manuais (há um aviso no inventário). *(limitação)*
- [ ] **Itens mágicos**: só bônus numérico (+N em arma/armadura/CA) e marcador de sintonização. Sem efeitos próprios (anel de resistência, manto, cinto de Força...), **sem cargas** nem recarga. *(despriorizado)*
- [ ] **Capacidade de carga** (7,5 kg × Força, conversão da edição brasileira) é só aviso; a regra variante de **sobrecarga com penalidade de deslocamento** não está implementada. O valor 7,5 foi inferido (o `.md` não traz a regra): conferir com a mesa. *(limitação)*
- [ ] **Munição** não é descontada nem contada; arremesso e alcance viram só nota na linha de ataque. *(despriorizado)*
- [ ] **Ataque desarmado** usa dado fixo 1 + Força (dano `1`); **Artes Marciais do monge** (dado e Destreza) não entram. *(despriorizado)*
- [ ] **Estilo de luta, Ataque Furtivo automático no dano, Ataque Extra** como contagem de ataques por ação: não aplicados (Ataque Furtivo existe só como botão de rolagem). *(despriorizado)*
- [ ] **Armas improvisadas, de prata, especiais** (Rede, Lança de Montaria): sem regras próprias. *(limitação)*
- [ ] **Pacotes de equipamento**: alguns itens do pacote não existem no catálogo e entram como item avulso sem peso (ex.: "Fantasias", "Vidro de tinta"). *(limitação)*
- [~] **Equipamento inicial:** feito para a classe (opções A/B e compra com a riqueza no assistente); o equipamento do **antecedente** segue só como texto nas anotações (ouro da algibeira entra nas moedas).
- [ ] **Transferir item entre jogadores/mestre** (usando a liberação de conteúdo): não avaliado. *(despriorizado)*
- [ ] **Montarias, veículos, comércio, despesas, serviços e bugigangas** do capítulo 5 não estão no catálogo (só armas, armaduras, aventura, ferramentas, pacotes). *(despriorizado)*
- [ ] **Conversão de moedas** só troca quando não sobra fração; não há "trocar tudo" nem registro de compras. *(limitação)*

## Fase 5: recursos, condições e combate

- [X] ~~Dano/cura do mestre como atualização atômica por campo~~ — feito na Fase 8 para o painel "O grupo" e a iniciativa. **Resta:** o botão de dano na própria ficha aberta pelo mestre, e qualquer edição do jogador, ainda regravam a ficha inteira com debounce. *(risco parcial)*
- [X] ~~Condições e PV na iniciativa e na tela do mestre~~ — feito na Fase 8 (só mesas D&D 5e; inimigos continuam com valores locais).
- [ ] **Exaustão** afeta deslocamento e PV máximos **só na exibição**; os números gravados não mudam. Exaustão 6 marca morto, mas não há fluxo de reviver. *(limitação)*
- [ ] **Vantagem/desvantagem automáticas cobrem** condições, exaustão, Fúria, Ataque Descuidado e armadura sem proficiência. **Não cobrem**: Astúcia Ardilosa, ataque à distância a 1,5 m de inimigo, alvo caído (de longe/perto), cobertura, luz/escuridão, Esconder, ajuda de aliado, características de raça (Ancestral Feérico etc.). Condições que dependem de contexto (amedrontado: fonte à vista; cego: testes de visão) são só sugestão. *(limitação)*
- [ ] **Ataques contra você** (vantagem/desvantagem/crítico) são só uma lista informativa; não afetam nenhuma rolagem. *(limitação)*
- [ ] **Recursos**: tabelas de usos conferidas de memória do livro (não estão nos `.md`); revisar com o PDF. Ficam de fora recursos de subclasse (Domínio, Juramento, Colégio, Tradição...), Forma Selvagem com estatísticas de fera, Inspiração Bárdica de nível alto e outras fontes de recursos. Arma de Sopro e Sortudo guardam só o contador. Recuperação Arcana e Pontos de Feitiçaria não convertem espaços. *(validação)*
- [ ] **Features ativáveis**: só Fúria, Ataque Descuidado, Forma Selvagem e Armadura Arcana. Faltam, entre outras, Postura Defensiva, Surto de Ação (efeito), Passo do Vento, Inspiração (efeito no alvo), Forma Selvagem com PV da fera. *(despriorizado)*
- [ ] **Fúria**: não encerra sozinha (sem dano/ataque no turno), não bloqueia conjuração/concentração. *(limitação)*
- [ ] **Defesas**: resistências da raça/Fúria/petrificado e manuais funcionam; imunidades a condição e vantagens em salvaguarda contra condição (elfo/anão) não existem. Dano de "arma não mágica" e "prata" não têm tipo próprio. *(limitação)*
- [ ] **Dano massivo** vale para o dano que sobra após chegar a 0 e a 0 PV; não trata fortitude (Resistência) nem cura de PV temporário a 0. Sem *Inconsciente/estável* explícito nas condições gravadas (é derivado de PV 0). *(limitação)*
- [ ] **Temporários de efeitos** (Vitalidade Falsa, Armadura de Agathys): não geram PV temporário. *(despriorizado)*

## Fase 6: assistentes

- [ ] **Criar já em nível acima de 1**, com o histórico completo de PV/aumentos de atributo/talentos por nível (hoje: criar no 1º e subir pelo assistente). *(despriorizado)*
- [x] **Equipamento inicial da classe** e escolhas do tipo "(a) ou (b)" do livro (assistente de criação).
- [ ] **Escolher magias** (truques e 1º círculo) e **personalidade** (traços, ideais, vínculos e defeitos por tabela) dentro do assistente. *(despriorizado)*
- [ ] **Desfazer uma subida de nível** (hoje só dá para editar o `build` à mão ou remover passos de dado). *(despriorizado)*
- [ ] **Subir de nível não pergunta**: aprender magias novas, trocar magias, feitiços de espaço, escolhas de classe do nível (estilo de luta, invocações, metamagia, manobras), nem aplica a regra "Con par sobe PV retroativos" (isso já sai do cálculo de PV, mas não é anunciado). *(despriorizado)*
- [ ] **Método de atributos 4d6**: sem opção de "rerrolar" regras da mesa (ex.: repetir se a soma for baixa) nem rolar com o rolador 3D (usa o rolador simples). *(limitação)*
- [ ] **Compra de pontos e distribuição padrão** não sugerem o atributo principal da classe. *(despriorizado)*
- [X] ~~Multiclasse no assistente de nível~~ — feito na Fase 9.
- [ ] **XP**: o nível não sobe sozinho (decisão); sem divisão automática de XP entre jogadores pelo mestre. *(despriorizado)*

## Fase 7: tema visual

- [ ] **Protótipo de design aprovado** (Figma/artifact), previsto antes da aplicação. *(despriorizado)*
- [ ] **Ícones próprios** de tipos de dano, condições e atributos (hoje: lucide para escolas e símbolos simples). *(despriorizado)*
- [ ] **Texturas de pergaminho/couro** no fundo da ficha e ornamentos de borda mais elaborados (hoje: moldura dupla com losangos nos cantos). *(despriorizado)*
- [ ] **Tema nas demais telas do site** (mundo, mapas, sessões, painel do mestre): só os títulos ganharam o filete dourado. Decidir como a temática de RPG segue pelo site sem perder a identidade atual. *(despriorizado)*
- [ ] **Alvo de toque das gemas e losangos** tem 32 px e 24 px (abaixo dos 44 px pedidos), para manter a densidade. Rever se atrapalhar no celular. *(limitação)*
- [ ] **Modo combate** é uma escolha manual (lembrada no navegador); não ativa sozinho no celular nem tem "tela única" com PV, CA, ataques, espaços e condições lado a lado. *(limitação)*
- [ ] **Contraste:** conferido por cálculo (AA) para as cores principais; falta verificar visualmente estados desativados, foco por teclado e o painel de rolagem no tema claro. *(validação)*
- [ ] **Animações**: não há som novo no crítico/falha (usa o som de dados já existente) nem animação de rolagem própria na ficha além do rolador 3D. *(despriorizado)*

## Itens transversais do plano original que não foram cobertos

- [ ] **Teste de grupo/contestado** e **testes com ferramenta** (escolher perícia + ferramenta e somar a proficiência da ferramenta). *(despriorizado)*
- [ ] **Testes passivos** além de Percepção (Intuição, Investigação), **Pau pra toda obra do bardo** (Jack of All Trades), Mão Leve e outros bônus de perícia por característica. *(despriorizado)*
- [ ] **Perícias com fonte da proficiência**: o motor sabe a fonte; a lista de ferramentas e idiomas por fonte aparece só na aba Traços. *(limitação)*
- [X] ~~Histórico de rolagens com origem e iniciativa/PV ao vivo~~ — feito na Fase 8.
- [X] ~~Painel do mestre com fichas calculadas, filtro "preciso conferir" e resumo do grupo~~ — feito na Fase 8.
- [ ] **Importador de PDF** continua escrevendo o formato antigo; não gera `build`. *(limitação)*
- [ ] **Pergunta em aberto do plano**: "Dádiva" (Fase 8+), conteúdo homebrew do mestre por mesa, e material extra (Xanathar/Tasha). *(despriorizado)*
- [ ] **Medir bundle** antes/depois do catálogo (o JSON é carregado sob demanda, mas não houve medição do tamanho final nem do tempo de abertura da ficha). *(validação)*

## Como usar esta lista

1. Releia o item e marque `[x]` ao entregar; atualize também a base de conhecimento e a tabela de fases do plano principal.
2. Itens *(validação)* saem de graça quando alguém abrir a ficha num navegador: comece por eles.
3. Itens *(risco)* (gravação concorrente, bloqueio só na interface) merecem decisão antes de a mesa usar a ficha de verdade.

## Fase 8: integração com a mesa

- [ ] **Outros pontos que ainda leem a ficha bruta?** A Fase 8 corrigiu pedidos de teste e PV da iniciativa; vale revisar qualquer extensão (`RPG.*`) ou tela futura que leia `mesas/{id}/personagens/{uid}` direto. Use `useFichaEfetiva`/`efetivaDe`. *(risco)*
- [ ] **Inimigos e NPCs na iniciativa** continuam com PV e condições locais (`localStorage`), sem ficha. O rastreador não aplica dano com resistência a eles. *(limitação)*
- [ ] **Painel do grupo e iniciativa ao vivo só em mesas D&D 5e**; jogadores sem ficha preenchida aparecem com os valores padrão (a linha avisa "ficha ainda não preenchida"). *(limitação)*
- [ ] **Painel do grupo sem filtros por condição/classe** e sem ordenação; com muitos jogadores cada linha abre uma assinatura própria do Firestore. *(despriorizado)*
- [ ] **Concentração e salvaguarda de morte pelo mestre:** o painel aplica dano, cura e condições, mas não rola a salvaguarda de morte nem pede o teste de concentração ao jogador. *(despriorizado)*
- [ ] **Resumo do grupo** não inclui idiomas/ferramentas de fichas sem construção pelo livro (o texto livre não é interpretado). *(limitação)*
- [ ] **Histórico:** rolagens antigas (sem rótulo) continuam mostrando só o nome do jogador; o rótulo é cortado em 80 caracteres. *(limitação)*
- [ ] **Validar no navegador** painel do grupo, iniciativa ao vivo e o aviso de sugestão no cartão de pedido de teste. *(validação)*

## Fase 9: multiclasse

- [ ] **Limites de magias ativas por classe** (truques, preparadas, conhecidas): em multiclasse a ficha **não limita** as magias ativas (cada classe teria o seu limite pelo nível dela). O aviso "magias ativas acima do limite" também some. *(limitação)*
- [ ] **Dados de vida por tipo**: a ficha tem um só `dadoVida` (o da classe com mais níveis) e um contador; o livro manda controlar d10 e d8 separados. O descanso curto cura sempre com esse dado. *(limitação)*
- [ ] **Espaços de pacto do bruxo** são somados aos espaços comuns; a recarga continua sendo a de todos (descanso longo ou curto, conforme já está), sem separar o pool de pacto (que volta no descanso curto). *(limitação)*
- [ ] **Canalizar Divindade e Ataque Extra** combinados entre classes (usos não somam; efeitos de ambas as classes), e Lâmina Sedenta: só texto. *(despriorizado)*
- [ ] **Pré-requisitos** conferem na hora de entrar na classe (assistente) e viram aviso depois; se um atributo cair depois, nada bloqueia. *(limitação)*
- [ ] **Subclasse conjuradora** (Cavaleiro Arcano, Trapaceiro Arcano) conta para os espaços de multiclasse, mas sozinha (sem outra conjuradora) continua sem espaços nem limites. *(limitação)*
- [ ] **Remover classe** (só mestre) apaga o histórico de PV da classe; não há "trocar de classe" nem "desfazer subida". *(limitação)*
- [ ] **Escolhas por classe adicional** além de perícia/instrumento (estilo de luta, especialização etc.) seguem como texto. *(despriorizado)*
- [ ] **Criação guiada** continua só no 1º nível e numa classe; multiclasse entra depois pelo assistente de nível. *(limitação)*
- [ ] **Validar no navegador** o seletor "Classe do nível", a conferência de pré-requisitos e a CD por classe. *(validação)*
