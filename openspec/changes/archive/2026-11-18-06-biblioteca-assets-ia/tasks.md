## 1. Biblioteca

- [x] 1.1 Tipo `Asset` final e CRUD em `mesas/{id}/assets` com regras
- [x] 1.2 Painel de biblioteca no editor: busca por tag, filtros por tipo, tema e perspectiva
- [x] 1.3 Exclusão segura com listagem das cenas que usam o asset

## 2. Pipeline

- [x] 2.1 Compositor de prompt (tema + perspectiva + pedido + regras do tipo)
- [x] 2.2 Etapas: gerar, remover fundo condicional, recortar, normalizar, verificar, salvar
- [x] 2.3 Verificação de textura repetível e correção de costura
- [x] 2.4 Variações (seeds ou variação de prompt)

## 3. Jobs e servidor

- [x] 3.1 Coleção `jobs` e executor no servidor com atualização de status
- [x] 3.2 Rota `POST /api/ia/gerar-asset` com `exigirMestre`, teto de gasto e estimativa
- [x] 3.3 Não contabilizar uso em jobs que falham

## 4. Interface

- [x] 4.1 Painel "Gerar asset" com estimativa e confirmação
- [x] 4.2 Status do job em tempo real
- [x] 4.3 Reutilizar asset existente antes de gerar
- [x] 4.4 Regenerar e comparar versões

## 5. Verificação

- [x] 5.1 Teste de ponta a ponta com provedor simulado: gerar, aparecer na paleta, carimbar na cena
- [x] 5.2 Teste de pipeline com e sem alfa nativo
- [x] 5.3 Teste de exclusão de asset em uso
- [x] 5.4 Validação manual com Gemini: gerar 10 assets do mesmo tema, avaliar consistência e recortes e registrar ajustes de prompt em `docs/validacao-gemini.md`
