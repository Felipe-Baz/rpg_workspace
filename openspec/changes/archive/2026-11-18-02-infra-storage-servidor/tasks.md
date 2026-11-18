## 1. Configuração do projeto

- [X] 1.1 Migrar o projeto Firebase para Blaze e configurar alerta de orçamento
- [X] 1.2 Habilitar o Storage e criar `storage.rules`
- [X] 1.3 Atualizar `.env.local.example` e README com as variáveis novas

## 2. Servidor

- [X] 2.1 Ler o guia de route handlers em `node_modules/next/dist/docs/`
- [X] 2.2 Adicionar `firebase-admin` e `src/lib/servidor/admin.ts`
- [X] 2.3 Implementar `verificarToken` e `exigirMestre` em `src/lib/servidor/auth.ts`
- [X] 2.4 Criar `src/app/api/saude/route.ts`

## 3. Cliente

- [X] 3.1 Criar `src/lib/storage.ts` (upload, URL, exclusão)
- [X] 3.2 Usar Storage em `MapasMestre` quando configurado, mantendo fallback para data URL
- [X] 3.3 Excluir o arquivo do Storage ao excluir o mapa

## 4. Verificação

- [X] 4.1 Testar regras do Storage (mestre, jogador, fora da mesa) no emulador
- [X] 4.2 Testar rotas com e sem token e com jogador
- [X] 4.3 Verificar que mapas antigos e coberturas seguem funcionando
