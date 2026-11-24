# Navegação e busca

## O que é
O "shell" do workspace: sidebar agrupada, topbar, atalho de sessão, troca entre visão de mestre e de jogador, e a **busca global Ctrl/⌘+K**.

## Por que existe
Dois eixos separados: o seletor de mesa (cabeçalho) nunca se mistura com as ferramentas (corpo da sidebar). Os grupos (Mundo / Jogo / Extensões) permitem crescer sem redesenhar a navegação. O mestre tem muitas ferramentas; o jogador vê um subconjunto enxuto.

## Como funciona
- `ShellMesa` (mestre): valida que o usuário é dono, fornece `MesaProvider` e monta `gruposNav`. Destaque fixo "Iniciar sessão" (→ sessão ao vivo). Rodapé: Configurações e "Ver como jogador".
- `ShellJogador`: exige ser membro; sem personagem mostra `EscolherPersonagem`; `gruposNavJogador` mostra Mapas, Imagens, Mundo, Quadro, Missões e Fichas (o que o mestre liberou). O dono pode "Ver como mestre".
- **Grupos do mestre:** Mundo (Mapas, Imagens, Mundo); Jogo (Missões, fichas por categoria, Jogadores, Sessões, Segredos, Timeline); Extensões (instaladas + "Gerenciar extensões"). "Visão geral" é o início.
- **Menu moldado por extensões (E5):** `ShellBase` filtra e renomeia os itens com a chave (`ItemNav.chave`) conforme `ocultar`/`termos` dos efeitos combinados; tipos de recurso entram no grupo Extensões (`/recursos/{extId}/{recId}`). A busca Ctrl+K usa o mesmo menu já filtrado.
- **Extensões na sidebar** entram pelo encaixe `sidebar`, com etiqueta "Extensão"; as nativas vêm de `itensNativos(mesaId, rota, config, verTudo)`: o mestre sempre vê; o jogador as vê, salvo se o mestre as ocultou (`extensoesNativas`). A rota da nativa fica dentro do shell do papel (`/mesas/{id}/marcas` ou `/mesas/{id}/jogador/marcas`).
- **Ctrl+K (`PaletaComandos`):** ferramentas, ações, outras mesas e conteúdo (fichas, mapas, imagens). O conteúdo só carrega enquanto a paleta está aberta, para não gastar leituras.
- **Contextos:** `MesaContext` (mesa validada), `ExtensoesContext` (extensões já filtradas por papel). `Slot` renderiza painéis de extensão em encaixes inline.
- **UI compartilhada:** `ui/Dialog`, `Dialogos` (`confirmar`/`perguntar` em Promise), `Toasts`, `Skeleton`.

## Regras e limites
- A mesa nunca é trocada pelo menu de ferramentas.
- Páginas do workspace exportam `instant = false`: dependem do `MesaContext`, e a validação de navegação instantânea as renderiza fora do shell (sem `instant = false` o Next avisa "dropped from rendering").

## Onde está no código
`src/components/shell/*`, `src/components/ui/*`, `src/app/mesas/[id]/(workspace)/layout.tsx`, `jogador/layout.tsx`.

## Relações
[extensoes](extensoes.md), [liberacao-de-conteudo](liberacao-de-conteudo.md).
