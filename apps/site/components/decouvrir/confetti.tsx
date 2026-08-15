"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Rafale de confettis légère (DOM + framer-motion), sans dépendance ni canvas.
 * Se superpose au parent (positionné en relative). Respecte reduced-motion.
 * Pseudo-aléatoire déterministe (Math.sin) : pur, stable entre les rendus.
 */
const COLORS = [
  "#c5542c", // terracotta (marque)
  "#f5a524", // or
  "#e8483f", // vermillon
  "#0d9488", // teal
  "#db2777", // magenta
  "#efd8b8", // paille
];

/** Bruit déterministe dans [0, 1) — fonction pure, autorisée au rendu. */
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function Confetti({
  show,
  count = 46,
}: {
  show: boolean;
  count?: number;
}) {
  const reduce = useReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r1 = noise(i + 1);
        const r2 = noise(i + 7.3);
        const r3 = noise(i + 13.1);
        const r4 = noise(i + 19.7);
        const r5 = noise(i + 25.3);
        const r6 = noise(i + 31.9);
        const r7 = noise(i + 37.1);
        return {
          id: i,
          left: 50 + (r1 * 2 - 1) * 12, // % — part du centre haut
          color: COLORS[i % COLORS.length],
          dx: (r2 * 2 - 1) * 220,
          dy: 320 + r3 * 260,
          rot: (r4 * 2 - 1) * 540,
          size: 7 + r5 * 7,
          delay: r6 * 0.18,
          duration: 1.5 + r7 * 0.7,
          round: r1 > 0.6,
        };
      }),
    [count],
  );

  if (!show || reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{
            opacity: [1, 1, 0],
            x: p.dx,
            y: p.dy,
            rotate: p.rot,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            position: "absolute",
            top: "18%",
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            borderRadius: p.round ? "9999px" : "2px",
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
