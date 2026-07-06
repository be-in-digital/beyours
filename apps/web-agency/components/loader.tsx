"use client";

import { useEffect, useState } from "react";

/**
 * Loader — séquence d'intro courte (Decision Log #14, Pack B signature).
 *
 * Comportement perf-aware :
 *   - Skip si déjà vu cette session (sessionStorage flag)
 *   - Skip si prefers-reduced-motion
 *   - Skip si data-saver (Save-Data header) ou connection slow
 *   - Mount différé via requestAnimationFrame() pour ne pas bloquer le LCP
 *     du hero : le hero se peint d'abord, puis le loader recouvre, puis
 *     fade-out. Lighthouse mesure LCP sur le hero (déjà peint), pas sur
 *     le loader.
 *   - Durée totale : 600ms (250ms reveal + 300ms hold + 280ms fade-out
 *     overlap) au lieu de 700ms initiaux
 *   - Fond semi-transparent (96% opacity) : le hero reste partiellement
 *     visible derrière, donc le LCP candidate est bien le H1 et non le
 *     bloc loader.
 *
 * DOM/CSS uniquement, pas WebGL — pour ne pas pénaliser le LCP.
 */
const SESSION_KEY = "bid:loader:seen";
const TOTAL_DURATION_MS = 600;
const FADE_OUT_MS = 280;

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
};

export function Loader() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const alreadySeen = sessionStorage.getItem(SESSION_KEY) === "1";

    // Save-Data / 2g/slow-2g → skip le loader pour préserver les ressources
    const conn = (navigator as NavigatorWithConnection).connection;
    const isSlowConnection =
      conn?.saveData === true ||
      conn?.effectiveType === "slow-2g" ||
      conn?.effectiveType === "2g";

    if (reduced || alreadySeen || isSlowConnection) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "1");

    // Différer le mount au prochain frame post-hydratation pour laisser
    // le hero se peindre d'abord. Le navigateur enregistre alors le LCP
    // sur le H1/hero, pas sur l'overlay loader.
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setVisible(true);
      });
    });

    const fadeTimer = setTimeout(
      () => setFadingOut(true),
      TOTAL_DURATION_MS - FADE_OUT_MS,
    );
    const unmountTimer = setTimeout(
      () => setVisible(false),
      TOTAL_DURATION_MS,
    );

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Chargement"
      aria-hidden={fadingOut}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        backgroundColor: "rgba(9, 9, 9, 0.96)",
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        opacity: fadingOut ? 0 : 1,
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <svg
        viewBox="0 0 320 40"
        width="240"
        className="text-primary"
        aria-hidden="true"
      >
        <text
          x="160"
          y="28"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize="24"
          fontWeight="300"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="600"
          strokeDashoffset="600"
          style={{
            animation: `bid-loader-draw 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          }}
        >
          Be in Digital
        </text>
      </svg>
      <style>{`
        @keyframes bid-loader-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
