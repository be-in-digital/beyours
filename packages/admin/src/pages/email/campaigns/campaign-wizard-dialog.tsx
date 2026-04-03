"use client"

import { useState } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import {
  Button,
  ButtonGroup,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@be-in-digital/ui"
import { validateCampaign } from "@be-in-digital/marketing"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Segment = any

const STEPS = [
  "Informations",
  "Modèle",
  "Audience",
  "Test A/B",
  "Planification",
  "Résumé",
]

interface CampaignWizardState {
  name: string
  subject: string
  templateId: string
  segmentId: string // "" = all subscribers
  abTestEnabled: boolean
  variants: Array<{ id: string; subject: string; percentage: number }>
  scheduledAt: string // datetime-local input value
  sendNow: boolean
}

function generateId() {
  return crypto.randomUUID().slice(0, 7)
}

const initialState: CampaignWizardState = {
  name: "",
  subject: "",
  templateId: "",
  segmentId: "",
  abTestEnabled: false,
  variants: [
    { id: generateId(), subject: "", percentage: 50 },
    { id: generateId(), subject: "", percentage: 50 },
  ],
  scheduledAt: "",
  sendNow: true,
}

interface CampaignWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CampaignWizardDialog({ open, onOpenChange }: CampaignWizardDialogProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CampaignWizardState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const templates = useQuery(
    api?.emailTemplates?.list,
    storeId && step >= 1 ? { storeId } : "skip"
  ) as Template[] | undefined

  const segments = useQuery(
    api?.emailSegments?.list,
    storeId && step >= 2 ? { storeId } : "skip"
  ) as Segment[] | undefined

  const subscriberCounts = useQuery(
    api?.emailSubscribers?.countByStatus,
    storeId && step >= 2 ? { storeId } : "skip"
  ) as { active: number; total: number } | undefined

  const subscriberCount = subscriberCounts?.active

  const createMutation = useMutation(api?.emailCampaigns?.create)
  const scheduleMutation = useMutation(api?.emailCampaigns?.schedule)
  const sendAction = useAction(api?.emailCampaignActions?.send)

  const selectedTemplate = templates?.find((t: Template) => t._id === form.templateId)
  const selectedSegment = segments?.find((s: Segment) => s._id === form.segmentId)

  const audienceCount = form.segmentId
    ? (selectedSegment?.subscriberCount ?? 0)
    : (subscriberCount ?? 0)

  const patchForm = (patch: Partial<CampaignWizardState>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep(0)
      setForm(initialState)
    }
    onOpenChange(open)
  }

  // Validate current step before advancing
  const canAdvance = () => {
    switch (step) {
      case 0: return form.name.trim().length > 0 && form.subject.trim().length > 0
      case 1: return form.templateId.length > 0
      case 2: return true // audience is optional
      case 3: {
        if (!form.abTestEnabled) return true
        const total = form.variants.reduce((s, v) => s + v.percentage, 0)
        return Math.round(total) === 100 && form.variants.every((v) => v.subject.trim().length > 0)
      }
      case 4: return form.sendNow || form.scheduledAt.length > 0
      default: return true
    }
  }

  const handleSubmit = async () => {
    if (!storeId) return

    const scheduledAt = !form.sendNow && form.scheduledAt
      ? new Date(form.scheduledAt).getTime()
      : null

    // Validate
    const validation = validateCampaign({
      name: form.name,
      subject: form.subject,
      templateId: form.templateId,
      templateBlockCount: selectedTemplate?.blocks?.length ?? 0,
      audienceCount,
      abTestEnabled: form.abTestEnabled,
      variants: form.abTestEnabled ? form.variants : undefined,
      scheduledAt,
    })

    if (!validation.valid) {
      toast.error(validation.errors[0])
      return
    }

    setIsSubmitting(true)
    try {
      const campaignId = await createMutation({
        storeId,
        name: form.name.trim(),
        subject: form.subject.trim(),
        templateId: form.templateId,
        segmentId: form.segmentId || undefined,
        abTestEnabled: form.abTestEnabled,
        variants: form.abTestEnabled ? form.variants : undefined,
      })

      if (form.sendNow && campaignId) {
        toast.info("Envoi en cours...")
        const result = await sendAction({ campaignId })
        toast.success(`Campagne envoyée (${result?.sent ?? 0}/${result?.total ?? 0} emails)`)
      } else if (scheduledAt && campaignId) {
        await scheduleMutation({ id: campaignId, scheduledAt })
        toast.success("Campagne planifiée")
      } else {
        toast.success("Campagne créée en brouillon")
      }

      handleClose(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec : ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle campagne</DialogTitle>
          <DialogDescription>
            Étape {step + 1} / {STEPS.length} — {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step progress */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium shrink-0 ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[200px] max-h-[60vh] overflow-y-auto space-y-4 py-2">
          {/* Step 0: Informations */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="camp-name">Nom de la campagne *</Label>
                <Input
                  id="camp-name"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  placeholder="ex : Newsletter Février 2026"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-subject">Objet de l&apos;email *</Label>
                <Input
                  id="camp-subject"
                  value={form.subject}
                  onChange={(e) => patchForm({ subject: e.target.value })}
                  placeholder="ex : Vos offres exclusives ce mois-ci 🎉"
                />
              </div>
            </>
          )}

          {/* Step 1: Template */}
          {step === 1 && (
            <div className="space-y-3">
              <Label>Sélectionnez un modèle *</Label>
              {templates === undefined && (
                <p className="text-sm text-muted-foreground">Chargement des modèles...</p>
              )}
              {templates?.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun modèle disponible — créez-en un d&apos;abord</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {templates?.map((t: Template) => (
                  <div
                    key={t._id}
                    onClick={() => patchForm({ templateId: t._id })}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      form.templateId === t._id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{t.subject}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{t.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t.blocks?.length ?? 0} bloc{(t.blocks?.length ?? 0) > 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Audience */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Segment cible</Label>
                <Select value={form.segmentId || "all"} onValueChange={(v) => patchForm({ segmentId: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les abonnés actifs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les abonnés actifs</SelectItem>
                    {segments?.map((s: Segment) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name} ({s.subscriberCount} abonnés)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <span className="text-muted-foreground">Destinataires estimés : </span>
                <span className="font-semibold">
                  {audienceCount === undefined ? "..." : audienceCount.toLocaleString()} abonnés actifs
                </span>
              </div>
            </div>
          )}

          {/* Step 3: A/B test */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Activer le test A/B</Label>
                  <p className="text-xs text-muted-foreground">
                    Testez différents objets sur des sous-groupes de votre audience
                  </p>
                </div>
                <Switch
                  checked={form.abTestEnabled}
                  onCheckedChange={(v) => patchForm({ abTestEnabled: v })}
                />
              </div>

              {form.abTestEnabled && (
                <div className="space-y-3">
                  {form.variants.map((variant, i) => (
                    <div key={variant.id} className="rounded-lg border p-3 space-y-2">
                      <Label>Variante {String.fromCharCode(65 + i)}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Objet</Label>
                          <Input
                            value={variant.subject}
                            onChange={(e) => {
                              const updated = form.variants.map((v) =>
                                v.id === variant.id ? { ...v, subject: e.target.value } : v
                              )
                              patchForm({ variants: updated })
                            }}
                            placeholder={`Objet variante ${String.fromCharCode(65 + i)}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">% audience</Label>
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={variant.percentage}
                            onChange={(e) => {
                              const updated = form.variants.map((v) =>
                                v.id === variant.id ? { ...v, percentage: Number(e.target.value) } : v
                              )
                              patchForm({ variants: updated })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Total : {form.variants.reduce((s, v) => s + v.percentage, 0)}% (doit être 100%)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Envoyer immédiatement</Label>
                  <p className="text-xs text-muted-foreground">La campagne sera envoyée dès la création</p>
                </div>
                <Switch
                  checked={form.sendNow}
                  onCheckedChange={(v) => patchForm({ sendNow: v })}
                />
              </div>

              {!form.sendNow && (
                <div className="space-y-2">
                  <Label htmlFor="scheduled-at">Date et heure d&apos;envoi</Label>
                  <Input
                    id="scheduled-at"
                    type="datetime-local"
                    value={form.scheduledAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => patchForm({ scheduledAt: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Nom</p>
                    <p className="font-medium">{form.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Objet</p>
                    <p className="font-medium">{form.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Modèle</p>
                    <p className="font-medium">{selectedTemplate?.name ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Audience</p>
                    <p className="font-medium">
                      {form.segmentId
                        ? `${selectedSegment?.name} (${audienceCount} abonnés)`
                        : `Tous (${audienceCount} abonnés actifs)`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Test A/B</p>
                    <p className="font-medium">{form.abTestEnabled ? "Activé" : "Désactivé"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Envoi</p>
                    <p className="font-medium">
                      {form.sendNow
                        ? "Immédiat (brouillon)"
                        : form.scheduledAt
                        ? new Date(form.scheduledAt).toLocaleString("fr-FR")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.sendNow
                  ? "La campagne sera créée en brouillon. Utilisez le bouton Envoyer depuis la liste des campagnes pour l'envoyer."
                  : "La campagne sera planifiée et envoyée automatiquement à l'heure indiquée."}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Précédent
          </Button>

          <ButtonGroup>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Création..." : "Créer la campagne"}
              </Button>
            )}
          </ButtonGroup>
        </div>
      </DialogContent>
    </Dialog>
  )
}
