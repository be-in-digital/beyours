import Image from "next/image";

type Variant = "laptop" | "laptop-tilt" | "phone";

type Props = {
  src: string;
  alt: string;
  variant?: Variant;
  /**
   * Si `true`, l'image est marquée `priority` (preload + fetchPriority='high'
   * + loading='eager'). Réservé à l'image LCP de la page (cover du hero
   * /work/[slug] ou featured product home).
   */
  priority?: boolean;
  /**
   * `sizes` custom : surcharge la valeur par défaut quand le composant est
   * placé dans un conteneur dont la largeur réelle ne correspond pas à la
   * heuristique mobile-first. Ex: dans la grille /products, le mockup ne
   * fait pas 92vw mobile mais ~46vw (2 colonnes).
   */
  sizes?: string;
  className?: string;
};

/**
 * <DeviceMockup /> — frame device (laptop ou phone) qui wrappe une capture
 * d'écran 1280×800 (laptop) ou ~750×1500 (phone).
 *
 * Style premium : bordure ultra-fine, radius doux, ombre diffuse mint/black,
 * notch top, base trapézoïdale, halo glow conditionné.
 *
 * - `laptop` : front, sans tilt (utile pour grille).
 * - `laptop-tilt` : perspective 3D légère + rotateY ; pour hero side panel.
 * - `phone` : bezels ronds, ratio 9/19.
 *
 * Perf :
 *   - `sizes` calé sur les breakpoints réels Tailwind (sm/md/lg)
 *   - `priority` -> fetchPriority='high' + preload (LCP element)
 *   - non-priority -> loading='lazy' + decoding='async' implicites par
 *     next/image
 */
export function DeviceMockup({
  src,
  alt,
  variant = "laptop",
  priority = false,
  sizes,
  className = "",
}: Props) {
  if (variant === "phone") {
    return (
      <div
        className={`group relative mx-auto aspect-[9/19] w-full max-w-[280px] ${className}`}
      >
        {/* Halo */}
        <div
          aria-hidden
          className="absolute -inset-12 rounded-[60%] bg-[radial-gradient(circle_at_center,hsl(162_56%_57%/0.18),transparent_70%)] blur-2xl"
        />
        {/* Bezel */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] border border-white/15 bg-[#050505] p-[10px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8),0_10px_40px_-10px_rgba(82,207,175,0.15)]">
          {/* Notch */}
          <div
            aria-hidden
            className="absolute top-3 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#020202]"
          />
          {/* Screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-black">
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              fetchPriority={priority ? "high" : "auto"}
              sizes={sizes ?? "(max-width: 640px) 60vw, 280px"}
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>
    );
  }

  const tiltClass =
    variant === "laptop-tilt"
      ? "[transform:perspective(2000px)_rotateY(-7deg)_rotateX(3deg)]"
      : "";

  // Sizes calé sur les usages réels :
  //  - mobile (<640px) : on est dans une card pleine largeur ~92vw
  //  - sm-md (640-1024) : on est en 2 colonnes (sm:grid-cols-2) ~46vw
  //  - lg+ : on est en col-span-7 d'une grille 12 -> ~58% du container 6xl
  //          soit max ~640px (1280/2)
  const defaultSizes =
    "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 640px";

  return (
    <div className={`relative ${className}`}>
      {/* Halo de base */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[40%] bg-[radial-gradient(ellipse_at_center,hsl(162_56%_57%/0.16),transparent_70%)] blur-2xl"
      />
      {/* Halo intensifié — réagit au hover du group parent (la card) */}
      <div
        aria-hidden
        className="absolute -inset-14 -z-10 rounded-[40%] bg-[radial-gradient(ellipse_at_center,hsl(162_56%_57%/0.32),transparent_60%)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
      />
      <div className={`relative ${tiltClass}`}>
        {/* Laptop body / screen */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-[14px] border border-white/10 bg-[#050505] p-[6px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85),0_20px_50px_-12px_rgba(82,207,175,0.12)]">
          {/* Top bezel webcam */}
          <div
            aria-hidden
            className="absolute top-[3px] left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-white/30"
          />
          {/* Screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[8px] bg-black">
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              fetchPriority={priority ? "high" : "auto"}
              sizes={sizes ?? defaultSizes}
              className="object-cover object-top"
            />
            {/* Subtle gloss */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%)]"
            />
          </div>
        </div>
        {/* Laptop base — trapezoidal hint via clip-path */}
        <div
          aria-hidden
          className="relative -mt-px h-[14px] w-full"
          style={{
            background:
              "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 60%, #050505 100%)",
            clipPath:
              "polygon(0% 0%, 100% 0%, 97% 100%, 3% 100%)",
            boxShadow: "0 14px 30px -10px rgba(0,0,0,0.6)",
          }}
        />
        {/* Hinge slit */}
        <div
          aria-hidden
          className="mx-auto h-[3px] w-[14%] rounded-b-md bg-black/80"
        />
      </div>
    </div>
  );
}
