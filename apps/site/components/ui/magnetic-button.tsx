"use client";

import { useRef, forwardRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag"> {
  strength?: number;
  children: React.ReactNode;
}

/**
 * Button with magnetic cursor attraction on desktop.
 * Falls back gracefully on touch / reduced motion.
 */
export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(
  function MagneticButton(
    { children, strength = 30, className, ...props },
    forwardedRef
  ) {
    const localRef = useRef<HTMLButtonElement>(null);
    const ref = (forwardedRef ?? localRef) as React.RefObject<HTMLButtonElement>;

    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { stiffness: 180, damping: 18, mass: 0.4 });
    const springY = useSpring(y, { stiffness: 180, damping: 18, mass: 0.4 });

    function onMove(e: React.PointerEvent<HTMLButtonElement>) {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(pointer: coarse)").matches) return;
      const rect = (ref.current ?? e.currentTarget).getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      x.set((dx / rect.width) * strength);
      y.set((dy / rect.height) * strength);
    }

    function onLeave() {
      x.set(0);
      y.set(0);
    }

    return (
      <motion.button
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ x: springX, y: springY }}
        className={cn(
          "btn-magnetic inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[filter,box-shadow] duration-300",
          className
        )}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        <motion.span style={{ x: springX, y: springY }} className="contents">
          {children}
        </motion.span>
      </motion.button>
    );
  }
);
