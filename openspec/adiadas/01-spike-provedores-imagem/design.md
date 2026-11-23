## Context

O projeto não tem rota de IA nem Storage. O spike roda localmente em Node, sem depender do app.

## Goals / Non-Goals

**Goals:**
- Comparar provedores com o mesmo conjunto fixo de casos.
- Resultado reproduzível e revisável por humanos (galeria HTML).
- Extrair as capacidades reais de cada provedor para o futuro `ProvedorImagem`.

**Non-Goals:**
- Implementar a interface final de provedores (isso é `04-provedores-ia-config`).
- Avaliação automatizada de "beleza"; a avaliação de estilo é humana, com nota 1 a 5.

## Decisions

- **Conjunto de casos fixo** em `scripts/spike-imagem/casos.json`: 3 temas de referência × (sprite árvore, sprite mesa, textura grama, textura pedra, decal) × perspectiva top-down.
- **Adaptador mínimo por provedor** (`gerar(prompt, refs[]) → PNG`), usado só no spike.
- **Alfa**: verificar canal alfa real e proporção de pixels de borda opacos (detecta "fundo falso" quadriculado).
- **Saída**: `saida/<provedor>/<caso>.png` mais `galeria.html` com notas editáveis.
- **Relatório** consolida: tabela de capacidades, custo médio, latência, notas, recomendação.

## Risks / Trade-offs

- Resultados variam entre execuções → rodar 3 amostras por caso.
- Custo do spike na conta do desenvolvedor → limitar a ~100 imagens por provedor.
- Modelos mudam rápido → o relatório registra data e versão do modelo.
