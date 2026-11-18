"use client";

import type { Cobertura } from "@/lib/mapas";

const pts = (c: Cobertura) => c.pontos.map((p) => `${p.x},${p.y}`).join(" ");

/**
 * Camada SVG (viewBox 0–1) a ser posta sobre a imagem, dentro de um container `relative`.
 * - "mostrar": áreas ocultas ficam pretas e opacas; as reveladas somem com fade.
 * - "editar": o mestre enxerga através das áreas, com contorno.
 */
export default function CamadaCobertura({
  cobertas,
  modo,
  selecionadaId,
  onSelecionar,
  onRevelarZona,
}: {
  cobertas?: Cobertura[];
  modo: "mostrar" | "editar";
  selecionadaId?: string | null;
  onSelecionar?: (id: string) => void;
  /** No modo "mostrar": duplo clique numa área oculta revela a zona inteira. */
  onRevelarZona?: (zonaId: string) => void;
}) {
  if (!cobertas?.length) return null;
  const editar = modo === "editar";

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {cobertas.map((c) =>
        editar ? (
          <polygon
            key={c.id}
            points={pts(c)}
            fill={c.revelada ? "#22c55e" : "#000"}
            fillOpacity={c.revelada ? 0.15 : 0.6}
            stroke={c.id === selecionadaId ? "#facc15" : c.revelada ? "#22c55e" : "#8b5cf6"}
            strokeWidth={c.id === selecionadaId ? 3 : 2}
            strokeDasharray={c.revelada ? "6 4" : undefined}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: onSelecionar ? "auto" : "none", cursor: "pointer" }}
            onClick={onSelecionar ? () => onSelecionar(c.id) : undefined}
          />
        ) : (
          <polygon
            key={c.id}
            points={pts(c)}
            fill="#000"
            stroke="#000"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{
              opacity: c.revelada ? 0 : 1,
              transition: "opacity 0.5s ease",
              pointerEvents: !c.revelada && onRevelarZona ? "auto" : "none",
            }}
            onDoubleClick={onRevelarZona ? () => onRevelarZona(c.zonaId) : undefined}
          />
        ),
      )}
    </svg>
  );
}
