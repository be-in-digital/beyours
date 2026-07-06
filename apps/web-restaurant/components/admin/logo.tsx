import { cn } from "@/lib/utils";

/** Marque BeInDigital Superadmin — carré terracotta + wordmark. */
export function Logo({
  withText = true,
  className,
}: {
  withText?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground shadow-[var(--glow-primary)]">
        b.
      </span>
      {withText && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            BeInDigital
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Superadmin
          </span>
        </span>
      )}
    </span>
  );
}
