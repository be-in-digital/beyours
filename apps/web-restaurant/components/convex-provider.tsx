"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { MotionConfig } from "framer-motion";
import { ReactNode } from "react";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud";

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      {/* Respecte prefers-reduced-motion sur toutes les animations framer-motion */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ConvexAuthProvider>
  );
}
