"use client";

import { useEffect, useRef } from "react";

/**
 * SpotlightFollow — un cône de lumière mint qui suit la souris,
 * lerped pour rester doux. Sur touch / reduced-motion, le spotlight
 * reste statique au centre.
 *
 * Implémentation : on positionne un radial-gradient via CSS custom
 * property (--spot-x, --spot-y), mises à jour en useFrame-like avec
 * un lerp pour amortir le suivi.
 */
export function SpotlightFollow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const isTouch = window.matchMedia("(hover: none)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (isTouch || reduced) return;

    let raf = 0;
    let target = { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
    const current = { ...target };

    const onMove = (e: MouseEvent) => {
      target = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("mousemove", onMove, { passive: true });

    const tick = () => {
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      el.style.setProperty("--spot-x", `${current.x}px`);
      el.style.setProperty("--spot-y", `${current.y}px`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="bid-spotlight pointer-events-none fixed inset-0 z-0"
      style={
        {
          "--spot-x": "50vw",
          "--spot-y": "40vh",
        } as React.CSSProperties
      }
    >
      <style>{`
        .bid-spotlight {
          background: radial-gradient(
            500px circle at var(--spot-x) var(--spot-y),
            rgba(82, 207, 175, 0.10) 0%,
            rgba(82, 207, 175, 0.04) 30%,
            transparent 60%
          );
          will-change: background;
        }
      `}</style>
    </div>
  );
}
