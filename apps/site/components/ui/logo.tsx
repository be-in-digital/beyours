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
 * Two variants. Only the "be" changes colour — the pill keeps its terracotta
 * and its cream wordmark in both, because that pairing is the mark itself:
 *   ink   → "be" #17180D, pill #C94D20, wordmark #FFFDF7
 *   light → "be" #FFFDF7, pill #C94D20, wordmark #FFFDF7
 *
 * The letterforms are outlined paths, not <text>. A wordmark served through
 * <img> gets no web fonts: a <text> element would render in whatever the
 * viewer's system resolves `Arial, Helvetica, sans-serif` to, and since the
 * pill has a fixed width, a wider fallback would push "yours" past its curve.
 * Outlines make the mark identical everywhere. Regenerate them from the
 * source file rather than editing the path data by hand.
 *
 * viewBox is 1100×250 — ratio 4.4. Keep width and height consistent with it,
 * otherwise Next reserves the wrong box and the logo jumps on load.
 *
 * Note: these fills are the delivered brand colours and sit a shade off the
 * design tokens (--foreground #221c15, --primary #c5542c, --background
 * #faf5ee). An SVG served through <img> cannot read CSS variables, so a
 * palette change has to be mirrored here by hand.
 */
export function Logo({
  width = 128,
  height = 29,
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
