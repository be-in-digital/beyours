import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  invertDelta = false,
  hint,
  icon,
  accent,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  /** ratio, ex 0.073 → +7,3 % */
  delta?: number;
  deltaLabel?: string;
  /** true si une baisse est « bonne » (ex : incidents) */
  invertDelta?: boolean;
  hint?: string;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const hasDelta = typeof delta === "number" && isFinite(delta) && delta !== 0;
  const up = (delta ?? 0) > 0;
  const good = invertDelta ? !up : up;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground [&_svg]:size-4"
            style={accent ? { color: accent } : undefined}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl font-semibold leading-tight tracking-tight tnum">
            {value}
          </div>
          {(hasDelta || deltaLabel || hint) && (
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {hasDelta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium tnum",
                    good ? "text-success" : "text-danger",
                  )}
                >
                  {up ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  {formatPercent(Math.abs(delta ?? 0))}
                </span>
              )}
              {deltaLabel && (
                <span className="font-medium text-foreground tnum">{deltaLabel}</span>
              )}
              {hint && <span className="text-muted-foreground">{hint}</span>}
            </div>
          )}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}
