import { useEffect, useRef, useState } from "react";

/**
 * useSceneVisibility — Intersection Observer hook qui détecte si une scène
 * est dans le viewport (avec marge configurable).
 *
 * Usage : la scène court-circuite useFrame quand visible === false,
 * évitant la consommation GPU sur scènes hors écran (voir Decision Log #19).
 *
 * rootMargin par défaut "200px" : pré-charge légèrement avant l'arrivée
 * en viewport pour éviter le flash de scène vide.
 */
export function useSceneVisibility<T extends Element = HTMLDivElement>(
  options: { rootMargin?: string; threshold?: number | number[] } = {},
): { ref: React.RefObject<T | null>; visible: boolean } {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(entry.isIntersecting);
      },
      {
        rootMargin: options.rootMargin ?? "200px",
        threshold: options.threshold ?? 0,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options.rootMargin, options.threshold]);

  return { ref, visible };
}
