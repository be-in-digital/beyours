"use client";

import { useEffect } from "react";
import { useCalendlyModal } from "@/lib/store";

// ──────────────────────────────────────────────
// Replace this URL with your own Calendly link
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

  const embedUrl = `${CALENDLY_URL}?hide_gdpr_banner=1&background_color=faf5ee&text_color=221c15&primary_color=c5542c`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[color:var(--olive)]/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] max-h-[750px] rounded-t-2xl sm:rounded-2xl border border-[color:var(--border)] bg-background shadow-[0_30px_80px_-30px_rgba(112,60,34,0.5)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
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
