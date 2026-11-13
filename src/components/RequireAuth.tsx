"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, carregando } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publica = pathname === "/login";

  useEffect(() => {
    if (!carregando && !user && !publica) router.replace("/login");
  }, [carregando, user, publica, router]);

  if (publica) return <>{children}</>;
  if (carregando || !user) return null;
  return <>{children}</>;
}
