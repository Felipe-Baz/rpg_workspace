import { Suspense } from "react";
import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import RequireAuth from "@/components/RequireAuth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

// Aplica o tema salvo antes da primeira pintura (evita "flash" claro). Padrão: escuro.
const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

// RequireAuth renders null until the client-side auth state loads, so page
// segments are never rendered during validation. Opt out of instant-navigation
// validation for this auth-gated app.
export const instant = false;

export const metadata: Metadata = {
  title: "RPG Workspace",
  description: "Gerencie suas mesas de RPG como mestre ou jogador",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Suspense fallback={null}>
            <RequireAuth>{children}</RequireAuth>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
