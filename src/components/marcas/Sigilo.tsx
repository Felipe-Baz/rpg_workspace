// Sigilo original e determinístico, derivado só do índice da Marca. SVG inline: nenhuma imagem remota.

function rng(seed: number) {
  let s = (seed + 1) * 2654435761;
  return () => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return (s % 10000) / 10000;
  };
}

export default function Sigilo({ index, size = 120, className }: { index: number; size?: number; className?: string }) {
  const r = rng(index * 97 + 13);
  const rays = 5 + (index % 8); // 5..12
  const tip = index % 3; // 0 círculo, 1 losango, 2 triângulo
  const inner = 3 + Math.floor(r() * 5);
  const rot = r() * 360;
  const rOuter = 44;
  const rRing = 30 + Math.floor(r() * 6);
  const rCore = 8 + Math.floor(r() * 6);
  const broken = Math.floor(r() * rays); // um raio "partido"
  const ringGap = 0.6 + r() * 1.2;

  const pt = (ang: number, rad: number): [number, number] => [
    50 + Math.cos(ang) * rad,
    50 + Math.sin(ang) * rad,
  ];
  const f = (n: number) => n.toFixed(2);

  const items = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2;
    const len = i === broken ? rOuter - 14 : rOuter - 4;
    const [x1, y1] = pt(a, rRing);
    const [x2, y2] = pt(a, len);
    const [tx, ty] = pt(a, len + 3);
    let tipEl;
    if (tip === 0) tipEl = <circle cx={f(tx)} cy={f(ty)} r="2" />;
    else if (tip === 1) {
      const p = [pt(a, len + 6), pt(a + 0.12, len + 2), pt(a, len - 2), pt(a - 0.12, len + 2)];
      tipEl = <polygon points={p.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")} />;
    } else {
      const p = [pt(a, len + 6), pt(a + 0.14, len), pt(a - 0.14, len)];
      tipEl = <polygon points={p.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")} />;
    }
    return (
      <g key={i}>
        <line x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />
        {tipEl}
      </g>
    );
  });

  const poly = Array.from({ length: inner }, (_, i) => {
    const [x, y] = pt((i / inner) * Math.PI * 2 - Math.PI / 2, rRing - 6);
    return `${f(x)},${f(y)}`;
  }).join(" ");

  const dash = `${f(ringGap * 6)} ${f(ringGap * 2)}`;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-hidden="true">
      <g transform={`rotate(${f(rot)} 50 50)`} fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="50" cy="50" r={rRing} fill="none" strokeDasharray={dash} />
        <circle cx="50" cy="50" r={rOuter} fill="none" strokeWidth="0.5" opacity="0.5" />
        <polygon points={poly} fill="none" strokeWidth="0.9" />
        {items}
        <circle cx="50" cy="50" r={rCore} fill="none" />
        <circle cx="50" cy="50" r="2.5" />
      </g>
    </svg>
  );
}
