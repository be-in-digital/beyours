"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useDevMode } from "@/lib/store";

export function DevModeDetector() {
  const searchParams = useSearchParams();
  const setEnabled = useDevMode((s) => s.setEnabled);

  useEffect(() => {
    if (searchParams.get("dev") === "true") {
      setEnabled(true);
    }
  }, [searchParams, setEnabled]);

  return null;
}
