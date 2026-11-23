# Base de conhecimento do RPGWorkspace

Ponto de entrada para qualquer agente (ou pessoa) que precise entender o site rápido. Descreve **features, fluxos e decisões** (o *quê* e o *porquê*), não a aparência das telas. O código é a fonte da verdade sobre *como*; aqui ficam as ligações entre as peças e as razões por trás delas.

## Por onde começar

| Preciso de… | Leia |
|---|---|
| Entender o produto em 5 minutos | [visao-geral.md](visao-geral.md) |
| Saber onde cada coisa mora no código e no banco | [arquitetura.md](arquitetura.md) |
| Saber quem pode ver/gravar o quê | [permissoes-e-seguranca.md](permissoes-e-seguranca.md) |
| Um termo do domínio (mesa, cena, encaixe…) | [glossario.md](glossario.md) |
| O histórico do que mudou nesta base | [CHANGELOG.md](CHANGELOG.md) |

## Features (`features/`)

**Núcleo da mesa**
- [contas-e-acesso](features/contas-e-acesso.md): login, cadastro, rotas protegidas.
- [mesas-e-convites](features/mesas-e-convites.md): criar mesa, status, código de convite, entrar/sair.
- [jogadores-e-personagens](features/jogadores-e-personagens.md): personagens, quem controla qual.
- [navegacao-e-busca](features/navegacao-e-busca.md): sidebar por grupos, Ctrl+K, visão mestre × jogador.
- [liberacao-de-conteudo](features/liberacao-de-conteudo.md): o padrão "mestre libera, jogador lê" e o aviso de novidades.

**Conteúdo da campanha**
- [fichas](features/fichas.md) · [missoes](features/missoes.md) · [mundo](features/mundo.md) · [sessoes-e-segredos](features/sessoes-e-segredos.md)
- [diario-do-jogador](features/diario-do-jogador.md) · [quadro-de-investigacao](features/quadro-de-investigacao.md)
- [sessao-ao-vivo](features/sessao-ao-vivo.md): dados, iniciativa, cronômetro, notas rápidas.

**Mapas e imagens**
- [mapas-e-imagens](features/mapas-e-imagens.md): upload, coberturas (fog), pinos, liberação.
- [editor-de-cena](features/editor-de-cena.md): mapa em camadas e objetos, com desfazer/refazer.
- [exportacao-vtt](features/exportacao-vtt.md): `.dd2vtt` / `.uvtt`.

**IA para mapas**
- [ia-configuracao-e-limites](features/ia-configuracao-e-limites.md): chaves do mestre, provedores, teto de gasto.
- [ia-temas-e-perspectivas](features/ia-temas-e-perspectivas.md): estilo coerente da mesa.
- [ia-assets](features/ia-assets.md): gerar sprites/texturas, pipeline, biblioteca.
- [ia-agente-criador-de-mapas](features/ia-agente-criador-de-mapas.md): chat que monta a cena.
- [ia-conversao-imagem-em-cena](features/ia-conversao-imagem-em-cena.md): imagem pronta vira cena editável.

**Extensibilidade**
- [extensoes](features/extensoes.md): mini-apps criados com IA, encaixes, extensões nativas.
- [marcas-de-pacto](features/marcas-de-pacto.md): extensão nativa exclusiva de "O Juramento de Cinzas".

## Fluxos (`fluxos/`)

- [onboarding-do-mestre](fluxos/onboarding-do-mestre.md): conta → mesa → primeiros passos.
- [entrada-do-jogador](fluxos/entrada-do-jogador.md): código de convite → personagem → diário.
- [preparar-e-jogar-uma-sessao](fluxos/preparar-e-jogar-uma-sessao.md): preparo, sessão ao vivo, encerramento.
- [criar-mapa-com-ia](fluxos/criar-mapa-com-ia.md): tema → assets → agente → publicar/exportar.
- [converter-mapa-em-cena](fluxos/converter-mapa-em-cena.md): imagem → segmentar → revisar → cena.
- [criar-extensao](fluxos/criar-extensao.md): chat com IA → prévia → publicar na mesa.

## Convenções desta base

- Idioma: português. Nomes de código também são em português (`useMesaAtual`, `donoUid`, `liberadoPara`).
- Cada feature tem: **O que é**, **Por que existe**, **Como funciona**, **Regras e limites**, **Onde está no código**, **Relações**.
- Não documentar detalhes de tela (cores, posição de botão). Documentar comportamento, regras, dados e decisões.
- **Manutenção:** toda mudança que altere uma feature, fluxo, regra de acesso, modelo de dados ou rota deve atualizar esta base na mesma tarefa. A regra e o gancho automático estão em `.claude/` (ver [`.claude/rules/base-conhecimento.md`](../../.claude/rules/base-conhecimento.md)).
- Há documentos de planejamento mais longos em `docs/planejamento/` (specs, plano de extensões, plano de UX). Esta base descreve o que **existe**; os planos descrevem o que **se pretende**.
