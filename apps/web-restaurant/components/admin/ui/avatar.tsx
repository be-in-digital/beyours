import * as React from "react";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/format";

/** Avatar textuel (initiales) — pas d'image, teinte pilotée par `color`. */
function Avatar({
  name,
  color,
  className,
  size = "md",
}: {
  name: string;
  color?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  const bg = color ?? "var(--surface-4)";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-background",
        dim,
        className,
      )}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

export { Avatar };
