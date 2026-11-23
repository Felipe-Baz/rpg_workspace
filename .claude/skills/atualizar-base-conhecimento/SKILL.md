---
name: atualizar-base-conhecimento
description: Atualiza docs/base-conhecimento/ para refletir o código atual (features, fluxos, regras de acesso, modelo de dados, rotas). Use após alterar o app, quando o hook Stop avisar que a base está desatualizada, ou quando o usuário pedir para sincronizar/revisar a base de conhecimento.
---

# Atualizar a base de conhecimento

A base fica em `docs/base-conhecimento/` (índice: `README.md`). Objetivo: um agente novo entender o site rápido. Descreve **o que existe e por quê**, não aparência de tela.

## Passos

1. **Descobrir o que mudou.**
   - `git status` e `git diff --stat` (e `git log -5 --stat` se já houve commit) para listar arquivos de `src/`, `firestore.rules`, `storage.rules`, `openspec/specs/`, `next.config.ts`, `package.json`.
   - Se o usuário pediu revisão geral, percorra `src/lib`, `src/app` e `src/components` por área.
2. **Mapear para páginas da base.**
   - Feature/regra de negócio → `features/<feature>.md`.
   - Percurso do usuário → `fluxos/<fluxo>.md`.
   - Quem acessa o quê → `permissoes-e-seguranca.md`.
   - Coleções, rotas `/api`, pastas, padrões → `arquitetura.md`.
   - Termo novo → `glossario.md`.
3. **Ler o código relevante** (não confie só no diff) e confirmar comportamento, limites e nomes de arquivos.
4. **Editar** as páginas mantendo o formato: *O que é / Por que existe / Como funciona / Regras e limites / Onde está no código / Relações*. Feature nova = arquivo novo + linha no `README.md`.
5. **Corrigir o que ficou falso**: caminhos movidos, regras alteradas, limites trocados, funcionalidade removida (apague o trecho, não deixe obsoleto).
6. **Registrar** uma linha em `CHANGELOG.md` (data de hoje, resumo, páginas tocadas). Sem impacto → `sem impacto na base`.
7. **Conferir links** relativos e que não entrou spoiler, chave ou segredo.

## Critérios de qualidade
- Responda "o quê, por quê e quais as regras", em poucas linhas por seção.
- Nada de detalhes de UI (cores, posições, rótulos de botão), a menos que sejam regra de negócio.
- Marque como **plano** o que não está implementado.
- Português, com os mesmos nomes do código (`donoUid`, `liberadoPara`, `useMesaAtual`).
