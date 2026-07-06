"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

/**
 * Reveal — composants d'apparition au scroll, version CSS-only (pas de
 * framer-motion). Le bundle initial économise ~30KB gzipped.
 *
 * Stratégie :
 *   - Chaque <RevealSection /> est une <section> avec class "bid-reveal"
 *     (opacity 0, translateY 60px). Un IntersectionObserver ajoute la
 *     class "is-visible" qui déclenche la transition CSS.
 *   - <RevealStagger /> pose le délai sur ses enfants directs via
 *     CSS variable --bid-reveal-delay (calculé par index × staggerMs).
 *   - <RevealItem /> = un <div className="bid-reveal-item">.
 *   - Une seule règle CSS globale (chargée via la balise <style>
 *     ci-dessous) gère toutes les transitions, donc pas de surcoût de
 *     CSS-in-JS.
 *   - prefers-reduced-motion : transition désactivée, élément directement
 *     visible.
 *
 * Tradeoff perte vs framer-motion :
 *   - On perd l'API "whileInView" déclarative, mais le composant
 *     l'encapsule pareil.
 *   - On perd le `staggerChildren` automatique de framer, mais
 *     RevealStagger pose un délai inline-style sur ses enfants.
 *   - Pas de spring physics → on utilise des cubic-bezier équivalents
 *     (16, 1, 0.3, 1).
 */

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  /** Délai initial en ms avant la transition (default 0). */
  delay?: number;
};

export function RevealSection({
  delay = 0,
  className = "",
  children,
  ...rest
}: SectionProps) {
  const ref = useRef<HTMLElement>(null);
  useEnterOnVisible(ref);
  return (
    <section
      ref={ref}
      className={`bid-reveal ${className}`}
      style={{ ["--bid-reveal-delay" as string]: `${delay}ms` }}
      {...rest}
    >
      {children}
    </section>
  );
}

type StaggerProps = ComponentPropsWithoutRef<"div"> & {
  /** Délai entre 2 enfants en ms (default 110). */
  staggerMs?: number;
  /** Délai global avant le début du stagger (default 60). */
  delayMs?: number;
};

export function RevealStagger({
  staggerMs = 110,
  delayMs = 60,
  className = "",
  children,
  ...rest
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterOnVisible(ref);
  // On distribue --bid-reveal-delay sur chaque enfant React.
  const wrappedChildren = Children.map(children, (child, i) => {
    if (!isValidElement(child)) return child;
    const childWithRefs = child as React.ReactElement<{
      style?: React.CSSProperties;
    }>;
    const newStyle: React.CSSProperties = {
      ...(childWithRefs.props.style ?? {}),
      ["--bid-reveal-delay" as string]: `${delayMs + i * staggerMs}ms`,
    };
    return cloneElement(childWithRefs, { style: newStyle });
  });
  return (
    <div
      ref={ref}
      className={`bid-reveal-stagger ${className}`}
      {...rest}
    >
      {wrappedChildren}
      <RevealStyles />
    </div>
  );
}

export function RevealItem({
  className = "",
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { children?: ReactNode }) {
  return (
    <div className={`bid-reveal-item ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Hook : pose la classe is-visible sur le ref quand il entre dans
   le viewport (one-shot, IntersectionObserver disconnect ensuite).
   ───────────────────────────────────────────────────────────────── */
function useEnterOnVisible(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      el.classList.add("is-visible");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
}

/* ─────────────────────────────────────────────────────────────────
   Styles : injectés une fois (le composant <RevealStyles /> est
   monté par RevealStagger ; on l'embarque ici comme child pour
   ne pas avoir à modifier globals.css). React dédup les <style>
   identiques par contenu donc ça reste cheap.
   ───────────────────────────────────────────────────────────────── */
function RevealStyles() {
  return (
    <style>{`
      .bid-reveal,
      .bid-reveal-item {
        opacity: 0;
        transform: translateY(40px);
        transition:
          opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1),
          transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        transition-delay: var(--bid-reveal-delay, 0ms);
        will-change: opacity, transform;
      }
      .bid-reveal.is-visible,
      .bid-reveal-stagger.is-visible .bid-reveal-item {
        opacity: 1;
        transform: translateY(0);
        will-change: auto;
      }
      @media (prefers-reduced-motion: reduce) {
        .bid-reveal,
        .bid-reveal-item {
          opacity: 1;
          transform: none;
          transition: none;
          will-change: auto;
        }
      }
    `}</style>
  );
}

// Re-export legacy alias kept for any direct framer-motion variant prop.
// On ne l'utilise plus, mais on garde l'export pour compat.
export const staggerItem = {};
