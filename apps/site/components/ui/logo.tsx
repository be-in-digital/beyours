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
 * Logo Be in Digital — wordmark historique « B·IN·DIGITAL », recoloré
 * pour la DA chaude : encre + accent terracotta sur fond clair,
 * crème + terracotta sur fond olive. Contre-formes assorties au fond.
 * Ratio source ≈ 489.45 / 160.85 (~3.04).
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
      alt="Be in Digital"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ height: "auto" }}
    />
  );

  if (!linked) return img;

  return (
    <Link href="/" className="shrink-0" aria-label="Be in Digital — accueil">
      {img}
    </Link>
  );
}
