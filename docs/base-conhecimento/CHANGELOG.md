# Changelog da base de conhecimento

Registro curto de **mudanças de comportamento** que alteraram esta base (mais recente primeiro). Uma linha por mudança: data, o que mudou, arquivos da base tocados.

Se uma alteração de código **não** afeta nenhuma feature, fluxo, regra de acesso, modelo de dados ou rota, registre mesmo assim com `sem impacto na base` (isso marca a revisão como feita).

- 2026-11-23: **E2 das extensões:** leitura de dados da mesa via `RPG.ler`/`RPG.rolar` com broker (`capacidades.ts`, `broker.ts`, `broker-puro.ts`), permissões aprovadas pelo mestre (`permissoesAprovadas`, tela de consentimento), prompt gerado do catálogo e modo ensaio (dados reais ou de exemplo) no criador. Só leitura. Páginas: extensoes, criar-extensao, permissoes-e-seguranca, arquitetura, glossario.
- 2026-11-23: Marcas de Pacto: o **painel de gerenciamento é só do mestre** e a tela do jogador (Marca, anotações, enigmas) segue como antes; o mestre pode **ocultar** a extensão dos jogadores (`mesas/{id}/extensoesNativas`, padrão visível; `itensNativos` e `ExtensoesContext` por papel). Páginas: extensoes, marcas-de-pacto, permissoes-e-seguranca, arquitetura, navegacao-e-busca, diario-do-jogador, glossario.
- 2026-11-23: manutenção automática da base: regra `.claude/rules/base-conhecimento.md`, skill `atualizar-base-conhecimento` e hook `Stop` (`.claude/hooks/verificar-base-conhecimento.mjs`, configurado em `.claude/settings.json`).
- 2026-11-23: criação da base de conhecimento (visão geral, arquitetura, permissões, glossário, 19 features, 6 fluxos). Páginas do workspace com `instant = false` (sessão, extensões); `docs/` reorganizado em `planejamento/`, `temp/`, `rpg-especifico/`.
