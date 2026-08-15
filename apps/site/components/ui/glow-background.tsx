"use client";

import { cn } from "@/lib/utils";

type GlowVariant = "hero" | "section" | "cta" | "none";

interface GlowBackgroundProps {
  variant?: GlowVariant;
  pattern?: "dot" | "grid" | "none";
  className?: string;
  withNoise?: boolean;
}

const variantClass: Record<GlowVariant, string> = {
  hero: "bg-hero-radial",
  section: "bg-section-radial",
  cta: "bg-cta-radial",
  none: "",
};

export function GlowBackground({
  variant = "section",
  pattern = "none",
  className,
  withNoise = false,
}: GlowBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      {variant !== "none" && (
        <div className={cn("absolute inset-0", variantClass[variant])} />
      )}
      {pattern === "grid" && (
        <div className="absolute inset-0 grid-pattern opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      )}
      {pattern === "dot" && (
        <div className="absolute inset-0 dot-pattern [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      )}
      {withNoise && (
        <div className="noise-overlay" />
      )}
    </div>
  );
}
