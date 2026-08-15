/* ═══════════════════════════════════════════════
   Pricing FAQ — Accordéon custom, pas de dépendance
   ═══════════════════════════════════════════════ */

"use client";

import { useState, useCallback } from "react";
import { faqItems } from "./pricing-data";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border-b border-[color:var(--border)] transition-colors ${isOpen ? "bg-secondary/50" : ""}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left cursor-pointer group"
        aria-expanded={isOpen}
      >
        <span className="text-sm sm:text-base font-medium text-foreground group-hover:text-primary transition-colors">
          {question}
        </span>
        <div
          className={`shrink-0 w-6 h-6 rounded-full border border-[color:var(--border)] flex items-center justify-center transition-all duration-300 ${
            isOpen
              ? "bg-primary/10 border-primary/30 rotate-45"
              : "bg-secondary"
          }`}
        >
          <svg
            className={`w-3 h-3 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground/60"}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M6 2v8M2 6h8" />
          </svg>
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 sm:px-6 pb-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-12">
          <SectionBadge text="FAQ" />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.02em] mt-4">
            Questions fréquentes
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Les réponses aux questions que vous vous posez sur nos offres et
            notre fonctionnement.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 overflow-hidden shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
            <StaggerContainer stagger={0.05}>
              {faqItems.map((item, index) => (
                <StaggerItem key={index}>
                  <FaqItem
                    question={item.question}
                    answer={item.answer}
                    isOpen={openIndex === index}
                    onToggle={() => toggle(index)}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
