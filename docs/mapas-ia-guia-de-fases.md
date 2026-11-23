# Mapas com IA: guia de fases e como ver no site

As changes do OpenSpec estão em `openspec/changes/`, numeradas na ordem em que devem ser pedidas. Cada uma entrega algo testável por si só, e nenhuma muda o que já existe em mapas de imagem, zonas de cobertura, jogadores e pinos.

## Como pedir cada fase

Para implementar uma fase, peça na ordem:

```
/opsx:apply 02-infra-storage-servidor
...
```

Ao terminar uma fase e validar no site, arquive com `/opsx:archive <nome>` antes de começar a próxima.

## Como ver as mudanças no site

1. Na raiz do projeto, rode `npm run dev` e abra `http://localhost:3000`.
2. Entre com a conta do **mestre** e abra uma mesa. A tela do mestre fica em `/mesas/<id>/mestre`.
3. Os mapas ficam na aba **Mapas** (e **Imagens**, que usa o mesmo componente). É ali que quase tudo desta feature aparece.
4. Para ver o lado do jogador, use outra conta (ou janela anônima) em `/mesas/<id>/jogador`. Libere um mapa para ele pelo cartão do mapa.
5. Fases com servidor (02 em diante) exigem as variáveis de ambiente descritas em `.env.template` depois de cada change; sem elas, o site avisa em vez de quebrar.

> Itens marcados "a definir" abaixo ainda não têm tela no projeto. O local exato será decidido durante a implementação da fase e registrado no `design.md` dela.

---

## Fase 01: Spike de provedores (adiada)

Não será feita agora: exigiria créditos em vários provedores. Ficou em `openspec/adiadas/`. A feature começa com o **Google Gemini (Nano Banana)** e a arquitetura segue modular, então outros provedores podem ser avaliados e adicionados depois. A validação de qualidade do Gemini acontece nas fases 04 e 06, com a sua própria chave, e é registrada em `docs/validacao-gemini.md`.

## Fase 02: Storage e rotas de servidor

- **Pedir:** `/opsx:apply 02-infra-storage-servidor`
- **Pré-requisito seu:** migrar o projeto Firebase para Blaze e ativar o Storage.
- **No site:** aba **Mapas** > enviar imagem. Agora aceita arquivos grandes (até 15 MB), que antes eram comprimidos até ~900 KB.
- **Onde ver:** `http://localhost:3000/api/saude` deve mostrar `{ "storage": true, "admin": true }`.
- **O que esperar:** mapas novos grandes ficam nítidos. Mapas antigos continuam iguais.
- **Como validar:** suba uma imagem de 8 MB, use "cobrir" e "revelar", e abra como jogador. Tudo deve funcionar como antes.

## Fase 03: Mapa de cena e editor manual (primeira entrega visível)

- **Pedir:** `/opsx:apply 03-mapas-cena-editor-manual`
- **No site:** aba **Mapas** > ao criar, aparece a escolha **Imagem** ou **Cena**. Mapas de cena têm um selo "Cena" no cartão.
- **O que esperar:** um editor com canvas, painel de camadas, grid opcional, upload de PNGs com transparência para usar como carimbos, mover, escalar, rotacionar, desfazer e refazer. Ao salvar, o mapa vira uma imagem como qualquer outra.
- **Como validar:**
  - crie uma cena, carimbe objetos, salve;
  - abra o mapa no visor do mestre e crie zonas de cobertura;
  - libere para o jogador e confira o que ele vê (só a imagem);
  - edite a cena de novo e salve: as coberturas não podem se mover.

## Fase 04: Provedores de IA e chaves

- **Pedir:** `/opsx:apply 04-provedores-ia-config`
- **No site:** uma tela de configuração de IA para o mestre (local **a definir**, provavelmente uma seção nas configurações da conta).
- **O que esperar:** escolher **separadamente** o provedor de imagem e o de LLM (por exemplo Gemini para imagem e Claude Sonnet como LLM), informar o modelo e a chave de cada fabricante (se os dois forem do mesmo fabricante, uma chave só), clicar em **Testar conexão** e ver as capacidades do provedor. Há também um painel de uso com teto de gasto por mesa.
- **Como validar:** teste com chave inválida (erro sem revelar a chave) e com chave válida. Confirme que a chave nunca aparece de volta na tela, apenas "configurada" e os 4 últimos caracteres. Teste a combinação mista (imagem Google + LLM Anthropic) e troque só o LLM. Para provar a extensibilidade, adicione um provedor de exemplo (um arquivo e uma linha) e veja-o aparecer sem mexer na interface.
- **Atenção:** o Gemini não entrega PNG com transparência. Os sprites serão gerados sobre fundo de cor-chave e recortados localmente; a qualidade desse recorte é validada nesta fase (tarefa 6.4).
- **Ainda sem:** gerar mapas e assets pelo editor.

## Fase 05: Temas e perspectivas

- **Pedir:** `/opsx:apply 05-temas-e-perspectivas`
- **No site:** uma tela de **Tema da mesa** (local **a definir**) e, ao criar mapa de cena, os seletores de tema e de perspectiva.
- **O que esperar:**
  - **Tema:** enviar referências e texto, receber um perfil de estilo proposto (descrição, paleta, regras) para editar e salvar. Sem IA configurada, dá para preencher à mão.
  - **Perspectiva:** em modo grid fica sempre top-down; em cenário aparece um seletor com a imagem de exemplo de cada perspectiva.
- **Como validar:** crie dois temas, associe a mapas diferentes; em um cenário, escolha isométrica e confira a ordenação dos objetos por profundidade; tente trocar a perspectiva depois de haver objetos (deve recusar).
- **Ainda sem:** gerar assets. O tema só é guardado.

## Fase 06: Biblioteca e geração de assets

- **Pedir:** `/opsx:apply 06-biblioteca-assets-ia`
- **No site:** dentro do editor de cena, a paleta vira uma **biblioteca** com busca por tag e um painel **Gerar asset**.
- **O que esperar:** pedir "barril de madeira", ver o status mudar para "gerando" e "pronto" em tempo real, e o sprite aparecer na paleta no estilo do tema, com fundo transparente. Também geração de texturas e variações.
- **Como validar:** gere um asset, carimbe no mapa, peça uma variação, tente excluir um asset em uso (o sistema lista as cenas). Confira que a estimativa de custo aparece antes e que o teto de gasto é respeitado.
- **Ainda sem:** a IA montando o mapa sozinha. Aqui o mestre ainda posiciona tudo.

## Fase 07: Agente criador de mapas (a visão principal)

- **Pedir:** `/opsx:apply 07-agente-criador-mapas`
- **No site:** no editor de cena, um painel de **chat da IA**.
- **O que esperar:**
  - pedir "taverna de beira de estrada, 30x20, com lareira" e receber um plano em passos, com prévia;
  - aprovar tudo ou passo a passo, e ver a cena ser montada com os assets do tema;
  - com um objeto selecionado, pedir "deixe maior" ou "troque por outro"; só ele muda;
  - desfazer qualquer passo, ou "reverter ações da IA", sem perder o que você fez à mão.
- **Como validar:** peça um mapa grid e um cenário; peça para tirar objetos de uma região e confira que o resto da cena fica idêntico; use o modo "só sugerir"; depois cubra uma zona e revele como jogador, igual a qualquer mapa.

## Fase 08: Importar imagem em camadas e exportar para VTT

- **Pedir:** `/opsx:apply 08-importar-imagem-em-camadas`
- **No site:** no cartão de um mapa de imagem, a ação **Converter em cena**. No editor de cena, a ação de **Exportar**.
- **O que esperar:** uma tela de revisão com máscaras sugeridas para aceitar, descartar, juntar ou nomear; depois, um **novo** mapa de cena com os objetos separados e o fundo reconstruído. O mapa original continua intacto, e zonas, coberturas e pinos são copiados. Esta fase é "melhor esforço": a qualidade depende do provedor.
- **Como validar:** converta um mapa com coberturas; mova um objeto e confira que não há buraco no fundo; exporte o PNG com e sem grid e os metadados para VTT.

---

## Resumo

| # | Change | O que você vê no site | Usa IA |
|---|---|---|---|
| 01 | spike-provedores-imagem | Adiada (ver `openspec/adiadas/`) | n/a |
| 02 | infra-storage-servidor | Upload de imagens grandes e `/api/saude` | Não |
| 03 | mapas-cena-editor-manual | Escolha Imagem ou Cena e editor manual | Não |
| 04 | provedores-ia-config | Tela de IA e chaves | Só teste |
| 05 | temas-e-perspectivas | Temas e seletor de perspectiva | Opcional |
| 06 | biblioteca-assets-ia | Biblioteca e geração de assets | Sim |
| 07 | agente-criador-mapas | Chat que monta e edita mapas | Sim |
| 08 | importar-imagem-em-camadas | Converter em cena e exportar VTT | Sim |

Ordem de dependência: 02 não depende de nada. 03 depende de 02. 04 depende de 02. 05 depende de 03 e 04. 06 depende de 04 e 05. 07 depende de 03 a 06. 08 depende de 03 a 07.

O que o mestre usa **sem IA** já a partir da fase 03: o editor manual com seus próprios PNGs. As fases 04 a 08 são opcionais; quem preferir seguir só com mapas de imagem continua exatamente como hoje.
