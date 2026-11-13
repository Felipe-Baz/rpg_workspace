"use client";

import type { MecanicaLiberada } from "@/lib/marcas-data";
import { confere } from "@/lib/puzzle-util";
import { Escolha, Espera, Fragmentos, Relogio, Runas } from "./mecanicas-acao";
import { Cifra, Lanterna, Morse, Rastros } from "./mecanicas-texto";

/** Escolhe o puzzle certo para a etapa. `onConcluir` recebe o valor que a resolveu. */
export default function Mecanica({ m, onConcluir }: { m: MecanicaLiberada; onConcluir: (valor: string) => void }) {
  const valida = (v: string) => confere(m, v);
  switch (m.tipo) {
    case "cifra": return <Cifra m={m} valida={valida} concluir={onConcluir} />;
    case "lanterna": return <Lanterna m={m} valida={valida} concluir={onConcluir} />;
    case "rastros": return <Rastros m={m} valida={valida} concluir={onConcluir} />;
    case "morse": return <Morse m={m} valida={valida} concluir={onConcluir} />;
    case "fragmentos": return <Fragmentos m={m} valida={valida} concluir={onConcluir} />;
    case "relogio": return <Relogio m={m} valida={valida} concluir={onConcluir} />;
    case "runas": return <Runas m={m} valida={valida} concluir={onConcluir} />;
    case "escolha": return <Escolha m={m} valida={valida} concluir={onConcluir} />;
    case "espera": return <Espera m={m} valida={valida} concluir={onConcluir} />;
  }
}
