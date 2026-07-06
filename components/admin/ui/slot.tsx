"use client";

import * as React from "react";

/**
 * Slot minimal (façon Radix Slot) — fusionne les props du parent sur son unique
 * enfant. Évite une dépendance externe pour `asChild`.
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
