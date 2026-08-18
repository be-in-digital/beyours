"use client";

import { useBookingModal } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

/** Button that opens the booking modal (shared by the site layout). */
export function BookingButton({
  children = "Réserver un appel",
  className,
  size = "lg",
  withIcon = true,
}: {
  children?: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
  withIcon?: boolean;
}) {
  const { open } = useBookingModal();
  return (
    <button
      type="button"
      onClick={() => open()}
      className={cn(
        "btn-magnetic inline-flex items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_14px_34px_-14px_rgba(197,84,44,0.7)] transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98]",
        size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm",
        className,
      )}
    >
      {withIcon && <CalendarDays className="h-4 w-4" />}
      {children}
    </button>
  );
}
