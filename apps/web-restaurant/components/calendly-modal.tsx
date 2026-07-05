"use client";

import { useEffect } from "react";
import { useCalendlyModal } from "@/lib/store";

// ──────────────────────────────────────────────
// Remplace cette URL par ton lien Calendly
const CALENDLY_URL = "https://calendly.com/hello-beindigital/new-meeting";
// ──────────────────────────────────────────────

export function CalendlyModal() {
  const { isOpen, close } = useCalendlyModal();

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const embedUrl = `${CALENDLY_URL}?hide_gdpr_banner=1&background_color=13131a&text_color=f5f5f5&primary_color=52cfaf`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] max-h-[750px] rounded-t-2xl sm:rounded-2xl border border-white/[0.08] bg-[#13131a] shadow-[0_0_80px_rgba(82,207,175,0.08)] overflow-hidden flex flex-col">
        {/* Top neon line */}
        <div
          className="absolute top-0 left-8 right-8 h-px z-10"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(82,207,175,0.4), transparent)",
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Réserver un appel
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choisissez un créneau qui vous convient
            </p>
          </div>
          <button
            onClick={close}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fermer"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendly iframe */}
        <div className="flex-1 relative">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            title="Réserver un appel — Calendly"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
