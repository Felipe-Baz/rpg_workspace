# Base de conhecimento: manter sempre atualizada

O projeto tem uma base de conhecimento em `docs/base-conhecimento/` (comece por `README.md`). Ela existe para que qualquer agente entenda o site rápido. **Ela precisa acompanhar o código.**

## Antes de trabalhar
Para entender uma área, leia primeiro a página correspondente em `docs/base-conhecimento/features/` ou `fluxos/` (e `arquitetura.md`, `permissoes-e-seguranca.md`, `glossario.md` quando couber) em vez de reler o código inteiro. Confirme no código o que for decisivo: a base pode estar defasada.

## Ao terminar qualquer alteração, atualize a base na mesma tarefa
Atualize quando a mudança **criar, remover ou alterar**:
- uma **feature** ou um **fluxo** do usuário;
- uma **regra de acesso** (Firestore/Storage rules, `exigirMestre`, quem vê o quê);
- o **modelo de dados** (coleções, campos, limites) ou uma **rota** `/api/*`;
- um **provedor, encaixe de extensão, perspectiva, extensão nativa** ou outro ponto de extensão;
- uma **decisão** ou limite que explique o "porquê" de algo.

Como:
1. Edite as páginas afetadas (uma por feature; crie uma nova em `features/` ou `fluxos/` se a feature for nova e linke no `README.md`).
2. Mantenha o formato: **O que é / Por que existe / Como funciona / Regras e limites / Onde está no código / Relações**.
3. Documente **comportamento, regras, dados e decisões, não aparência de tela** (cores, posição de botão, texto de botão).
4. Registre uma linha em `docs/base-conhecimento/CHANGELOG.md` (data, o que mudou, páginas tocadas). Se a mudança **não** afeta nada acima (refactor, estilo, correção interna), registre `sem impacto na base`.
5. Se renomear/mover arquivos citados nas páginas, corrija os caminhos.

## O que NÃO colocar
- Spoilers de campanha, gabaritos, chaves ou segredos (lore fica em `docs/rpg-especifico/`, fora do GitHub).
- Cópias de código ou listagens que o próprio código já mostra bem.
- Planos futuros como se já existissem: o que ainda é plano vai marcado como tal ou em `docs/planejamento/`.

## Garantia automática
Um hook `Stop` (`.claude/hooks/verificar-base-conhecimento.mjs`) bloqueia o fim do turno **uma vez** quando há código mais novo que a base e pede a atualização. A skill `atualizar-base-conhecimento` faz uma revisão completa sob demanda.
