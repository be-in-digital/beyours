"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useEffect, useRef, useState } from "react";

interface NumberTickerProps {
  value: number;
  suffix?: string;
  prefix?: string;
  format?: Format;
  className?: string;
}

/**
 * Variable-font animated number counter.
 * Starts animation when element enters viewport.
 */
export function NumberTicker({
  value,
  suffix,
  prefix,
  format,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplay(value);
          observer.disconnect();
        }
      },
      { threshold: prefersReduced ? 0 : 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <NumberFlow value={display} format={format} locales="fr-FR" />
      {suffix}
    </span>
  );
}
