"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSceneStore } from "@/store/scene-store";

/**
 * LenisProvider — Lenis = seul driver de scroll (Decision #24).
 *
 * Pourquoi un seul driver ?
 *   Avoir Framer Motion, Lenis et GSAP qui font chacun leur RAF loop crée
 *   des frames drops sur mobile (3 RAF concurrents sur main thread).
 *   Solution : Lenis pilote tout, ScrollTrigger se synchronise dessus,
 *   Framer Motion reste cantonné aux reveals/hovers non-scroll.
 *
 * Ce provider :
 *   - Init Lenis avec easing expo-out cinématique (1.2s duration)
 *   - Branche lenis.on('scroll', ScrollTrigger.update) pour sync GSAP
 *   - Pousse scrollY + progress dans sceneStore (scène 3D consomme)
 *   - Fait avancer Lenis via gsap.ticker (un seul RAF pour tout)
 *   - Respecte prefers-reduced-motion : Lenis est court-circuité
 *
 * Le canvas WebGL hero lit useSceneStore.scrollProgress chaque frame
 * pour piloter uScrollProgress (liquide → architecture).
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const setScroll = useSceneStore((s) => s.setScroll);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    const onScroll = ({
      scroll,
      limit,
    }: {
      scroll: number;
      limit: number;
    }) => {
      const progress = limit > 0 ? scroll / limit : 0;
      setScroll(scroll, progress);
    };

    lenis.on("scroll", ScrollTrigger.update);
    lenis.on("scroll", onScroll);

    const tickerCb = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCb);
      lenis.destroy();
    };
  }, [setScroll]);

  return <>{children}</>;
}
