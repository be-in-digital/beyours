import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCentsRounded } from "@/lib/format";

const SOURCES: { key: keyof Src; label: string; color: string }[] = [
  { key: "website", label: "Site web", color: "var(--chart-1)" },
  { key: "uber_eats", label: "Uber Eats", color: "var(--chart-4)" },
  { key: "deliveroo", label: "Deliveroo", color: "var(--info)" },
  { key: "pos", label: "Caisse", color: "var(--chart-2)" },
];

type Src = {
  website: number;
  uber_eats: number;
  deliveroo: number;
  pos: number;
};

export function SourceBreakdown({
  bySource,
  className,
}: {
  bySource: Src;
  className?: string;
}) {
  const total =
    bySource.website + bySource.uber_eats + bySource.deliveroo + bySource.pos ||
    1;
  // Only sources that actually have orders are shown. Uber Eats and Deliveroo
  // stay hidden while their integrations are not certified (value at 0), so we
  // never display an empty channel.
  const visibleSources = SOURCES.filter((s) => bySource[s.key] > 0);
  const noPlatformOrders =
    bySource.uber_eats === 0 && bySource.deliveroo === 0;
  return (
    <div className={cn("space-y-3", className)}>
      {visibleSources.map((s) => {
        const value = bySource[s.key];
        const pct = (value / total) * 100;
        return (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 rounded-[2px]"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
              <span className="font-medium text-foreground tnum">
                {formatCentsRounded(value)}
                <span className="ml-1.5 text-muted-foreground">
                  {pct.toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        );
      })}
      {noPlatformOrders && (
        <p className="text-xs text-muted-foreground">
          Aucune commande plateforme (intégrations à venir)
        </p>
      )}
    </div>
  );
}
