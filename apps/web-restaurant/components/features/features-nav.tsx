"use client";

import { useState, useEffect } from "react";
import { deepDiveFeatures } from "./features-data";

/* ═══════════════════════════════════════════════
   Features Sticky Nav — Desktop section indicator
   ═══════════════════════════════════════════════ */

const navItems = [
  ...deepDiveFeatures.map((f) => ({ id: f.id, label: f.title })),
  { id: "et-aussi", label: "Et aussi..." },
];

export function FeaturesNav() {
  const [activeId, setActiveId] = useState<string>("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sectionIds = navItems.map((item) => item.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));

    // Show/hide based on scroll position
    const handleScroll = () => {
      const bentoSection = document.getElementById("features-bento");
      const ctaSection = document.getElementById("cta");

      if (bentoSection && ctaSection) {
        const bentoBottom = bentoSection.getBoundingClientRect().bottom;
        const ctaTop = ctaSection.getBoundingClientRect().top;
        setVisible(bentoBottom < 0 && ctaTop > 200);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-1/2 -translate-y-1/2 left-4 xl:left-6 z-50 hidden xl:block pointer-events-none"
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      <nav className="flex flex-col gap-1 bg-[#0c0c10]/90 backdrop-blur-md border border-white/[0.06] rounded-xl p-1.5 pointer-events-auto shadow-lg max-w-[180px]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              const el = document.getElementById(item.id);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 cursor-pointer leading-tight ${
              activeId === item.id
                ? "text-primary bg-primary/[0.08] border border-primary/15"
                : "text-muted-foreground/50 hover:text-muted-foreground/80 border border-transparent"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
