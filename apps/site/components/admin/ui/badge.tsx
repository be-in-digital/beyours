import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-3 text-foreground",
        muted: "border-transparent bg-surface-2 text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        primary:
          "border-[color:var(--border-accent,transparent)] bg-primary/15 text-primary-ink",
        success:
          "border-[color:var(--success-border)] bg-success-soft text-success",
        warning:
          "border-[color:var(--warning-border)] bg-warning-soft text-warning",
        danger:
          "border-[color:var(--danger-border)] bg-danger-soft text-danger",
        info: "border-[color:var(--info-border)] bg-info-soft text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
