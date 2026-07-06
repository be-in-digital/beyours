import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid-pattern flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-muted-foreground [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
