"use client";

import { useEffect, useRef } from "react";

/**
 * MagneticCursor — curseur custom subtil (Pack B signature, Decision #14).
 *
 * Pas un follower exact. Lerp doux + snap magnétique sur [data-magnetic].
 * `mix-blend-mode: difference` → visible sur tous les fonds.
 * Skip sur touch devices et sous prefers-reduced-motion.
 *
 * Le curseur natif n'est PAS caché — on superpose un anneau discret
 * pour signature, sans empêcher l'accessibilité (focus rings, etc.).
 */
export function MagneticCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTouch = window.matchMedia("(hover: none)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reduced) return;

    let rafId = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let dotX = targetX;
    let dotY = targetY;
    let isHovering = false;

    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const magneticEl = target?.closest<HTMLElement>("[data-magnetic]");

      if (magneticEl) {
        const rect = magneticEl.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
        if (!isHovering) {
          isHovering = true;
          ringRef.current?.classList.add("is-hover");
        }
      } else {
        targetX = e.clientX;
        targetY = e.clientY;
        if (isHovering) {
          isHovering = false;
          ringRef.current?.classList.remove("is-hover");
        }
      }
    };

    const animate = () => {
      // Tighter lerp when free, looser lerp when snapping to a magnetic
      // element (magnetic feel only kicks in on hover, no perceived lag
      // during normal cursor travel).
      const ringLerp = isHovering ? 0.18 : 0.42;
      const dotLerp = isHovering ? 0.45 : 0.7;

      ringX += (targetX - ringX) * ringLerp;
      ringY += (targetY - ringY) * ringLerp;
      dotX += (targetX - dotX) * dotLerp;
      dotY += (targetY - dotY) * dotLerp;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="bid-cursor-ring pointer-events-none fixed top-0 left-0 z-[200] hidden md:block"
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="bid-cursor-dot pointer-events-none fixed top-0 left-0 z-[200] hidden md:block"
      />
      <style>{`
        .bid-cursor-ring {
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          border: 1px solid hsl(162 56% 57% / 0.6);
          mix-blend-mode: difference;
          transition: width 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      height 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 220ms ease;
          will-change: transform;
        }
        .bid-cursor-ring.is-hover {
          width: 56px;
          height: 56px;
          border-color: hsl(162 56% 57%);
        }
        .bid-cursor-dot {
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: hsl(162 56% 57%);
          mix-blend-mode: difference;
          will-change: transform;
        }
      `}</style>
    </>
  );
}
