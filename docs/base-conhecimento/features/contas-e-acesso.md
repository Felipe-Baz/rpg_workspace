# Contas e acesso

## O que é
Login e cadastro com **e-mail/senha** ou **Google**, redefinição de senha, e proteção das rotas que exigem usuário logado.

## Por que existe
Todo dado pertence a uma mesa e o acesso é decidido por `uid` (dono/membro). Sem identidade não há permissões. O cadastro é **único para mestre e jogador**: o papel nasce por mesa, não por conta.

## Como funciona
- `AuthProvider` (`lib/auth.tsx`) escuta `onAuthStateChanged`, expõe `useAuth()` (`user`, `carregando`) e avisa `lib/mesas.ts` (`definirUsuario`) para abrir/fechar o listener das mesas do usuário.
- Funções: `entrarComEmail`, `criarConta` (grava `displayName`), `entrarComGoogle`, `sair`, `redefinirSenha`. `mensagemErro` traduz códigos do Firebase para português (credencial errada e usuário inexistente dão a mesma mensagem, para não revelar se o e-mail existe).
- Rotas: `/` (landing), `/login`, `/mesas` (dashboard). Telas de mesa mostram esqueleto de carregamento enquanto a sessão é verificada.
- Servidor: `verificarToken` valida o ID token (`Authorization: Bearer`).

## Regras e limites
- Senha mínima: 6 caracteres (regra do Firebase).
- Trocar de usuário limpa o cache e os debounces pendentes de mesas.

## Onde está no código
`src/lib/auth.tsx`, `src/components/Login.tsx`, `src/components/landing/`, `src/lib/servidor/auth.ts`.

## Relações
[mesas-e-convites](mesas-e-convites.md), [permissoes-e-seguranca](../permissoes-e-seguranca.md).
