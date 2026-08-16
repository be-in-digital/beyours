"use client";

import * as React from "react";

/**
 * Minimal Slot (in the spirit of Radix Slot) — merges the parent's props onto
 * its single child. Avoids an external dependency just for `asChild`.
 */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props;
    return React.cloneElement(child, {
      ...props,
      ...childProps,
      className: cnMerge(
        (props as { className?: string }).className,
        (childProps as { className?: string }).className,
      ),
      ref,
    } as Record<string, unknown>);
  },
);
Slot.displayName = "Slot";

function cnMerge(a?: string, b?: string) {
  return [a, b].filter(Boolean).join(" ");
}
