import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
