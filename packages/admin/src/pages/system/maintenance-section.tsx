"use client"

import { useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import {
  Loader2,
  WrenchIcon,
  ArrowRightLeftIcon,
  SendIcon,
} from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
  Textarea,
  Checkbox,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { BID_SUPPORT_EMAIL } from "../../lib/constants"
import type {
  MaintenanceOverview,
  MigrationRequest,
} from "./types"
import { formatDate, formatTimestamp, MIGRATION_SCOPE_LABELS } from "./helpers"
import { MaintenanceStatusBadge, MigrationStatusBadge } from "./status-badges"

/**
 * Renewal call-to-action: online Stripe checkout, with a mailto fallback
 * when a support email is configured.
 */
export function RenewalCta() {
  const { api } = useAdminApiStore()
  const createMaintenanceCheckout = useAction(
    api?.bidSubscription?.createMaintenanceCheckoutSession
  )
  const [redirecting, setRedirecting] = useState(false)

  const handleRenew = async () => {
    if (!api?.bidSubscription || !createMaintenanceCheckout) return
    setRedirecting(true)
    try {
      const result = await createMaintenanceCheckout({})
      if (result?.url) {
        window.location.href = result.url
        return
      }
      toast.error("Impossible d'ouvrir la page de paiement")
      setRedirecting(false)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erreur lors de la redirection vers le paiement"
      )
      setRedirecting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        onClick={handleRenew}
        disabled={redirecting || !api?.bidSubscription}
      >
        {redirecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Renouveler en ligne
      </Button>
      {BID_SUPPORT_EMAIL && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`mailto:${BID_SUPPORT_EMAIL}?subject=${encodeURIComponent(
              "Renouvellement du contrat de maintenance"
            )}`}
          >
            Contacter BeYours
          </a>
        </Button>
      )}
    </div>
  )
}

/** Manage the auto-renew subscription in the Stripe billing portal */
function BillingPortalButton() {
  const { api } = useAdminApiStore()
  const createPortalSession = useAction(
    api?.bidSubscription?.createPortalSession
  )
  const [redirecting, setRedirecting] = useState(false)

  const handleOpen = async () => {
    if (!api?.bidSubscription || !createPortalSession) return
    setRedirecting(true)
    try {
      const result = await createPortalSession({})
      if (result?.url) {
        window.location.href = result.url
        return
      }
      toast.error("Impossible d'ouvrir le portail de facturation")
      setRedirecting(false)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'ouverture du portail"
      )
      setRedirecting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpen}
      disabled={redirecting || !api?.bidSubscription}
    >
      {redirecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      Gerer dans le portail de facturation
    </Button>
  )
}

// ─── Section: Maintenance ────────────────────────────────────────────────────

function ContractCard({ overview }: { overview: MaintenanceOverview }) {
  const { contract, status, daysRemaining, entitlement } = overview

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <WrenchIcon className="h-5 w-5" />
              Contrat de maintenance
            </CardTitle>
            <CardDescription>
              Tant que la maintenance est active, votre site recoit
              automatiquement toutes les mises a jour de la plateforme.
            </CardDescription>
          </div>
          <MaintenanceStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contract ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Début de couverture</p>
              <p className="text-sm font-medium">{formatDate(contract.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fin de couverture</p>
              <p className="text-sm font-medium">{formatDate(contract.coveredUntil)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Renouvellement</p>
              <p className="text-sm font-medium">
                {contract.autoRenew ? "Automatique" : "Manuel (annuel)"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun contrat de maintenance n'est enregistre pour ce site.
            Contactez BeYours pour activer votre couverture.
          </p>
        )}

        {status === "active" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {daysRemaining} jours de couverture restants. Toutes les mises a
              jour publiées pendant cette période sont incluses.
            </p>
            {contract?.autoRenew && <BillingPortalButton />}
          </div>
        )}

        {status === "expiring_soon" && contract && (
          <div className="border border-amber-500/40 bg-amber-500/5 rounded-lg p-4 space-y-3">
            <p className="text-sm">
              Votre maintenance expire dans <strong>{daysRemaining} jour{daysRemaining > 1 ? "s" : ""}</strong>{" "}
              (le {formatDate(contract.coveredUntil)}). Passe cette date, votre
              site restera figé sur la dernière version couverte et ne recevra
              plus les nouvelles mises a jour.
            </p>
            <RenewalCta />
          </div>
        )}

        {status === "expired" && contract && (
          <div className="border border-red-500/40 bg-red-500/5 rounded-lg p-4 space-y-3">
            <p className="text-sm">
              Votre maintenance est terminee depuis le{" "}
              <strong>{formatDate(contract.coveredUntil)}</strong>. Votre site
              reste figé sur la dernière version couverte
              {entitlement.entitledVersion && (
                <>
                  {" "}(<span className="font-mono">{entitlement.entitledVersion}</span>)
                </>
              )}
              {entitlement.lockedVersions.length > 0 && (
                <>
                  {" "}— {entitlement.lockedVersions.length} mise
                  {entitlement.lockedVersions.length > 1 ? "s" : ""} a jour plus
                  recente{entitlement.lockedVersions.length > 1 ? "s" : ""} ne
                  {entitlement.lockedVersions.length > 1 ? " sont" : " est"} plus
                  accessible{entitlement.lockedVersions.length > 1 ? "s" : ""}
                </>
              )}
              . Renouvelez pour recevoir a nouveau les mises a jour, ou
              demandez la migration de votre site vers l'hébergeur et l'équipe
              de votre choix.
            </p>
            <RenewalCta />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const ALL_MIGRATION_SCOPES = ["code", "database", "assets", "domain", "emails"]

function MigrationRequestForm({
  onSubmitted,
}: {
  onSubmitted: () => void
}) {
  const { api } = useAdminApiStore()
  const requestMigration = useMutation(api?.maintenance?.requestMigration)

  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [targetProvider, setTargetProvider] = useState("")
  const [targetTeam, setTargetTeam] = useState("")
  const [targetTeamEmail, setTargetTeamEmail] = useState("")
  const [scope, setScope] = useState<string[]>(ALL_MIGRATION_SCOPES)
  const [preferredDate, setPreferredDate] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const toggleScope = (item: string, checked: boolean) => {
    setScope((prev) =>
      checked ? [...prev, item] : prev.filter((s) => s !== item)
    )
  }

  const canSubmit =
    contactEmail.trim().length > 0 &&
    targetProvider.trim().length > 0 &&
    scope.length > 0

  const handleSubmit = async () => {
    if (!api?.maintenance || !requestMigration || !canSubmit) return
    setSubmitting(true)
    try {
      await requestMigration({
        contactEmail: contactEmail.trim(),
        targetProvider: targetProvider.trim(),
        scope,
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        ...(targetTeam.trim() ? { targetTeam: targetTeam.trim() } : {}),
        ...(targetTeamEmail.trim()
          ? { targetTeamEmail: targetTeamEmail.trim() }
          : {}),
        ...(preferredDate
          ? { preferredDate: new Date(preferredDate).getTime() }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      toast.success(
        "Demande de migration envoyée. L'équipe BeYours vous recontactera."
      )
      onSubmitted()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'envoi de la demande"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="migration-email">Email de contact *</Label>
          <Input
            id="migration-email"
            type="email"
            placeholder="vous@restaurant.fr"
            value={contactEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="migration-phone">Telephone</Label>
          <Input
            id="migration-phone"
            type="tel"
            placeholder="+33 ..."
            value={contactPhone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="migration-provider">
          Serveur / hébergeur de destination *
        </Label>
        <Input
          id="migration-provider"
          placeholder="Ex : OVH, Vercel, AWS, serveur interne..."
          value={targetProvider}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetProvider(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="migration-team">Équipe repreneuse</Label>
          <Input
            id="migration-team"
            placeholder="Agence ou développeur qui reprend le site"
            value={targetTeam}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetTeam(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="migration-team-email">Email de l'équipe</Label>
          <Input
            id="migration-team-email"
            type="email"
            placeholder="tech@agence.fr"
            value={targetTeamEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetTeamEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Elements a migrer *</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_MIGRATION_SCOPES.map((item) => (
            <label
              key={item}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={scope.includes(item)}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  toggleScope(item, checked === true)
                }
              />
              {MIGRATION_SCOPE_LABELS[item]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="migration-date">Date souhaitée</Label>
          <Input
            id="migration-date"
            type="date"
            value={preferredDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPreferredDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="migration-notes">Precisions</Label>
        <Textarea
          id="migration-notes"
          placeholder="Contraintes, accès, contexte..."
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <SendIcon className="h-4 w-4 mr-2" />
          )}
          Envoyer la demande
        </Button>
      </div>
    </div>
  )
}

function OpenMigrationRequestView({
  request,
}: {
  request: MigrationRequest
}) {
  const { api } = useAdminApiStore()
  const cancelRequest = useMutation(api?.maintenance?.cancelMigrationRequest)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  const handleCancel = async () => {
    if (!api?.maintenance || !cancelRequest) return
    setCancelling(true)
    try {
      await cancelRequest({ requestId: request._id })
      toast.success("Demande de migration annulée")
      setConfirmCancelOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'annulation"
      )
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MigrationStatusBadge status={request.status} />
          <span className="text-sm text-muted-foreground">
            Demandee le {formatDate(request.createdAt)}
          </span>
        </div>
        {request.status !== "in_progress" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={cancelling || !api?.maintenance}
          >
            Annuler la demande
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Destination</p>
          <p className="text-sm font-medium">{request.targetProvider}</p>
        </div>
        {request.targetTeam && (
          <div>
            <p className="text-xs text-muted-foreground">Équipe repreneuse</p>
            <p className="text-sm font-medium">
              {request.targetTeam}
              {request.targetTeamEmail && (
                <span className="text-muted-foreground">
                  {" "}({request.targetTeamEmail})
                </span>
              )}
            </p>
          </div>
        )}
        {request.preferredDate && (
          <div>
            <p className="text-xs text-muted-foreground">Date souhaitée</p>
            <p className="text-sm font-medium">{formatDate(request.preferredDate)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Elements a migrer</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {request.scope.map((item) => (
              <Badge key={item} variant="secondary" className="text-xs">
                {MIGRATION_SCOPE_LABELS[item] ?? item}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="border rounded-lg p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Suivi</p>
        {request.statusHistory.map((entry, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">
              {formatTimestamp(entry.changedAt)}
            </span>
            <MigrationStatusBadge status={entry.status} />
            {entry.note && (
              <span className="text-muted-foreground">{entry.note}</span>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la demande de migration ?</AlertDialogTitle>
            <AlertDialogDescription>
              La demande en cours sera annulée. Vous pourrez en créer une
              nouvelle a tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.preventDefault()
                handleCancel()
              }}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MigrationCard({ overview }: { overview: MaintenanceOverview }) {
  const [formOpen, setFormOpen] = useState(false)
  const request = overview.openMigrationRequest

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeftIcon className="h-5 w-5" />
          Migration du site
        </CardTitle>
        <CardDescription>
          Votre site vous appartient : vous pouvez a tout moment demander sa
          migration complete vers le serveur et l'équipe de votre choix.
          L'équipe BeYours prepare alors le transfert (code, données,
          medias) avec votre repreneur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {request ? (
          <OpenMigrationRequestView request={request} />
        ) : (
          <>
            {(overview.status === "expired" || overview.status === "none") && (
              <p className="text-sm text-muted-foreground">
                Votre maintenance n'est plus active : si vous ne souhaitez pas
                renouveler, la migration vous permet de continuer a exploiter
                votre site sur votre propre infrastructure.
              </p>
            )}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <Button onClick={() => setFormOpen(true)}>
                <ArrowRightLeftIcon className="h-4 w-4 mr-2" />
                Demander une migration
              </Button>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Demande de migration</DialogTitle>
                  <DialogDescription>
                    Indiquez ou et vers qui migrer votre site. L'équipe
                    BeYours vous recontactera pour organiser le transfert.
                  </DialogDescription>
                </DialogHeader>
                <MigrationRequestForm onSubmitted={() => setFormOpen(false)} />
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function MaintenanceSection({
  overview,
}: {
  overview: MaintenanceOverview | undefined
}) {
  if (overview === undefined) {
    return <LoadingState variant="form" count={2} />
  }

  return (
    <div className="space-y-4">
      <ContractCard overview={overview} />
      <MigrationCard overview={overview} />
    </div>
  )
}
