"use client";

import { useEffect, useRef } from "react";

/**
 * TextReveal — révèle un texte char-par-char à l'entrée dans le viewport.
 *
 * Stratégie perf :
 *   - Le split DOM (création de spans par char) est différé jusqu'à
 *     l'IntersectionObserver. Au mount, le texte est dans son état natif
 *     → pas de coût TBT supplémentaire au load initial.
 *   - L'animation est CSS pure (transition-delay par index), pas de RAF
 *     concurrent avec Lenis/GSAP.
 *   - prefers-reduced-motion : le composant ne fait rien, le texte est
 *     visible direct.
 *   - split-type est importé dynamiquement à l'entrée pour ne PAS lestrer
 *     le bundle initial (économie ~12KB gzip).
 */
type Props = {
  byLines?: boolean;
  className?: string;
  staggerMs?: number;
  startDelayMs?: number;
  children: React.ReactNode;
};

export function TextReveal({
  byLines = false,
  className,
  staggerMs = 18,
  startDelayMs = 0,
  children,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        observer.disconnect();
        if (cancelled) return;

        // Lazy import: split-type leaves the initial JS bundle.
        import("split-type").then(({ default: SplitType }) => {
          if (cancelled) return;

          const split = new SplitType(el, {
            types: byLines ? "lines" : "chars",
            tagName: "span",
          });

          const targets = (
            byLines ? (split.lines ?? []) : (split.chars ?? [])
          ) as HTMLElement[];

          targets.forEach((node, i) => {
            node.style.display = "inline-block";
            node.style.willChange = "opacity, transform";
            node.style.opacity = "0";
            node.style.transform = "translateY(0.6em)";
            const delay = startDelayMs + i * staggerMs;
            node.style.transition = `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 800ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`;
          });

          // Double rAF: the first frame commits the initial styles
          // (opacity:0 / translateY:0.6em) so the browser registers them
          // as the FROM state of the transition. The second frame flips
          // them, and the CSS transition kicks in. Without this, browsers
          // can collapse both writes into the same paint and skip the
          // animation entirely.
          requestAnimationFrame(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
              if (cancelled) return;
              for (const node of targets) {
                node.style.opacity = "1";
                node.style.transform = "translateY(0)";
              }
            });
          });
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [byLines, staggerMs, startDelayMs]);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
