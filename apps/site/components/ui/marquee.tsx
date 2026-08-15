import { cn } from "@/lib/utils";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  repeat?: number;
  duration?: number;
  gap?: string;
  children: React.ReactNode;
}

/**
 * Pure-CSS infinite marquee. Repeats children so the scroll is seamless.
 * Respects prefers-reduced-motion via globals.css media query.
 */
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  vertical = false,
  repeat = 4,
  duration = 40,
  gap = "2rem",
  children,
  style,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      style={
        {
          "--duration": `${duration}s`,
          "--gap": gap,
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "group flex overflow-hidden [gap:var(--gap)]",
        vertical ? "flex-col" : "flex-row",
        className
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 justify-around [gap:var(--gap)]",
            vertical
              ? reverse
                ? "animate-marquee-reverse flex-col"
                : "animate-marquee flex-col"
              : reverse
                ? "animate-marquee-reverse"
                : "animate-marquee",
            pauseOnHover && "group-hover:[animation-play-state:paused]"
          )}
          aria-hidden={i > 0}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
