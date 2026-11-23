# Marcas de Pacto (extensão nativa)

## O que é
Módulo da campanha **"O Juramento de Cinzas"**: cada jogador recebe uma **Marca** (poder obtido ao vender algo de si) com mecânica secreta, anotações próprias e **enigmas** liberados em etapas pelo mestre. É uma **extensão nativa exclusiva** da mesa `MESA_PADRAO`.

> Esta página descreve o **sistema**. O conteúdo (lore e gabaritos) é spoiler e fica fora do repositório público: `docs/rpg-especifico/` e os JSONs em `.gitignore`.

## Por que existe
Mostrar que extensões podem alterar a experiência da mesa por inteiro (tema sombrio próprio, progressão por enigmas) sem tocar no núcleo. Começou como app fixo; virou extensão (**Fase E0**) para exercitar os encaixes e para não vazar em outras mesas.

## Como funciona
- **Dados públicos (`marcas-data.ts`):** lista de Marcas com `id`, nome, "o que foi vendido" e indicação de build. Seguros para ir no código (visíveis ao jogador por design).
- **Dados secretos (`lore/{markId}`, `puzzles/{markId}`):** mecânica real e banco completo de enigmas com gabarito. **Só o mestre** lê/escreve.
- **Fluxo do jogador:** ao entrar na tela, registra-se (`players/{uid}`); o mestre **atribui uma Marca** (`assignments/{uid}`); o jogador lê só a própria, escreve **anotações** (`notes/{uid}`) e responde enigmas (`puzzleResp/{uid}`).
- **Enigmas por etapas:** o mestre libera etapas (`released/{uid}`, sem gabarito); o jogador responde; o mestre dá o **veredito** `aprovada`/`recusada` (`puzzleStatus/{uid}`). Hash síncrono (`cyrb53`) impede a solução de aparecer em texto puro para o jogador (não é criptografia).
- **Encaixes usados:** sidebar do mestre e do jogador (etiqueta "Extensão"), seção no **Meu diário**, cartão em Extensões e Ctrl+K. Para o jogador, dependem de o mestre não ter ocultado a extensão.
- **Gerenciamento só do mestre; anotações do jogador como sempre:** `PainelMestre` (lista de todas as Marcas, atribuição, lore, enigmas e vereditos) é exclusivo do mestre. O jogador com Marca atribuída usa `VisaoJogadorMarca` (a própria Marca, anotações e enigmas) normalmente.
- **Ocultar dos jogadores (opcional):** o mestre pode ocultar a extensão toda dos jogadores no cartão em Extensões (config em `mesas/{id}/extensoesNativas/marcas-de-pacto`); por padrão eles a veem. Oculta, a rota do jogador mostra "Indisponível no momento" e os dados dele (Marca, notas, respostas) são preservados.
- **Visual:** conteúdo isolado em `MarcasFrame` com tema sombrio (`marcas.css`), dentro do shell normal (sidebar, topbar, Ctrl+K da mesa).
- **Rotas:** `/mesas/{id}/marcas` (mestre) e `/mesas/{id}/jogador/marcas`; `/marcas` redireciona para a mesa padrão.

## Regras e limites
- Em qualquer outra mesa: some da sidebar e do diário e a rota mostra "Extensão indisponível".
- O painel de gerenciamento é só do mestre: a rota `/mesas/{id}/marcas` exige ser o dono, e o gabarito (`lore`, `puzzles`) nunca chega ao cliente do jogador (regras do Firestore).
- Gabarito jamais vai ao cliente de jogador (regras do Firestore).
- Limite conhecido: o bloqueio por mesa e pela liberação é de **interface**; as regras das coleções das Marcas ainda deixam qualquer membro ler/gravar o que já permitiam (ver [extensoes](extensoes.md)).

## Onde está no código
`src/lib/marcas.ts`, `marcas-data.ts`, `marcas-const.ts`, `puzzle-util.ts`, `src/lib/extensoes/nativas.ts`, `src/components/marcas/*` (MarcasApp, PainelMestre, VisaoJogadorMarca, Enigmas*), `src/components/telas/TelaMarcas.tsx`, `scripts/gerar-lore.py`.

## Relações
[extensoes](extensoes.md), [diario-do-jogador](diario-do-jogador.md), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
