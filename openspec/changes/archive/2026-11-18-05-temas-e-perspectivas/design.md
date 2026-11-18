## Context

A cena (change `03-mapas-cena-editor-manual`) nasce com perspectiva top-down fixa. O LLM com visão só existe após `04-provedores-ia-config`.

## Goals / Non-Goals

**Goals:**
- Perfil de estilo reaproveitável por toda geração futura.
- Perspectivas como módulos declarativos, adicionáveis sem tocar no núcleo.
- Funcionar também sem IA (perfil escrito à mão).

**Non-Goals:**
- Gerar assets ou mapas (changes seguintes).
- Treinar modelos ou LoRA.

## Decisions

- **Documento do tema** em `mesas/{id}/temas/{temaId}`: `{ nome, descricao, paleta[], regras[], proibidos[], ancoras[] (URLs), referencias[] (URLs), geradoPorIA }`.
- **Análise** (exige LLM com `visao`, de qualquer fabricante): rota `POST /api/ia/analisar-tema` envia as referências e o texto ao LLM ativo e devolve um perfil proposto; o mestre revisa e salva. Nada é aplicado sem confirmação.
- **Paleta** extraída localmente no cliente (quantização de cor) para não depender da IA.
- **Perspectiva** como módulo:
  `{ id, nome, imagemExemplo, fragmentoPrompt, ordenacao: "nenhuma"|"porY"|"porZ", projecaoGrid, permiteGrid }`.
- **Registro explícito** de perspectivas; adicionar = arquivo + imagem de exemplo + uma linha.
- **Regra de grid**: `modo = "grid"` força `topdown`; `permiteGrid=false` em perspectivas laterais.
- **Ordenação no render**: o editor consulta a perspectiva para decidir z-order (por Y, por Z ou nenhuma).
- **Assets** passam a carregar `perspectivaId` e `temaId`; assets de outra perspectiva não aparecem na paleta do editor.
- **Imagens de exemplo** das perspectivas são arquivos estáticos em `public/perspectivas/`.

## Risks / Trade-offs

- Perfil de estilo gerado pode ser genérico → edição manual e imagens âncora.
- Muitas perspectivas aumentam a combinação de assets → começar com top-down e uma segunda (isométrica).
- Mudar a perspectiva de um mapa existente invalida assets → bloquear a troca após haver objetos, com aviso.
