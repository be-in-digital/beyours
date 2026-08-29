"use client"

import { useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import {
  UnlockIcon,
  Loader2,
} from "lucide-react"
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@be-in-digital/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import type { SystemInfo } from "./types"

// ─── Section: Force Unlock ───────────────────────────────────────────────────

export function ForceUnlockButton({ info }: { info: SystemInfo }) {
  const { api } = useAdminApiStore()
  const forceRelease = useMutation(api?.system?.forceReleaseLock)
  const [releasing, setReleasing] = useState(false)
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false)

  if (!info.systemLock) return null

  const handleRelease = async () => {
    if (!api?.system || !forceRelease) return
    setReleasing(true)
    try {
      await forceRelease({})
      toast.success("Verrou système libéré")
      setConfirmUnlockOpen(false)
    } catch {
      toast.error("Échec du deverrouillage")
    } finally {
      setReleasing(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirmUnlockOpen(true)}
        disabled={releasing || !api?.system}
      >
        <UnlockIcon className="h-4 w-4 mr-2" />
        Forcer le deverrouillage
      </Button>

      <AlertDialog open={confirmUnlockOpen} onOpenChange={setConfirmUnlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le deverrouillage</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va forcer la libération du verrou système. Si une opération est en cours, elle pourrait être corrompue. Êtes-vous sûr de vouloir continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releasing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRelease()
              }}
              disabled={releasing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {releasing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer le deverrouillage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
