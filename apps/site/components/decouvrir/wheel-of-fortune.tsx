"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

/* ═══════════════════════════════════════════════
   Roue de la fortune — jouable, autonome (SVG + framer-motion)
   Rendu 100 % client : aucune dépendance backend.
   La roue s'arrête sur le segment `winningIndex` fourni par le parent
   (le vrai produit résout le gain côté serveur, taux piloté par l'admin).
   ═══════════════════════════════════════════════ */

export type WheelSegment = {
  label: string;
  color: string;
  text: string; // couleur du texte
  win?: boolean;
};

const CX = 160;
const CY = 160;
const R = 158;

/** Point sur le cercle à `deg` degrés (sens horaire depuis le haut). */
function pointOnCircle(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function slicePath(startDeg: number, endDeg: number) {
  const a = pointOnCircle(startDeg, R);
  const b = pointOnCircle(endDeg, R);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

export function WheelOfFortune({
  segments,
  winningIndex,
  onResult,
  disabled = false,
}: {
  segments: WheelSegment[];
  winningIndex: number;
  onResult: (index: number) => void;
  disabled?: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const rotationRef = useRef(0);

  const n = segments.length;
  const seg = 360 / n;

  function spin() {
    if (spinning || disabled) return;
    setSpinning(true);
    setHasSpun(true);

    const centerDeg = winningIndex * seg + seg / 2;
    const current = rotationRef.current;
    // Ramène le centre du segment gagnant sous l'aiguille (en haut, 0°).
    const delta = (360 - ((centerDeg + current) % 360)) % 360;
    const next = current + 360 * 5 + delta;

    rotationRef.current = next;
    setRotation(next);
  }

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* Aiguille */}
      <div className="pointer-events-none absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
        <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden>
          <defs>
            <linearGradient id="wheel-pointer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff3c4" />
              <stop offset="0.5" stopColor="#c5542c" />
              <stop offset="1" stopColor="#89361b" />
            </linearGradient>
          </defs>
          <path
            d="M17 40 L4 10 A15 12 0 0 1 30 10 Z"
            fill="url(#wheel-pointer)"
            stroke="#fffdf9"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Anneau + disque */}
      <div
        className="relative aspect-square rounded-full p-[6px]"
        style={{
          background:
            "conic-gradient(from 0deg, #8a6a1f, #f7de8b, #b8860b, #fff3c4, #9a7418, #6e5314, #8a6a1f)",
          boxShadow:
            "0 24px 60px -24px rgba(112,60,34,0.55), inset 0 0 0 1px rgba(255,255,255,0.35)",
        }}
      >
        <motion.div
          className="relative h-full w-full rounded-full"
          animate={{ rotate: rotation }}
          transition={{ duration: 4.6, ease: [0.16, 1, 0.3, 1] }}
          onAnimationComplete={() => {
            if (!spinning) return;
            setSpinning(false);
            rotationRef.current = rotation;
            onResult(winningIndex);
          }}
          style={{ willChange: "transform" }}
        >
          <svg viewBox="0 0 320 320" className="h-full w-full">
            {segments.map((s, i) => {
              const start = i * seg;
              const end = (i + 1) * seg;
              const mid = start + seg / 2;
              const labelPos = pointOnCircle(mid, R * 0.62);
              return (
                <g key={i}>
                  <path
                    d={slicePath(start, end)}
                    fill={s.color}
                    stroke="rgba(255,253,249,0.85)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    fill={s.text}
                    fontSize={s.label.length > 9 ? 12 : 14}
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid} ${labelPos.x} ${labelPos.y})`}
                    style={{
                      fontFamily:
                        "var(--font-display), system-ui, sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </motion.div>

        {/* Moyeu central */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div
            className="grid h-14 w-14 place-items-center rounded-full text-primary-foreground"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, #fff3c4, #e5b53b 45%, #8a6a1f)",
              boxShadow: "0 0 30px rgba(245,165,36,0.4)",
            }}
          >
            <span className="font-display text-[15px] font-bold text-[#4f2113]">
              BiD
            </span>
          </div>
        </div>
      </div>

      {/* Bouton */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning || disabled}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_-12px_rgba(197,84,44,0.7)] transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {spinning ? "La roue tourne…" : hasSpun ? "Relancer la roue" : "Tourner la roue"}
      </button>
    </div>
  );
}
