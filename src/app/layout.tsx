import { Suspense } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import RequireAuth from "@/components/RequireAuth";
import { DialogosProvider } from "@/components/ui/Dialogos";
import { ToastHost } from "@/components/ui/Toasts";
import OfflineAviso from "@/components/ui/OfflineAviso";

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
      <body className="min-h-full flex flex-col">
        <Script id="tema" strategy="beforeInteractive">{SCRIPT_TEMA}</Script>
        <AuthProvider>
          <Suspense fallback={null}>
            <DialogosProvider>
              <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white">Pular para o conteúdo</a>
              <RequireAuth>{children}</RequireAuth>
              <ToastHost />
              <OfflineAviso />
            </DialogosProvider>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
