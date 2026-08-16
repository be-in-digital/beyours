import { cn } from "@/lib/utils";

/**
 * BeYours Superadmin mark — terracotta pill plus wordmark.
 *
 * A reduction of the logo, not a reproduction: the pill echoes the signature
 * shape ("·yours" on terracotta), the wordmark stays as text in the site's
 * display font. The real artwork lives in /logo-ink.svg, served by
 * components/ui/logo.tsx — no reason to embed it for a 32 px badge.
 */
export function Logo({
  withText = true,
  className,
}: {
  withText?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground shadow-[var(--glow-primary)]">
        b
      </span>
      {withText && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            BeYours
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Superadmin
          </span>
        </span>
      )}
    </span>
  );
}
