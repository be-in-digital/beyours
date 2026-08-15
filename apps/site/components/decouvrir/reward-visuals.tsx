/* ═══════════════════════════════════════════════
   Visuels de récompense premium
   - RewardSeal : médaillon or (remplace l'icône cadeau générique)
   - TicketQr   : QR code d'aspect authentique (finders, timing,
     alignment, modules arrondis sur fond blanc). Décoratif côté démo ;
     le vrai produit encode le code de retrait.
   ═══════════════════════════════════════════════ */

/** Chemin d'une étoile à N branches (Math.cos/sin : pur, OK au rendu). */
function starPath(cx: number, cy: number, outer: number, inner: number) {
  const points = 5;
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((-90 + i * (180 / points)) * Math.PI) / 180;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

export function RewardSeal({
  size = 84,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
    >
      <defs>
        <radialGradient id="seal-gold" cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.55" stopColor="#e8b74a" />
          <stop offset="1" stopColor="#a9791f" />
        </radialGradient>
        <radialGradient id="seal-inner" cx="42%" cy="34%" r="72%">
          <stop offset="0" stopColor="#f6d98c" />
          <stop offset="1" stopColor="#c8922e" />
        </radialGradient>
      </defs>
      {/* Disque principal */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="url(#seal-gold)"
        stroke="#8a6a1f"
        strokeWidth="1.5"
      />
      {/* Anneau pointillé */}
      <circle
        cx="50"
        cy="50"
        r="41"
        fill="none"
        stroke="#7a5c18"
        strokeWidth="1.6"
        strokeDasharray="1 3.4"
        opacity="0.55"
      />
      {/* Pastille intérieure */}
      <circle cx="50" cy="50" r="34" fill="url(#seal-inner)" />
      <circle
        cx="50"
        cy="50"
        r="34"
        fill="none"
        stroke="#fff6d8"
        strokeWidth="0.8"
        opacity="0.6"
      />
      {/* Étoile */}
      <path
        d={starPath(50, 49.5, 19, 7.6)}
        fill="#fffdf4"
        stroke="#9a7418"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Reflet */}
      <ellipse cx="39" cy="31" rx="21" ry="11" fill="#ffffff" opacity="0.18" />
    </svg>
  );
}

/* ── QR ── */

const N = 25;
const QUIET = 2;
const DARK = "#161019";

function reservedFinder(x: number, y: number) {
  return (
    (x < 8 && y < 8) ||
    (x >= N - 8 && y < 8) ||
    (x < 8 && y >= N - 8)
  );
}
function reservedAlign(x: number, y: number) {
  return x >= 16 && x <= 20 && y >= 16 && y <= 20;
}
function hash(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function Finder({ ox, oy }: { ox: number; oy: number }) {
  return (
    <g>
      <rect x={ox} y={oy} width={7} height={7} rx={1.7} fill={DARK} />
      <rect x={ox + 1} y={oy + 1} width={5} height={5} rx={1.2} fill="#ffffff" />
      <rect x={ox + 2} y={oy + 2} width={3} height={3} rx={0.85} fill={DARK} />
    </g>
  );
}

function Align({ ox, oy }: { ox: number; oy: number }) {
  return (
    <g>
      <rect x={ox} y={oy} width={5} height={5} rx={1.2} fill={DARK} />
      <rect x={ox + 1} y={oy + 1} width={3} height={3} rx={0.85} fill="#ffffff" />
      <rect x={ox + 2} y={oy + 2} width={1} height={1} rx={0.3} fill={DARK} />
    </g>
  );
}

export function TicketQr({
  size = 128,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const dots: [number, number][] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (reservedFinder(x, y) || reservedAlign(x, y)) continue;
      if (x === 6 || y === 6) {
        // pistes de synchronisation
        if ((x + y) % 2 === 0) dots.push([x, y]);
        continue;
      }
      if (hash(x, y) > 0.5) dots.push([x, y]);
    }
  }
  const total = N + QUIET * 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      className={className}
      shapeRendering="geometricPrecision"
      role="img"
      aria-label="QR code du lot"
    >
      <rect x={0} y={0} width={total} height={total} rx={3} fill="#ffffff" />
      <g transform={`translate(${QUIET} ${QUIET})`}>
        {dots.map(([x, y], i) => (
          <rect
            key={i}
            x={x + 0.08}
            y={y + 0.08}
            width={0.84}
            height={0.84}
            rx={0.3}
            fill={DARK}
          />
        ))}
        <Finder ox={0} oy={0} />
        <Finder ox={N - 7} oy={0} />
        <Finder ox={0} oy={N - 7} />
        <Align ox={16} oy={16} />
      </g>
    </svg>
  );
}
