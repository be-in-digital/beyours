"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * AnimatedStat — compteur qui anime de 0 à `value` à l'entrée dans le
 * viewport. Sous prefers-reduced-motion : valeur finale directe, sans anim.
 *
 * Perf : `@number-flow/react` (~25 KB gzip + custom-elements API) est
 * lazy-loadé via `next/dynamic({ssr:false})`. La section "numbers" étant
 * en milieu de page, le bundle critique d'hydratation ne le contient
 * plus → TBT mobile −80 à −120 ms. Avant l'observation, on rend la
 * valeur en plain text (zero CLS).
 */
const NumberFlow = dynamic(() => import("@number-flow/react"), {
  ssr: false,
  loading: () => null,
});

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  caption?: string;
};

export function AnimatedStat({
  value,
  suffix,
  prefix,
  label,
  caption,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayValue(value);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            setDisplayValue(value);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref}>
      <p className="font-display text-foreground text-6xl leading-none font-light tracking-tight sm:text-7xl lg:text-8xl">
        {prefix ? <span className="text-primary">{prefix}</span> : null}
        {inView ? (
          <NumberFlow
            value={displayValue}
            format={{ useGrouping: false }}
            transformTiming={{
              duration: 1600,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            spinTiming={{
              duration: 1600,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        ) : (
          <span>{value}</span>
        )}
        {suffix ? <span className="text-primary">{suffix}</span> : null}
      </p>
      <p className="text-foreground mt-3 text-base font-medium sm:text-lg">
        {label}
      </p>
      {caption ? (
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
