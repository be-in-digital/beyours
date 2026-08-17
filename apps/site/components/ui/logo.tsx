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
 *   ink   → "be" #23271c, pill #c5542c, wordmark #fdf7ef
 *   light → "be" #fdf7ef, pill #c5542c, wordmark #fdf7ef
 *
 * The letterforms are outlined paths, not <text>. A wordmark served through
 * <img> gets no web fonts: a <text> element would render in whatever the
 * viewer's system resolves `Arial, Helvetica, sans-serif` to, and since the
 * pill has a fixed width, a wider fallback would push "yours" past its curve.
 * Outlines make the mark identical everywhere. Regenerate them from the
 * source file rather than editing the path data by hand.
 *
 * /logo-ink.svg is the delivered artwork, untouched. /logo-light.svg is the
 * same file with the single ink fill swapped for cream — rebuild it that way
 * when a new version lands, don't redraw it.
 *
 * viewBox is 1421.7×326.7 — ratio 4.35. Keep width and height consistent with
 * it, otherwise Next reserves the wrong box and the logo jumps on load.
 *
 * These fills now match the design tokens (--olive #23271c, --primary #c5542c,
 * --primary-foreground #fdf7ef), but an SVG served through <img> cannot read
 * CSS variables — a palette change still has to be mirrored here by hand.
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
