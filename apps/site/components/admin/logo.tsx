import { cn } from "@/lib/utils";

/**
 * Marque BeYours Superadmin — pastille terracotta + wordmark.
 *
 * Réduction du logo, pas sa reproduction : la pastille reprend la forme
 * signature (« ·yours » sur terracotta), le wordmark reste du texte dans la
 * police d'affichage du site. Le vrai tracé vit dans /logo-ink.svg, servi
 * par components/ui/logo.tsx — inutile de l'embarquer pour une puce de 32 px.
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
