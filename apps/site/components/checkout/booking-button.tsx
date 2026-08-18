"use client";

import { useBookingModal } from "@/lib/store";

export function BookingButton() {
  const { open } = useBookingModal();

  return (
    <button
      onClick={() => open("lancement")}
      className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 flex items-center gap-2 cursor-pointer"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      Prendre rendez-vous
    </button>
  );
}
