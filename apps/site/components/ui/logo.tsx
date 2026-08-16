import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  linked?: boolean;
  /** "ink" pour fond clair (défaut), "light" pour fond olive/sombre */
  variant?: "ink" | "light";
}

/**
 * Logo BeYours — wordmark « be ·yours » : encre + pastille terracotta.
 *
 * Deux variantes, mêmes tracés, trois remplissages permutés :
 *   ink   → encre #221c15, pastille #c5542c, contre-forme crème #faf5ee
 *   light → crème #fdf7ef, pastille #d5794d, contre-forme olive #23271c
 *
 * Ce sont les tokens de la DA (--foreground, --primary, --background). Un
 * changement de palette dans globals.css doit être reporté ici à la main :
 * un SVG servi par <img> ne lit pas les variables CSS de la page.
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
