## Why

O projeto usa apenas Firestore e guarda imagens como data URL de até ~900 KB dentro do documento. A feature de mapas com IA precisa de arquivos maiores (renders, sprites, referências) e de rotas de servidor que guardem segredos. Precisamos dessa base antes de qualquer recurso de IA.

## What Changes

- Migrar o projeto Firebase para o plano Blaze e habilitar o Firebase Storage.
- Adicionar `firebase-admin` e rotas de servidor (`app/api/...`) que validam o ID token do usuário.
- Criar regras do Storage com acesso por mesa (mestre escreve; membros leem).
- Permitir que mapas de imagem usem URL do Storage em vez de data URL, de forma opcional e sem quebrar os mapas existentes.
- Adicionar rota de saúde `/api/saude` para verificar a configuração.

## Capabilities

### New Capabilities
- `armazenamento-arquivos`: upload, leitura e exclusão de arquivos por mesa no Storage com controle de acesso.
- `rotas-servidor-autenticadas`: rotas de servidor que exigem usuário autenticado e verificam papel (mestre da mesa).

### Modified Capabilities

## Impact

- Novos: `src/lib/storage.ts`, `src/lib/servidor/auth.ts`, `src/app/api/saude/route.ts`, `storage.rules`.
- Atualiza configuração de deploy, `.env.local.example` e `README`.
- Dependência nova: `firebase-admin`.
- Mapas de imagem existentes continuam iguais (data URL aceita).
