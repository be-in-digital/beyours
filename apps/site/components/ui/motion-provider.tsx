"use client";

import { MotionConfig } from "framer-motion";

/**
 * Global framer-motion config: respect the user's prefers-reduced-motion
 * setting for every motion component (section reveals included — before
 * this, only a handful of ui components handled it individually).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
