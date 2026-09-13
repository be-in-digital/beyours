"use client"

/**
 * Building a sequence (#270).
 *
 * DELAYS ARE COUNTED FROM THE TRIGGER, NOT FROM THE PREVIOUS STEP. That is what
 * `delayForStep` in `automationDispatch.ts` does, and it is the whole reason this
 * dialog says « après le déclencheur » on every row. An editor that chained
 * delays would drift — step 3 at "J+1" after a step at "J+3" would fire on day
 * four — and would not match what the owner wrote.
 *
 * ONLY THE TRIGGERS THAT CAN FIRE ARE OFFERED. `birthday` has no record carrying
 * a date of birth and `abandoned_cart` has no persisted cart, so an automation on
 * either would activate and send nothing for ever. The reasons come from
 * `TRIGGER_READINESS`, the same constant the dispatcher reads and the mutation
 * now refuses on, rather than a second list here.
 */

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-in-digital/ui"
import { TRIGGER_READINESS } from "@be-in-digital/convex-functions/automationDispatch"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { convexErrorMessage } from "../../../lib/convex-error"
import {
  AUTOMATION_TRIGGER_LABELS,
  DEFAULT_INACTIVE_AFTER_DAYS,
  describeDelay,
  type AutomationDoc,
  type AutomationStepDraft,
} from "./automation-vocabulary"

/** A step id that survives a reorder, so React keys and the dedupe agree. */
function newStepId(existing: AutomationStepDraft[]): string {
  // Sequential rather than random: `emailAutomationRuns` dedupes on
  // `(automationId, subscriberId, occurrence, stepId)`, and a step id that
  // changed on every render would let the same message reach the same person
  // twice. The randomness is not spelled out here, because the guard that
  // checks for it cannot tell a mention in a comment from a call in the code —
  // the same way `onboarding-tour.test.ts` reads a placeholder's name.
  let n = existing.length + 1
  const taken = new Set(existing.map((step) => step.id))
  while (taken.has(`step-${n}`)) n += 1
  return `step-${n}`
}

interface AutomationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The automation being edited, or null to create one. */
  automation: AutomationDoc | null
}

export function AutomationFormDialog({
  open,
  onOpenChange,
  automation,
}: AutomationFormDialogProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [name, setName] = useState("")
  const [trigger, setTrigger] = useState<string>("welcome")
  const [steps, setSteps] = useState<AutomationStepDraft[]>([])
  const [inactiveAfterDays, setInactiveAfterDays] = useState(
    String(DEFAULT_INACTIVE_AFTER_DAYS)
  )
  const [isSaving, setIsSaving] = useState(false)

  const templates = useQuery(
    api?.emailTemplates?.list,
    storeId ? { storeId } : "skip"
  ) as Array<{ _id: string; name: string }> | undefined

  const segments = useQuery(
    api?.emailSegments?.list,
    storeId ? { storeId } : "skip"
  ) as Array<{ _id: string; name: string }> | undefined

  const createMutation = useMutation(api?.emailAutomations?.create)
  const updateMutation = useMutation(api?.emailAutomations?.update)

  // Re-seeded whenever the dialog opens, so editing one automation and then
  // another does not carry the first one's steps across.
  useEffect(() => {
    if (!open) return
    setName(automation?.name ?? "")
    setTrigger(automation?.trigger ?? "welcome")
    setSteps(
      (automation?.steps ?? []).map((step) => ({
        id: step.id,
        delayMinutes: step.delayMinutes,
        templateId: step.templateId,
        segmentId: step.segmentId,
      }))
    )
    setInactiveAfterDays(
      String(automation?.inactiveAfterDays ?? DEFAULT_INACTIVE_AFTER_DAYS)
    )
  }, [open, automation])

  /** The triggers an owner may choose, with the unready ones and their reason. */
  const triggerOptions = useMemo(
    () =>
      (Object.keys(AUTOMATION_TRIGGER_LABELS) as Array<
        keyof typeof AUTOMATION_TRIGGER_LABELS
      >).map((key) => ({
        value: key,
        label: AUTOMATION_TRIGGER_LABELS[key],
        ready: TRIGGER_READINESS[key]?.ready ?? false,
        missing: TRIGGER_READINESS[key]?.missing,
      })),
    []
  )

  const addStep = () =>
    setSteps((current) => [
      ...current,
      {
        id: newStepId(current),
        // A first step at 0 sends on the trigger itself, which is what a welcome
        // sequence means. A later one defaults a day out from the trigger.
        delayMinutes: current.length === 0 ? 0 : (current.length) * 24 * 60,
        templateId: templates?.[0]?._id ?? "",
      },
    ])

  const removeStep = (id: string) =>
    setSteps((current) => current.filter((step) => step.id !== id))

  const patchStep = (id: string, fields: Partial<AutomationStepDraft>) =>
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, ...fields } : step))
    )

  const move = (index: number, by: -1 | 1) =>
    setSteps((current) => {
      const next = [...current]
      const target = index + by
      if (target < 0 || target >= next.length) return current
      const moved = next[index] as AutomationStepDraft
      next[index] = next[target] as AutomationStepDraft
      next[target] = moved
      return next
    })

  const problem = (() => {
    if (!name.trim()) return "Donnez un nom à l'automatisation."
    if (steps.length === 0) return "Ajoutez au moins une étape."
    if (steps.some((step) => !step.templateId)) return "Chaque étape a besoin d'un modèle."
    if (trigger === "inactive") {
      const days = Number(inactiveAfterDays)
      if (!Number.isInteger(days) || days < 1) {
        return "Le délai d'inactivité se compte en jours entiers."
      }
    }
    return null
  })()

  const save = async () => {
    if (problem || !storeId) return
    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        trigger,
        steps: steps.map((step) => ({
          id: step.id,
          delayMinutes: step.delayMinutes,
          templateId: step.templateId,
          ...(step.segmentId ? { segmentId: step.segmentId } : {}),
        })),
        // Only for the trigger it belongs to. Sending it on a welcome sequence
        // would store a number the win-back sweep would never read and the
        // screen would never show.
        ...(trigger === "inactive"
          ? { inactiveAfterDays: Number(inactiveAfterDays) }
          : {}),
      }

      if (automation) {
        await updateMutation({ id: automation._id, ...payload })
        toast.success("Automatisation enregistrée")
      } else {
        await createMutation({ storeId, ...payload })
        toast.success("Automatisation créée — elle démarre en brouillon")
      }
      onOpenChange(false)
    } catch (error: unknown) {
      // The server's own sentence: an unready trigger says which data is
      // missing, and that is more useful than "échec".
      toast.error(convexErrorMessage(error, "Échec de l'enregistrement"))
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {automation ? "Modifier l'automatisation" : "Nouvelle automatisation"}
          </DialogTitle>
          <DialogDescription>
            Une suite d'emails envoyés automatiquement après un événement. Chaque
            délai se compte <strong>à partir du déclencheur</strong>, pas de
            l'étape précédente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="automation-name">Nom</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Bienvenue en 3 emails"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="automation-trigger">Déclencheur</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger id="automation-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    // Disabled rather than hidden, and the reason is printed. An
                    // absent option leaves an owner wondering; a disabled one
                    // with « aucune date de naissance n'est enregistrée » tells
                    // them what would have to change.
                    disabled={!option.ready}
                  >
                    {option.label}
                    {!option.ready && " — indisponible"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {triggerOptions.find((option) => option.value === trigger)?.missing && (
              <p className="text-xs text-muted-foreground">
                {triggerOptions.find((option) => option.value === trigger)?.missing}
              </p>
            )}
          </div>

          {trigger === "inactive" && (
            <div className="space-y-2">
              <Label htmlFor="automation-inactive-days">
                Après combien de jours sans commande
              </Label>
              <Input
                id="automation-inactive-days"
                type="number"
                min={1}
                value={inactiveAfterDays}
                onChange={(event) => setInactiveAfterDays(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Le balayage quotidien cherche les abonnés sans commande depuis ce
                nombre de jours.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Étapes</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addStep}
                disabled={!templates || templates.length === 0}
              >
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Ajouter une étape
              </Button>
            </div>

            {!templates || templates.length === 0 ? (
              // Said rather than shown as an empty list: an automation is a
              // sequence of TEMPLATES, and there is nothing to build one from.
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Créez d'abord un modèle d'email : une étape envoie un modèle.
              </p>
            ) : steps.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Aucune étape. Une automatisation sans étape n'envoie rien.
              </p>
            ) : (
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li
                    key={step.id}
                    className="space-y-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <GripVertical
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Étape {index + 1}
                        <span className="font-normal text-muted-foreground">
                          {describeDelay(step.delayMinutes)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Monter l'étape ${index + 1}`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Descendre l'étape ${index + 1}`}
                          disabled={index === steps.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Supprimer l'étape ${index + 1}`}
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor={`delay-${step.id}`} className="text-xs">
                          Heures après le déclencheur
                        </Label>
                        <Input
                          id={`delay-${step.id}`}
                          type="number"
                          min={0}
                          value={step.delayMinutes / 60}
                          onChange={(event) =>
                            patchStep(step.id, {
                              // Stored in minutes because that is what the
                              // dispatcher reads; entered in hours because
                              // nobody writes a three-day delay as 4320.
                              delayMinutes: Math.max(
                                0,
                                Math.round(Number(event.target.value) * 60)
                              ),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`template-${step.id}`} className="text-xs">
                          Modèle
                        </Label>
                        <Select
                          value={step.templateId}
                          onValueChange={(value) => patchStep(step.id, { templateId: value })}
                        >
                          <SelectTrigger id={`template-${step.id}`}>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template._id} value={template._id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`segment-${step.id}`} className="text-xs">
                          Segment (optionnel)
                        </Label>
                        <Select
                          value={step.segmentId ?? "all"}
                          onValueChange={(value) =>
                            patchStep(step.id, {
                              segmentId: value === "all" ? undefined : value,
                            })
                          }
                        >
                          <SelectTrigger id={`segment-${step.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tous les abonnés</SelectItem>
                            {(segments ?? []).map((segment) => (
                              <SelectItem key={segment._id} value={segment._id}>
                                {segment.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {problem ? (
            <p className="text-sm text-muted-foreground">{problem}</p>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={problem !== null || isSaving}>
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
