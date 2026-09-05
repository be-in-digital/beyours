"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { RadioTower } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/admin/ui/button";
import { toast } from "@/components/admin/ui/toast";
import { formatNumber } from "@/lib/format";

/* Forces a monitoring round instead of waiting for the ten-minute cron.
   An ops console that can only watch is half a console: the moment after a
   fix is deployed is exactly when someone wants to know whether it worked.
   Without a deploymentId it probes the whole live fleet. */
export function ProbeNowButton({
  deploymentId,
  size = "sm",
  variant = "outline",
}: {
  deploymentId?: Id<"saDeployments">;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
}) {
  const probeNow = useAction(api.saMonitoring.probeNow);
  const [running, setRunning] = React.useState(false);

  async function onClick() {
    setRunning(true);
    try {
      const { probed, failed } = await probeNow(
        deploymentId ? { deploymentId } : {},
      );
      if (probed === 0 && failed === 0) {
        toast.success("Aucun déploiement à sonder.");
      } else if (failed > 0) {
        toast.error(
          `${formatNumber(probed)} sondé${probed > 1 ? "s" : ""}, ` +
            `${formatNumber(failed)} en échec.`,
        );
      } else {
        toast.success(
          `${formatNumber(probed)} déploiement${probed > 1 ? "s" : ""} ` +
            `sondé${probed > 1 ? "s" : ""}.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant={variant} size={size} disabled={running} onClick={onClick}>
      <RadioTower className="size-4" />
      {running ? "Sondage…" : "Sonder maintenant"}
    </Button>
  );
}
