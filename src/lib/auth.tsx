"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";
import { definirUsuario } from "./mesas";

type Ctx = { user: User | null; carregando: boolean };
const AuthCtx = createContext<Ctx>({ user: null, carregando: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Ctx>({ user: null, carregando: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        definirUsuario(user?.uid ?? null);
        setState({ user, carregando: false });
      }),
    [],
  );

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const entrarComEmail = (email: string, senha: string) =>
  signInWithEmailAndPassword(auth, email, senha);

export async function criarConta(nome: string, email: string, senha: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
}

export const entrarComGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());

export const sair = () => fbSignOut(auth);

export const redefinirSenha = (email: string) => sendPasswordResetEmail(auth, email);

export function mensagemErro(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  const mapa: Record<string, string> = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/operation-not-allowed": "Este método de login não está habilitado no Firebase.",
  };
  return mapa[code] ?? "Não foi possível autenticar. Tente novamente.";
}
