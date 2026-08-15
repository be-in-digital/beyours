"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  children: React.ReactNode;
}

/**
 * Card with a radial gradient that follows the cursor.
 * Adds subtle mint glow on hover.
 */
export function MagicCard({
  children,
  gradientSize = 300,
  gradientColor = "#52cfaf",
  gradientOpacity = 0.12,
  className,
  ...props
}: MagicCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    node.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-surface-1 transition-colors duration-300 hover:border-[color:var(--border-accent)]",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={
          {
            background: `radial-gradient(${gradientSize}px circle at var(--mx) var(--my), ${gradientColor}${Math.round(
              gradientOpacity * 255
            )
              .toString(16)
              .padStart(2, "0")}, transparent 60%)`,
          } as React.CSSProperties
        }
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
