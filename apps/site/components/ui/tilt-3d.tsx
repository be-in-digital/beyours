"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";

/**
 * Tilt3D — gives an element genuine 3D depth: it tilts in perspective towards
 * the cursor (rotateX/rotateY as a GPU transform).
 * No effect at all under prefers-reduced-motion or on mobile (no fine hover).
 */
export function Tilt3D({
  children,
  className = "",
  maxTilt = 9,
  scale = 1.015,
  glare = false,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  scale?: number;
  /** faint light reflection following the cursor (for dark surfaces) */
  glare?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // cursor position inside the element, normalised to -0.5 → 0.5
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const springCfg = { stiffness: 150, damping: 18, mass: 0.4 };
  const rotateX = useSpring(
    useTransform(py, [-0.5, 0.5], [maxTilt, -maxTilt]),
    springCfg,
  );
  const rotateY = useSpring(
    useTransform(px, [-0.5, 0.5], [-maxTilt, maxTilt]),
    springCfg,
  );
  const glareBg = useTransform(
    [px, py],
    ([gx = 0, gy = 0]: number[]) =>
      `radial-gradient(circle at ${(gx + 0.5) * 100}% ${(gy + 0.5) * 100}%, rgba(255,255,255,0.5), transparent 45%)`,
  );

  if (reduce) return <div className={className}>{children}</div>;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };

  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div className={className} style={{ perspective: 1100 }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        whileHover={{ scale }}
        transition={{ type: "spring", ...springCfg }}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        className="relative"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] mix-blend-soft-light"
            style={{ background: glareBg }}
          />
        )}
      </motion.div>
    </div>
  );
}
