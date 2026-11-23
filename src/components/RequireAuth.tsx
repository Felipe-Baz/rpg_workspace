"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

// Rotas abertas a visitantes: a landing page e o login.
const PUBLICAS = ["/", "/login"];

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, carregando } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publica = PUBLICAS.includes(pathname);

  useEffect(() => {
    if (!carregando && !user && !publica) router.replace("/login");
  }, [carregando, user, publica, router]);

  if (publica) return <>{children}</>;
  if (carregando || !user) return null;
  return <>{children}</>;
}
