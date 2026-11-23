# Arquitetura

## Camadas

```
Navegador (React, componentes "use client")
   │  onSnapshot / writes (SDK Firebase, sob as regras do Firestore)
   ▼
Firestore + Storage  ◄── regras: firestore.rules, storage.rules
   ▲
   │  Admin SDK (só servidor)
Rotas de servidor  /api/ia/*  e  /api/saude   (Next route handlers)
   │  chaves cifradas do mestre → provedores externos (Google, Anthropic)
   ▼
Provedores de IA
```

- **Cliente fala direto com o Firestore** para tudo que é CRUD de mesa/conteúdo. É rápido, em tempo real, e as regras garantem o acesso.
- **Servidor só entra quando precisa de segredo ou de poder extra**: chamar IA com a chave do mestre, gravar contadores de uso, rodar `sharp`, escrever em coleções que o cliente não pode (`uso`, `jobs`, `assetsPublicos`).

## Estrutura de pastas (`src/`)

| Pasta | Conteúdo |
|---|---|
| `app/` | Rotas (App Router). `mesas/[id]/(workspace)/*` = visão do mestre; `mesas/[id]/jogador/*` = visão do jogador; `api/` = rotas de servidor; `login`, `configuracoes/ia`, `marcas` (redireciona). |
| `components/shell/` | Casca: `ShellMesa` (mestre), `ShellJogador`, `ShellBase` (sidebar+topbar), `navegacao.ts`, `PaletaComandos` (Ctrl+K), `Slot` (encaixes), contextos (`MesaContext`, `ExtensoesContext`). |
| `components/telas/` | Uma tela por ferramenta (Mapas, Fichas, Missões…); `TelasJogador` agrupa as de leitura. |
| `components/dashboard/` | Lista de mesas, wizard de nova mesa, entrar por código. |
| `components/mapas/` | Mapas do mestre/jogador, visor, coberturas, e `cena/` (editor, chat IA, assets, temas, exportar). |
| `components/extensoes/` | Criador (chat + prévia + permissões), `Sandbox` (iframe e ponte `postMessage`), painel. O atendimento de `RPG.ler` fica em `lib/extensoes/broker.ts` (Firestore, cliente) e `broker-puro.ts` (exemplo, limites; puro). |
| `components/marcas/` | Extensão nativa Marcas de Pacto. |
| `components/sessao/`, `quadro/`, `fichas/`, `ui/` | Peças de sessão ao vivo, quadro, fichas, diálogos/toasts/skeletons. |
| `lib/` | Dados e regras. Arquivos de domínio (`mesas`, `fichas`, `missoes`, `mundo`, `mapas`, `quadro`, `marcas`), `cena/` (modelo, comandos, render, vtt), `extensoes/`, `mapas-ia/` (provedores, agente, assets, temas, conversão), `servidor/` (admin, auth, cifra, ia, assets, conversão, imagem). |
| `content/` | Conteúdo padrão (lore de Valgreth). |

Regra de ouro: `lib/` mistura dois tipos de arquivo. Os que têm hooks `use…` + Firestore são **cliente** (`"use client"`). Os de `lib/servidor/` têm `import "server-only"`. Os módulos **puros** (cena, comandos, agente, manifesto, limites, paleta…) não importam React nem Firebase.

## Modelo de dados (Firestore)

```
mesas/{mesaId}                       Mesa: nome, sistema, cor, status, donoUid, membros[], codigo,
                                      jogadores[] (embutido), sessoes[] (embutido)
  ├─ segredos/mestre                  segredosMestre, notasSessoes, notasJogadores   (só mestre)
  ├─ anotacoes/{uid}                  diário privado do jogador
  ├─ pinos/{uid}                      pinos privados do jogador nos mapas
  ├─ mapas/{id}  imagens/{id}         imagem (data URL ou Storage), todos, liberadoPara[], cobertas, zonas, cenaId?
  ├─ cenas/{id}                       Cena (camadas, objetos, grid); acima do limite vai JSON no Storage (jsonUrl)
  ├─ assets/{id}  temas/{id}          biblioteca da mesa; estilos (só mestre)
  ├─ jobs/{id}                        geração de assets em andamento (servidor escreve)
  ├─ uso/ usoRegistros/               contadores e teto de IA (servidor escreve)
  ├─ mundo/{doc}                      lore público (JSON validado)
  ├─ missoesMestre/{id}               missão completa (só mestre)
  ├─ missoes/{id}                     visão pública derivada (sem etapas pendentes/notas)
  ├─ missoesImagens/{id}              ilustrações das missões
  ├─ fichas/{id}                      privadas do jogador OU do mestre (mestre:true) liberáveis
  ├─ quadro/{noId}                    quadro de investigação do jogador
  ├─ extensoes/{id}                   extensões instaladas (cópia do HTML)
  ├─ extensoesNativas/{idNativa}      liberação de extensões nativas aos jogadores (mestre grava, membros leem)
  └─ Marcas: players, assignments, notes, lore, puzzles, released, puzzleResp, puzzleStatus
convites/{codigo}                    código → mesa (get por código exato; sem listar)
extensoes/{id}                       biblioteca do mestre (donoUid; reaproveitável entre mesas)
assetsPublicos/{id}                  assets gerados, legíveis por qualquer usuário logado
usuarios/{uid}/...                   config de IA e chaves cifradas (NINGUÉM no cliente lê/escreve)
```

**Embutidos de propósito:** `jogadores[]` e `sessoes[]` ficam no documento da mesa (poucos itens, lidos sempre juntos, um único listener). As regras limitam como um jogador pode alterar `jogadores` (assumir ou criar o próprio personagem).

## Tempo real e salvamento

- Hooks `use*` em `lib/` abrem `onSnapshot` e devolvem estado já em tempo real.
- **Salvamento automático com debounce (~600 ms)** para a mesa (`atualizarMesa`) e documentos sincronizados (`useDocSincronizado`): o usuário não clica em "salvar".
- Dados de uso de sessão que não precisam de nuvem (rolagens, iniciativa, notas rápidas) vão para o `localStorage` via `lib/persistido.ts`; "vistos" (aviso de novidade) via `lib/vistos.ts`.

## Imagens: onde ficam

- **Mapas/imagens antigos e sem Storage**: data URL comprimido dentro do documento (limite ≈ 900 KB; `comprimirImagem` reduz e recomprime).
- **Com Storage configurado**: arquivo no Firebase Storage, documento guarda a URL. Cenas grandes guardam o JSON no Storage (`jsonUrl`).
- `GET /api/saude` diz se Storage/Admin estão configurados, sem expor valores.

## Rotas de servidor (`/api/ia/*`)

Todas exigem `Authorization: Bearer <ID token>` (`verificarToken`) e, para ações da mesa, `exigirMestre` (uid == `donoUid`). Jogador recebe 403.

| Rota | Função |
|---|---|
| `config` | Lê/grava provedores ativos, campos e segredos. Nunca devolve chave (só "configurada" e 4 últimos caracteres). |
| `testar` | Chamada mínima ao provedor para validar a chave. |
| `uso` | Uso do período e teto por mesa (GET/PUT). |
| `gerar` | Geração genérica de imagem ou LLM, com teto e confirmação. |
| `gerar-asset` | Cria job, responde 202 e processa depois; cliente acompanha por `onSnapshot` em `jobs`. |
| `analisar-tema` | LLM com visão propõe um perfil de estilo a partir de texto/imagens (não salva). |
| `agente` | Agente criador de mapas, resposta em streaming NDJSON. |
| `segmentar` | Detecta objetos de um mapa de imagem (máscaras sugeridas). |
| `inpaint` | Reconstrói o fundo e recorta sprites para a conversão em cena. |
| `extensao` | Gera/edita o HTML de uma extensão. |
| `saude` | Diagnóstico de configuração. |

## Segredos e chaves

- A chave de IA é **do mestre** (não da plataforma): custo e responsabilidade dele.
- Guardada em `usuarios/{uid}/segredos/{credencial}` cifrada com **AES-256-GCM** (mestra em `IA_CHAVE_MESTRA` do ambiente, 32 bytes base64). O cliente não tem acesso à coleção `usuarios`.
- Variáveis: ver `.env.template` (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_CREDENTIALS`, chave mestra). Nunca `NEXT_PUBLIC_` para segredos.

## Padrões de código recorrentes

- **Contexto da mesa:** `ShellMesa` valida (existe + é dono) e fornece `MesaProvider`; telas leem com `useMesaAtual()`. Fora do shell ele lança erro, por isso as páginas do workspace usam `instant = false`.
- **Comandos reversíveis na cena:** toda mutação é um `Comando` com inverso; o editor, o histórico e a IA usam o mesmo mecanismo.
- **Registro de provedores/perspectivas/extensões nativas:** adicionar = um arquivo + uma linha (`registro.ts`, `nativas.ts`).
- **Validação na borda:** JSON do mestre (Mundo), resposta de IA (tema, extensão), argumentos de ferramentas do agente e manifestos são normalizados/validados antes de entrar no sistema.
- **Dialogs e toasts** próprios (`ui/Dialogos`, `ui/Toasts`) no lugar de `window.confirm/prompt`.

## Testes e scripts

- `npm test` roda os `*.test.ts` de `src/lib` (Node, sem navegador).
- `scripts/`: validações manuais com chave real (`validar-gemini`, `validar-assets`, `validar-conversao`), `aplicar-cors.mjs` (Storage), `gerar-lore.py`.
- OpenSpec (`openspec/`): changes numeradas por fase; specs consolidadas em `openspec/specs/`.
