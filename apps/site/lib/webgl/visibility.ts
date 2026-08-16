import { useEffect, useRef, useState } from "react";

/**
 * useSceneVisibility — Intersection Observer hook that detects whether a scene
 * is inside the viewport (with a configurable margin).
 *
 * Usage: the scene short-circuits useFrame when visible === false, which avoids
 * burning GPU on off-screen scenes (see Decision Log #19).
 *
 * The default rootMargin of "200px" warms the scene up slightly before it
 * reaches the viewport, so it never flashes in empty.
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
