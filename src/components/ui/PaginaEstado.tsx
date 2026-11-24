import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/** Tela cheia para estados de exceção (404, erro, sem permissão...). */
export default function PaginaEstado({
  codigo,
  titulo,
  texto,
  detalhe,
  acoes,
  topo,
  children,
}: {
  codigo: string;
  titulo: string;
  texto: string;
  detalhe?: string;
  acoes?: ReactNode;
  topo?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main id="conteudo" className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <Brasas />
      <div className="relative w-full max-w-xl text-center">
        {topo}
        <p className="mt-2 font-[family-name:var(--font-cinzel)] text-7xl font-bold text-gold">{codigo}</p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{titulo}</h1>
        <p className="mt-2 text-sm text-muted">{texto}</p>
        {detalhe && (
          <p className="mt-3 break-words rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-muted">
            {detalhe}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {acoes ?? <LinkInicio />}
        </div>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </main>
  );
}

const BTN_PRIMARIO = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover";
const BTN_SECUNDARIO = "rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-card-2";

export const estilosBotao = { primario: BTN_PRIMARIO, secundario: BTN_SECUNDARIO };

export function LinkInicio() {
  return (
    <>
      <Link href="/mesas" className={BTN_PRIMARIO}>Ir para minhas mesas</Link>
      <Link href="/" className={BTN_SECUNDARIO}>Página inicial</Link>
    </>
  );
}

const BRASAS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7.3 + 4) % 100}%`,
  size: 2 + (i % 3),
  dur: `${7 + (i % 5) * 1.6}s`,
  delay: `${-(i * 1.3)}s`,
  dx: `${(i % 2 ? 1 : -1) * (14 + (i % 4) * 8)}px`,
}));

function Brasas() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {BRASAS.map((b, i) => (
        <span
          key={i}
          className="brasa"
          style={{ left: b.left, width: b.size, height: b.size, "--dur": b.dur, "--delay": b.delay, "--dx": b.dx } as CSSProperties}
        />
      ))}
    </div>
  );
}
