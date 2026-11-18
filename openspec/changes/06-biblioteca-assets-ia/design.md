## Context

O editor manual já aceita PNGs enviados. Temas, perspectivas e provedores existem. Falta gerar e organizar assets.

## Goals / Non-Goals

**Goals:**
- Reuso como regra: buscar antes de gerar.
- Pipeline previsível independente do provedor, usando capacidades declaradas.
- Geração assíncrona com progresso visível.

**Non-Goals:**
- Agente que decide o que gerar (change seguinte).
- Edição de pixels dentro do app além de regenerar.

## Decisions

- **Documento do asset** em `mesas/{id}/assets/{id}`: `{ tipo, nome, tags[], temaId, perspectivaId, escalaBase, url, origem, geradoPor{provedor,modelo,prompt}, criadoEm }`.
- **Prompt composto**: perfil do tema + fragmento da perspectiva + descrição do mestre + regras do tipo (por exemplo "fundo liso", "sem sombra projetada").
- **Provedor inicial Google Gemini** (sem alfa nativo): sprites são pedidos sobre fundo de cor-chave e recortados pelo `RemovedorFundoChroma`; texturas e decals seguem sem recorte. A consistência de estilo vem das imagens âncora do tema como referência e do reuso de assets.
- **Pipeline** como lista de etapas: `gerar → (removerFundo) → recortar → normalizar → verificar → salvar`. Etapas opcionais conforme `capacidades`.
- **Verificação de textura repetível**: comparar bordas opostas; se a diferença passar do limite, aplicar costura simples ou sugerir regerar.
- **Jobs** em `mesas/{id}/jobs/{id}` com `status`, `progresso` e `resultado`; a UI assina com `onSnapshot`.
- **Variações**: gerar N com seeds diferentes quando o provedor suporta, senão repetir com variação de prompt.
- **Exclusão segura**: não excluir asset usado por alguma cena; oferecer substituir.
- **Estimativa e teto** reaproveitam `limites-de-gasto`.

## Risks / Trade-offs

- Escala inconsistente entre assets → normalizar por `escalaBase` e tamanho padrão por categoria.
- Geração lenta → jobs e miniaturas imediatas.
- Biblioteca crescendo sem controle → tags, filtros e arquivamento.
