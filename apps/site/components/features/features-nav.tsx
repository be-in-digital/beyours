"use client";

import { useState, useEffect } from "react";
import { deepDiveFeatures } from "./features-data";

/* ═══════════════════════════════════════════════
   Features Sticky Nav — Desktop section indicator
   ═══════════════════════════════════════════════ */

const navItems = [
  ...deepDiveFeatures.map((f) => ({ id: f.id, label: f.title })),
  { id: "et-aussi", label: "Et aussi…" },
];

export function FeaturesNav() {
  const [activeId, setActiveId] = useState<string>("");
  const [pastBento, setPastBento] = useState(false);
  const [beforeCta, setBeforeCta] = useState(true);

  useEffect(() => {
    // Active section tracking
    const elements = navItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[];

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: 0 },
    );
    elements.forEach((el) => sectionObserver.observe(el));

    // Visibility: show once the bento overview has scrolled past the top,
    // hide again as the CTA enters — via IntersectionObserver, no scroll listener.
    const bento = document.getElementById("features-bento");
    const cta = document.getElementById("cta");

    const bentoObserver = bento
      ? new IntersectionObserver(
          ([entry]) => setPastBento((entry?.boundingClientRect.bottom ?? 0) < 0),
          { threshold: 0 },
        )
      : null;
    bentoObserver?.observe(bento as Element);

    // Le CTA « intersecte » dès que son haut franchit la ligne des 70 % du
    // viewport : isIntersecting bascule exactement au bon moment (entrée ET
    // retour arrière), là où une comparaison de coordonnées au moment du
    // trigger restait figée tant que le CTA était à l'écran.
    const ctaObserver = cta
      ? new IntersectionObserver(
          ([entry]) => setBeforeCta(!entry?.isIntersecting),
          { threshold: 0, rootMargin: "0px 0px -30% 0px" },
        )
      : null;
    ctaObserver?.observe(cta as Element);

    return () => {
      sectionObserver.disconnect();
      bentoObserver?.disconnect();
      ctaObserver?.disconnect();
    };
  }, []);

  if (!pastBento || !beforeCta) return null;

  return (
    <div className="pointer-events-none fixed left-4 top-1/2 z-50 hidden -translate-y-1/2 animate-in fade-in duration-300 xl:left-6 xl:block">
      <nav className="pointer-events-auto flex max-w-[180px] flex-col gap-1 rounded-xl border border-[color:var(--border)] bg-surface-1/90 p-1.5 shadow-[0_16px_40px_-24px_rgba(112,60,34,0.5)] backdrop-blur-md">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              const el = document.getElementById(item.id);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium leading-tight transition-all duration-200 ${
              activeId === item.id
                ? "border border-[color:var(--border-accent)] bg-primary/10 text-primary"
                : "border border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
