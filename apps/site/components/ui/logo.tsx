import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  linked?: boolean;
  /** "ink" for light backgrounds (default), "light" for olive/dark ones */
  variant?: "ink" | "light";
}

/**
 * BeYours logo — the "be ·yours" wordmark: ink plus a terracotta pill.
 *
 * Two variants, same paths, three fills swapped:
 *   ink   → ink #221c15, pill #c5542c, counterform cream #faf5ee
 *   light → cream #fdf7ef, pill #d5794d, counterform olive #23271c
 *
 * Those are the design tokens (--foreground, --primary, --background). A
 * palette change in globals.css has to be mirrored here by hand: an SVG served
 * through <img> does not read the page's CSS variables.
 */
export function Logo({
  width = 128,
  height = 42,
  priority = false,
  className,
  linked = true,
  variant = "ink",
}: LogoProps) {
  const img = (
    <Image
      src={variant === "light" ? "/logo-light.svg" : "/logo-ink.svg"}
      alt="BeYours"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ height: "auto" }}
    />
  );

  if (!linked) return img;

  return (
    <Link href="/" className="shrink-0" aria-label="BeYours — accueil">
      {img}
    </Link>
  );
}
