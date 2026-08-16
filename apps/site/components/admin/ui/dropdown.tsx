"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Lightweight dropdown menu (click-outside + Escape), no external dependency. */
function Dropdown({
  trigger,
  children,
  align = "end",
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-40 mt-1.5 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-[var(--shadow-md)]",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  className,
  destructive,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        destructive
          ? "text-danger hover:bg-danger-soft"
          : "text-foreground hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

function DropdownLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2.5 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

function DropdownSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

export { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator };
