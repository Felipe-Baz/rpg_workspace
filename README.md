# RPGWorkspace

Plataforma web para **mestres e jogadores de RPG de mesa** organizarem uma campanha: mesas, fichas, missões, lore do mundo, mapas, sessões ao vivo e anotações — com **mapas criados com apoio de IA** e **extensões** (mini-apps gerados por IA que mudam o que a mesa mostra).

Em uma frase: *o mestre libera, o jogador lê.* Quase todo conteúdo nasce oculto e só chega ao jogador quando o mestre decide, o que protege spoilers por construção.

## Principais recursos

- **Contas e mesas**: login (e-mail/senha ou Google), criação de mesa e convite por código. O papel (mestre/jogador) é **por mesa**, não por conta.
- **Campanha**: fichas (NPCs, inimigos, itens), missões com etapas ocultas, lore do Mundo, sessões com resumo público e notas secretas, linha do tempo do mestre.
- **Ficha de D&D 5e** automatizada (rolagens mostradas como conta, espaços de magia, descansos).
- **Sessão ao vivo**: rolador de **dados 3D** visto por todos os online, iniciativa, cronômetro e notas rápidas.
- **Jogador**: diário privado, quadro de investigação e pinos privados nos mapas.
- **Mapas e imagens**: upload, coberturas (fog) reveladas pelo mestre, mapas de **cena** em camadas com editor (PixiJS) e exportação para VTT (`.dd2vtt` / `.uvtt`).
- **IA para mapas**: o mestre usa a **própria chave** (Google/Anthropic) para gerar assets, definir o estilo da mesa, conversar com um agente que monta a cena ou converter uma imagem pronta em cena editável — com teto de gasto por mesa/mês.
- **Extensões**: mini-apps em iframe isolado que se encaixam em telas do app. **Marcas de Pacto** é uma extensão nativa exclusiva da campanha *O Juramento de Cinzas*.
- **Minijogo** de caça-corvos nas telas de erro/404/offline, com ranking global.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Firebase (Auth, Firestore, Storage, Admin SDK) · PixiJS · three.js + cannon-es (dados 3D) · `sharp` · `react-markdown`.

> **Atenção:** esta versão do Next.js tem mudanças de API. Antes de escrever código de rota/componente, consulte `node_modules/next/dist/docs/` (veja `AGENTS.md`).

## Como rodar

Pré-requisitos: Node.js 20+ e um projeto Firebase (Auth, Firestore e Storage habilitados).

```bash
npm install
cp .env.template .env.local   # preencha os valores
npm run dev                   # http://localhost:3000
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes (`node --test` em `src/lib/**/*.test.ts`) |

### Variáveis de ambiente

Veja `.env.template` (nunca versione `.env`/`.env.local`):

- `NEXT_PUBLIC_FIREBASE_*`: configuração do SDK web do Firebase (cliente).
- `FIREBASE_ADMIN_CREDENTIALS`: JSON da conta de serviço em **uma linha**; só servidor, nunca com prefixo `NEXT_PUBLIC_`.
- `IA_CHAVE_MESTRA`: 32 bytes em base64 que cifra as chaves de IA dos mestres. Trocá-la invalida as chaves já salvas.
- `GOOGLE_API_KEY`, `GEMINI_MODELO`, `SEM_LLM`, `SO` (opcionais): só para os scripts `scripts/validar-*.ts`.

### Firebase: Storage e regras

- Requer o plano **Blaze** (configure um alerta de orçamento) e o **Storage** habilitado.
- Publique as regras: `firebase deploy --only firestore,storage` (arquivos `firestore.rules` e `storage.rules`).
- CORS do bucket: `scripts/aplicar-cors.mjs` com `storage-cors.json`.
- `GET /api/saude` informa `{ storage, admin }` sem expor valores.
- Sem Storage configurado, mapas continuam usando data URL (~900 KB); mapas antigos seguem funcionando.
- Limite conhecido: a leitura no Storage é aberta a membros da mesa; quem obtiver a URL de um mapa não liberado consegue abri-la (os nomes são aleatórios).

## Estrutura do repositório

```
src/
  app/          Rotas (App Router): mesas/[id]/(workspace) = mestre, mesas/[id]/jogador = jogador, api/ = servidor
  components/   shell (sidebar, Ctrl+K), telas, mapas/cena, extensões, marcas, sessão, ui
  lib/          Regras e dados: domínio, cena, extensões, mapas-ia, servidor (server-only)
  content/      Conteúdo padrão
firestore.rules / storage.rules   Barreira real de segurança
scripts/        Utilitários (CORS, seed de sistemas, validações de IA)
docs/           Base de conhecimento, planejamento e referências
openspec/       Specs e mudanças (fluxo OpenSpec)
.claude/        Regras, hooks e skills para agentes
```

Princípios: segurança por estrutura (regras do Firestore/Storage, não esconder botões), regras de negócio em **módulos puros** em `src/lib/` (testáveis em Node), IA opcional e substituível por interfaces, e custo previsível.

## Documentação

A **base de conhecimento** em [`docs/base-conhecimento/`](docs/base-conhecimento/README.md) é o melhor ponto de partida: visão geral, arquitetura, modelo de dados, permissões e uma página por feature e fluxo. Ela é mantida junto com o código (regra em `.claude/rules/base-conhecimento.md`).

- [Visão geral](docs/base-conhecimento/visao-geral.md)
- [Arquitetura](docs/base-conhecimento/arquitetura.md)
- [Permissões e segurança](docs/base-conhecimento/permissoes-e-seguranca.md)
- [Glossário](docs/base-conhecimento/glossario.md)

Specs de cada capacidade ficam em `openspec/specs/`.

## Licença

MIT. Veja [LICENSE](LICENSE).
