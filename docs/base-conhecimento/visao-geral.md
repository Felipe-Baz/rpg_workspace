# Visão geral

## O que é

**RPGWorkspace** é uma plataforma web para mestres e jogadores de RPG de mesa organizarem uma campanha: mesas, jogadores, fichas, missões, lore do mundo, mapas, sessões e anotações. Diferenciais: **mapas criados com apoio de IA** (cenas editáveis, não só imagens) e **extensões** (mini-apps criados com IA que mudam o que a mesa mostra).

Inspiração de UX: ferramentas de criador como o World Anvil (sidebar fixa, canvas grande), mas separando *onde estou* (mesa) de *qual ferramenta uso*.

## Pessoas e papéis

| Papel | Definição | Observação |
|---|---|---|
| **Mestre** | Dono da mesa (`donoUid`) | Vê tudo, cria conteúdo e decide o que os jogadores veem. |
| **Jogador** | Membro da mesa (`membros`, sem ser dono) | Vê só o que o mestre libera, mais seu material privado (diário, pinos, quadro, fichas próprias). |

O papel é **por mesa, não por conta**: a mesma pessoa pode mestrar uma mesa e jogar em outra. Por isso o cadastro não pergunta "mestre ou jogador?".

## Ideia central: o mestre libera, o jogador lê

Quase todo conteúdo é do mestre e nasce **oculto**. O mestre libera para todos ou para jogadores específicos (mapas, imagens, fichas). Missões e Mundo seguem a mesma lógica com uma versão pública derivada. Isso protege spoilers por construção: o que não está no documento público **não vaza**. Ver [liberacao-de-conteudo](features/liberacao-de-conteudo.md).

## O que o produto faz (resumo)

1. **Contas e mesas**: login (e-mail/senha ou Google), criar mesa, convidar por código.
2. **Campanha**: fichas (NPCs, inimigos, pessoas importantes, itens), missões com etapas ocultas, Mundo (lore em JSON/Markdown), sessões com resumo público e notas secretas, Segredos.
3. **Mapas e imagens**: upload, coberturas que o mestre revela, pinos privados dos jogadores, mapas de **cena** (camadas + objetos) com editor.
4. **IA para mapas**: o mestre traz a **própria chave** (Google/Anthropic); gera assets, define o estilo da mesa, conversa com um agente que monta a cena, ou converte uma imagem pronta em cena.
5. **Sessão ao vivo**: rolador de dados, iniciativa, cronômetro, notas rápidas.
6. **Extensões**: mini-apps em iframe isolado; encaixam em telas do app. Marcas de Pacto é uma extensão nativa exclusiva de uma mesa.
7. **Exportação** de cenas para VTTs (Universal VTT).

## Stack

Next.js 16 (App Router, `cacheComponents` + `partialPrefetching`), React 19, TypeScript, Tailwind 4, Firebase (Auth, Firestore, Storage, Admin SDK nas rotas de servidor), PixiJS (editor de cena), `sharp` (imagem no servidor), `react-markdown`. Testes: `node --test` em `src/lib/**/*.test.ts` (módulos puros).

> **Atenção (Next 16):** a versão tem mudanças de API. Antes de escrever código de rota/componente, consultar `node_modules/next/dist/docs/` (regra do `AGENTS.md`). Páginas que dependem do contexto da mesa exportam `export const instant = false;` para o validador de navegação instantânea.

## Princípios que guiam as decisões

- **Segurança por estrutura, não por UI.** Regras do Firestore/Storage e rotas de servidor são a barreira real; esconder botão não conta. Ver [permissoes-e-seguranca](permissoes-e-seguranca.md).
- **Módulos puros primeiro.** Regras de negócio (cena, comandos, agente, limites, manifesto) vivem em `src/lib/` sem React/Firebase/Pixi, para serem testáveis em Node.
- **IA é opcional e substituível.** Núcleo só conhece interfaces (`ProvedorImagem`, `ProvedorLlm`, `Segmentador`); adicionar fabricante = um arquivo + uma linha no registro.
- **Custo previsível.** Chave do mestre, teto de gerações por mesa/mês, estimativa e confirmação antes de lotes.
- **Compatibilidade.** Mapa de cena é um mapa de imagem com cena anexada; remover a cena deixa um mapa de imagem válido.
- **Extensões são cidadãs de primeira classe**, não um "add-on" escondido.

## Estado atual (resumo)

- Mapas com IA: fases 01–08 concluídas (infra, editor, provedores, temas/perspectivas, biblioteca de assets, agente, conversão de imagem em cena e exportação VTT). Specs em `openspec/specs/`.
- Extensões: Fase E0 feita (Marcas de Pacto como nativa); encaixes `sidebar`, `diario.jogador`, `visao-geral`, `sessao.painel`, `ctrlk`. Broker de dados da mesa, eventos e temas por extensão ainda são **planejamento** (`docs/planejamento/plano-plataforma-de-extensoes.md`).
- Redesign de UX (shell com sidebar agrupada, dashboard de mesas, Ctrl+K, toasts/diálogos) em andamento na branch `feature/Melhorar-Design`.
