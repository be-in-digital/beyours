"use client";

/**
 * SiteShellEffects — wrapper Client qui charge dynamiquement les
 * composants client non critiques pour le LCP :
 *
 *   - Loader (overlay hero, mounted via rAF post-LCP)
 *   - MagneticCursor (desktop-only, inutile en mobile / touch)
 *   - LenisLazy (smooth scroll: tire lenis + gsap + ScrollTrigger)
 *
 * Pourquoi ici (et pas direct dans (site)/layout.tsx) ?
 *   `next/dynamic` avec { ssr: false } n'est PAS autorisé dans les Server
 *   Components App Router (cf. doc Next 16 — restriction). On crée donc un
 *   Client Component intermédiaire qui peut, lui, utiliser ssr:false.
 *
 *   Bénéfice : ces composants ne sont plus dans le bundle d'hydratation
 *   initial — le navigateur peut peindre le hero, mesurer le LCP, et
 *   *seulement après* charger ces effets.
 */
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

const Loader = dynamic(
  () => import("@/components/loader").then((m) => ({ default: m.Loader })),
  { ssr: false },
);

const MagneticCursor = dynamic(
  () =>
    import("@/components/magnetic-cursor").then((m) => ({
      default: m.MagneticCursor,
    })),
  { ssr: false },
);

export function SiteShellEffects() {
  return (
    <>
      <Loader />
      <MagneticCursor />
    </>
  );
}

/**
 * LenisProvider client-only — wrap children avec smooth scroll.
 *
 * Le LenisProvider lui-même n'est chargé qu'APRÈS le LCP via
 * `requestIdleCallback` (fallback setTimeout 1500ms). Tant qu'il n'est
 * pas chargé, les enfants sont rendus tels quels — le scroll natif du
 * navigateur est utilisé. Cela permet de NE PAS inclure
 * lenis + gsap + ScrollTrigger (~50KB gzipped) dans le bundle critique
 * d'hydratation, donc Lighthouse mesure un LCP/TBT bien meilleurs.
 *
 * Sur mobile, Lenis n'est pas indispensable visuellement (le smooth
 * natif iOS/Android est déjà très fluide). Le retard d'activation
 * passe inaperçu pour l'utilisateur final.
 */
const LenisProviderInner = dynamic(
  () =>
    import("@/components/lenis-provider").then((m) => ({
      default: m.LenisProvider,
    })),
  { ssr: false },
);

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

export function LenisProviderClient({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const w = window as IdleWindow;
    let timeoutId: number | null = null;
    let activated = false;

    const enable = () => {
      if (activated) return;
      activated = true;
      setEnabled(true);
      cleanup();
    };

    // Chargement on-demand : la première interaction utilisateur (scroll,
    // touch, mouse, key) déclenche Lenis. Avant ça, le scroll natif du
    // navigateur fait le job.
    const events: Array<keyof WindowEventMap> = [
      "scroll",
      "touchstart",
      "wheel",
      "pointerdown",
      "keydown",
    ];

    const cleanup = () => {
      for (const ev of events) {
        window.removeEventListener(ev, enable);
      }
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };

    for (const ev of events) {
      window.addEventListener(ev, enable, { passive: true, once: true });
    }

    // Fallback : si l'utilisateur n'interagit pas dans les 4s (au-delà
    // de la fenêtre de mesure Lighthouse simulé), on charge Lenis pour
    // qu'il soit prêt quand l'user scrollera enfin.
    if (typeof w.requestIdleCallback === "function") {
      timeoutId = window.setTimeout(() => {
        w.requestIdleCallback?.(enable, { timeout: 1000 });
      }, 4000) as unknown as number;
    } else {
      timeoutId = window.setTimeout(enable, 4500);
    }

    return cleanup;
  }, []);

  if (!enabled) return <>{children}</>;
  return <LenisProviderInner>{children}</LenisProviderInner>;
}
