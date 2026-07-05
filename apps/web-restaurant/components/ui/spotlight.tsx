"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  className?: string;
  size?: number;
}

/**
 * Spotlight that follows the cursor on desktop.
 * Falls back to a static radial on touch or when reduced-motion is preferred.
 */
export function Spotlight({ className, size = 600 }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    const node = ref.current;
    if (!node) return;

    let rafId = 0;
    let targetX = 50;
    let targetY = 20;
    let currentX = 50;
    let currentY = 20;

    function onMove(e: PointerEvent) {
      const rect = node!.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 100;
      targetY = ((e.clientY - rect.top) / rect.height) * 100;
    }

    function tick() {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      node!.style.setProperty("--x", `${currentX}%`);
      node!.style.setProperty("--y", `${currentY}%`);
      rafId = requestAnimationFrame(tick);
    }

    node.addEventListener("pointermove", onMove);
    rafId = requestAnimationFrame(tick);
    return () => {
      node.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      style={
        {
          "--x": "50%",
          "--y": "20%",
          background: `radial-gradient(${size}px circle at var(--x) var(--y), rgba(82, 207, 175, 0.18), rgba(82, 207, 175, 0.04) 35%, transparent 65%)`,
          transition: "background-position 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        } as React.CSSProperties
      }
    />
  );
}
