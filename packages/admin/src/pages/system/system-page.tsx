"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  ServerIcon,
  DownloadIcon,
  UploadIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  HistoryIcon,
  LockIcon,
  UnlockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2,
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { APP_VERSION, BID_SUPPORT_EMAIL } from "../../lib/constants"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SystemInfo {
  deployedAppVersion: string | null
  backupFormatVersion: string
  appliedMigrations: Array<{ id: string; name: string; appliedAt: number }>
  systemLock: {
    operation: string
    lockedBy: string
    lockedAt: number
    expiresAt: number
  } | null
  isLockActive: boolean
  lastBackupAt: number | null
}

interface AuditEntry {
  _id: string
  action: string
  performedBy: string
  performedAt: number
  details?: string
  result: "success" | "failure"
  errorMessage?: string
}

interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  entitledVersion: string | null
  hasEntitledUpdate: boolean
  lockedVersions: string[]
  maintenanceStatus: MaintenanceStatus
  coveredUntil: number | null
  registryError: string | null
}

type MaintenanceStatus = "none" | "active" | "expiring_soon" | "expired"

type MigrationRequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined"

interface MigrationRequest {
  _id: string
  requestedBy: string
  contactEmail: string
  contactPhone?: string
  targetProvider: string
  targetTeam?: string
  targetTeamEmail?: string
  scope: string[]
  preferredDate?: number
  notes?: string
  status: MigrationRequestStatus
  statusHistory: Array<{
    status: MigrationRequestStatus
    changedAt: number
    changedBy: string
    note?: string
  }>
  createdAt: number
}

interface MaintenanceOverview {
  contract: {
    startedAt: number
    coveredUntil: number
    autoRenew: boolean
    lastRenewedAt?: number
    notes?: string
  } | null
  status: MaintenanceStatus
  daysRemaining: number
  currentVersion: string
  entitlement: {
    latestVersion: string | null
    entitledVersion: string | null
    hasUpdate: boolean
    hasEntitledUpdate: boolean
    lockedVersions: string[]
    maintenanceStatus: MaintenanceStatus
  }
  releases: Array<{
    _id: string
    version: string
    releasedAt: number
    notes: string | null
    covered: boolean
  }>
  openMigrationRequest: MigrationRequest | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    backup_export: "Export backup",
    backup_import: "Import backup",
    backup_import_dryrun: "Import (apercu)",
    migration_run: "Migration",
    version_check: "Verification version",
    lock_force_release: "Deverrouillage force",
    maintenance_contract_set: "Contrat maintenance",
    migration_request_created: "Demande de migration",
    migration_request_status_changed: "Migration (statut)",
  }
  return labels[action] ?? action
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

const MIGRATION_SCOPE_LABELS: Record<string, string> = {
  code: "Code du site",
  database: "Base de donnees",
  assets: "Medias & fichiers (S3)",
  domain: "Nom de domaine",
  emails: "Emails & templates",
}

const MIGRATION_STATUS_LABELS: Record<MigrationRequestStatus, string> = {
  pending: "En attente",
  acknowledged: "Prise en compte",
  in_progress: "En cours",
  completed: "Terminee",
  cancelled: "Annulee",
  declined: "Refusee",
}

function MigrationStatusBadge({ status }: { status: MigrationRequestStatus }) {
  const styles: Record<MigrationRequestStatus, string> = {
    pending: "bg-amber-500/10 text-amber-500",
    acknowledged: "bg-sky-500/10 text-sky-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    completed: "bg-emerald-500/10 text-emerald-500",
    cancelled: "bg-muted text-muted-foreground",
    declined: "bg-red-500/10 text-red-500",
  }
  return (
    <Badge variant="secondary" className={styles[status]}>
      {MIGRATION_STATUS_LABELS[status]}
    </Badge>
  )
}

function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  if (status === "active") {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
        <ShieldCheckIcon className="h-3 w-3 mr-1" />
        Maintenance active
      </Badge>
    )
  }
  if (status === "expiring_soon") {
    return (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
        <AlertTriangleIcon className="h-3 w-3 mr-1" />
        Expire bientot
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-500">
        <XCircleIcon className="h-3 w-3 mr-1" />
        Maintenance expiree
      </Badge>
    )
  }
  return <Badge variant="secondary">Aucun contrat</Badge>
}

/**
 * Renewal call-to-action: online Stripe checkout, with a mailto fallback
 * when a support email is configured.
 */
function RenewalCta() {
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
            Contacter BeInDigital
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

// ─── Section: System Info ────────────────────────────────────────────────────

function SystemInfoSection({
  info,
  overview,
}: {
  info: SystemInfo
  overview: MaintenanceOverview | undefined
}) {
  const versionMismatch =
    info.deployedAppVersion !== null && info.deployedAppVersion !== APP_VERSION

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Version runtime</CardDescription>
          <CardTitle className="text-2xl font-mono">{APP_VERSION}</CardTitle>
        </CardHeader>
        <CardContent>
          {versionMismatch ? (
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <AlertTriangleIcon className="h-3 w-3" />
              Snapshot DB : {info.deployedAppVersion}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Synchronise avec la base</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Maintenance</CardDescription>
          <CardTitle className="text-2xl">
            {overview === undefined ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MaintenanceStatusBadge status={overview.status} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview?.contract ? (
            <p className="text-xs text-muted-foreground">
              {overview.status === "expired"
                ? `Terminee le ${formatDate(overview.contract.coveredUntil)}`
                : `Couverte jusqu'au ${formatDate(overview.contract.coveredUntil)}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucun contrat enregistre
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Format de backup</CardDescription>
          <CardTitle className="text-2xl font-mono">{info.backupFormatVersion}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Dernier backup : {info.lastBackupAt ? formatTimestamp(info.lastBackupAt) : "Aucun"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Verrou systeme</CardDescription>
          <CardTitle className="text-2xl">
            {info.isLockActive ? (
              <span className="flex items-center gap-2 text-amber-500">
                <LockIcon className="h-5 w-5" /> Verrouille
              </span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-500">
                <UnlockIcon className="h-5 w-5" /> Libre
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {info.systemLock ? (
            <p className="text-xs text-muted-foreground">
              {info.systemLock.operation} par {info.systemLock.lockedBy}
              {!info.isLockActive && " (expire)"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune operation en cours</p>
          )}
        </CardContent>
      </Card>
    </div>
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
              <p className="text-xs text-muted-foreground">Debut de couverture</p>
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
            Contactez BeInDigital pour activer votre couverture.
          </p>
        )}

        {status === "active" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {daysRemaining} jours de couverture restants. Toutes les mises a
              jour publiees pendant cette periode sont incluses.
            </p>
            {contract?.autoRenew && <BillingPortalButton />}
          </div>
        )}

        {status === "expiring_soon" && contract && (
          <div className="border border-amber-500/40 bg-amber-500/5 rounded-lg p-4 space-y-3">
            <p className="text-sm">
              Votre maintenance expire dans <strong>{daysRemaining} jour{daysRemaining > 1 ? "s" : ""}</strong>{" "}
              (le {formatDate(contract.coveredUntil)}). Passe cette date, votre
              site restera fige sur la derniere version couverte et ne recevra
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
              reste fige sur la derniere version couverte
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
              demandez la migration de votre site vers l'hebergeur et l'equipe
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
        "Demande de migration envoyee. L'equipe BeInDigital vous recontactera."
      )
      onSubmitted()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Echec de l'envoi de la demande"
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
          Serveur / hebergeur de destination *
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
          <Label htmlFor="migration-team">Equipe repreneuse</Label>
          <Input
            id="migration-team"
            placeholder="Agence ou developpeur qui reprend le site"
            value={targetTeam}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetTeam(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="migration-team-email">Email de l'equipe</Label>
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
          <Label htmlFor="migration-date">Date souhaitee</Label>
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
          placeholder="Contraintes, acces, contexte..."
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
      toast.success("Demande de migration annulee")
      setConfirmCancelOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Echec de l'annulation"
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
            <p className="text-xs text-muted-foreground">Equipe repreneuse</p>
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
            <p className="text-xs text-muted-foreground">Date souhaitee</p>
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
              La demande en cours sera annulee. Vous pourrez en creer une
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
          migration complete vers le serveur et l'equipe de votre choix.
          L'equipe BeInDigital prepare alors le transfert (code, donnees,
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
                    Indiquez ou et vers qui migrer votre site. L'equipe
                    BeInDigital vous recontactera pour organiser le transfert.
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

function MaintenanceSection({
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

// ─── Section: Updates ────────────────────────────────────────────────────────

function UpdatesSection({
  overview,
}: {
  overview: MaintenanceOverview | undefined
}) {
  const { api } = useAdminApiStore()
  const checkForUpdates = useAction(api?.system?.checkForUpdates)
  const syncVersion = useMutation(api?.system?.syncVersion)
  const [checking, setChecking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)

  const handleCheck = async () => {
    if (!api?.system || !checkForUpdates) return
    setChecking(true)
    try {
      const result = await checkForUpdates({ currentVersion: APP_VERSION })
      setUpdateResult(result)
      if (result.hasEntitledUpdate) {
        toast.success(
          `Nouvelle version disponible : ${result.entitledVersion}`
        )
      } else if (result.hasUpdate) {
        toast.warning(
          "Une version plus recente existe mais n'est pas couverte par votre maintenance"
        )
      } else {
        toast.success("Vous etes a jour")
      }
    } catch {
      toast.error("Echec de la verification")
    } finally {
      setChecking(false)
    }
  }

  const handleSync = async () => {
    if (!api?.system || !syncVersion) return
    setSyncing(true)
    try {
      await syncVersion({ version: APP_VERSION })
      toast.success("Version synchronisee en base")
    } catch {
      toast.error("Echec de la synchronisation")
    } finally {
      setSyncing(false)
    }
  }

  const releases = overview?.releases ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCwIcon className="h-5 w-5" />
          Mises a jour
        </CardTitle>
        <CardDescription>
          Les mises a jour publiees pendant votre periode de maintenance sont
          incluses. Celles publiees apres la fin de couverture restent
          verrouillees jusqu'au renouvellement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleCheck} disabled={checking || !api?.system}>
            {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Verifier les mises a jour
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing || !api?.system}>
            {syncing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Synchroniser la version en base
          </Button>
        </div>

        {updateResult && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {updateResult.hasEntitledUpdate ? (
                <Badge variant="default" className="bg-emerald-500">
                  Mise a jour disponible
                </Badge>
              ) : updateResult.hasUpdate ? (
                <Badge variant="default" className="bg-amber-500">
                  <LockIcon className="h-3 w-3 mr-1" />
                  Mise a jour verrouillee
                </Badge>
              ) : (
                <Badge variant="secondary">A jour</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Version actuelle : <span className="font-mono">{updateResult.currentVersion}</span>
              {" — "}
              Derniere version publiee : <span className="font-mono">{updateResult.latestVersion}</span>
              {updateResult.entitledVersion && (
                <>
                  {" — "}
                  Derniere version couverte :{" "}
                  <span className="font-mono">{updateResult.entitledVersion}</span>
                </>
              )}
            </p>
            {updateResult.hasUpdate && !updateResult.hasEntitledUpdate && (
              <div className="space-y-2">
                <p className="text-sm text-amber-500 flex items-center gap-1">
                  <AlertTriangleIcon className="h-3 w-3" />
                  {updateResult.coveredUntil
                    ? `Version publiee apres la fin de votre maintenance (${formatDate(updateResult.coveredUntil)}).`
                    : "Aucun contrat de maintenance actif : les mises a jour ne sont pas accessibles."}
                </p>
                <RenewalCta />
              </div>
            )}
            {updateResult.registryError && (
              <p className="text-xs text-muted-foreground">
                Registre npm inaccessible ({updateResult.registryError}) —
                resultat base sur le catalogue local.
              </p>
            )}
          </div>
        )}

        {releases.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Publiee le</TableHead>
                  <TableHead>Acces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.slice(0, 8).map((release) => (
                  <TableRow key={release._id}>
                    <TableCell className="font-mono text-xs">
                      {release.version}
                      {release.version === APP_VERSION && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          installee
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(release.releasedAt)}
                    </TableCell>
                    <TableCell>
                      {release.covered ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-500"
                        >
                          <CheckCircle2Icon className="h-3 w-3 mr-1" />
                          Couverte
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-500"
                        >
                          <LockIcon className="h-3 w-3 mr-1" />
                          Verrouillee
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Backup & Restore ───────────────────────────────────────────────

function BackupSection() {
  const { api } = useAdminApiStore()
  const exportBackup = useAction(api?.system?.exportBackup)
  const importBackup = useAction(api?.system?.importBackup)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<{
    summary: Record<string, number>
    totalRows: number
  } | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    manifest: unknown
    data: unknown
  } | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const handleExport = async () => {
    if (!api?.system || !exportBackup) return
    setExporting(true)
    try {
      const result = await exportBackup({})
      // Download as JSON
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Backup exporte avec succes")
    } catch {
      toast.error("Echec de l'export")
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!api?.system || !importBackup) return
      const file = event.target.files?.[0]
      if (!file) return

      const MAX_BACKUP_SIZE = 50 * 1024 * 1024 // 50MB
      if (file.size > MAX_BACKUP_SIZE) {
        toast.error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum : 50 MB.`)
        return
      }
      if (file.type && file.type !== "application/json") {
        toast.error("Type de fichier invalide. Un fichier JSON est attendu.")
        return
      }

      try {
        const text = await file.text()
        const parsed = JSON.parse(text)

        if (!parsed.manifest || !parsed.data) {
          toast.error("Format de backup invalide")
          return
        }

        // Dry run first
        setImporting(true)
        const result = await importBackup({
          manifest: parsed.manifest,
          data: parsed.data,
          dryRun: true,
        })

        setDryRunResult({
          summary: result.summary,
          totalRows: result.totalRows,
        })
        setPendingImport({ manifest: parsed.manifest, data: parsed.data })
        setConfirmDialogOpen(true)
      } catch (error) {
        toast.error(
          error instanceof SyntaxError
            ? "Fichier JSON invalide"
            : "Echec de l'apercu"
        )
      } finally {
        setImporting(false)
        // Reset file input
        event.target.value = ""
      }
    },
    [api?.system, importBackup]
  )

  const handleConfirmImport = async () => {
    if (!pendingImport || !importBackup) return
    setImporting(true)
    try {
      const result = await importBackup({
        manifest: pendingImport.manifest,
        data: pendingImport.data,
        dryRun: false,
      })
      toast.success(`Import termine : ${result.totalRows} lignes importees`)
      setPendingImport(null)
      setDryRunResult(null)
      setConfirmDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import")
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5" />
            Sauvegarde & Restauration
          </CardTitle>
          <CardDescription>
            Exportez ou importez vos donnees. Les images S3 ne sont pas incluses — seules les references/URLs sont sauvegardees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleExport} disabled={exporting || !api?.system}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DownloadIcon className="h-4 w-4 mr-2" />
              )}
              Exporter un backup
            </Button>

            <Button variant="outline" asChild disabled={importing || !api?.system}>
              <label className="cursor-pointer">
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UploadIcon className="h-4 w-4 mr-2" />
                )}
                Importer un backup
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={importing}
                />
              </label>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            L'import effectue d'abord un apercu (dry run) avant toute modification.
          </p>
        </CardContent>
      </Card>

      {/* Import confirmation dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!importing) setConfirmDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'import</DialogTitle>
            <DialogDescription>
              Ceci va remplacer toutes les donnees existantes. Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>

          {dryRunResult && (
            <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              <p className="text-sm font-medium">
                Resume : {dryRunResult.totalRows} lignes au total
              </p>
              <div className="space-y-1">
                {Object.entries(dryRunResult.summary).map(([table, count]) => (
                  <div
                    key={table}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span className="font-mono">{table}</span>
                    <span>{count} lignes</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={importing}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirmImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {importing ? "Import en cours..." : "Confirmer l'import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Section: Migrations ─────────────────────────────────────────────────────

function MigrationsSection({ info }: { info: SystemInfo }) {
  const { api } = useAdminApiStore()
  const runMigrations = useAction(api?.system?.runMigrations)
  const [running, setRunning] = useState(false)

  const handleRun = async () => {
    if (!api?.system || !runMigrations) return
    setRunning(true)
    try {
      const result = await runMigrations({})
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Echec des migrations")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5" />
          Migrations
        </CardTitle>
        <CardDescription>
          Gerez les migrations de donnees de votre application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRun} disabled={running || !api?.system}>
          {running && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Executer les migrations en attente
        </Button>

        {info.appliedMigrations.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Appliquee le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.appliedMigrations.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(m.appliedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune migration appliquee</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Audit Log ──────────────────────────────────────────────────────

function AuditLogSection() {
  const { api } = useAdminApiStore()
  const [filterAction, setFilterAction] = useState<string>("all")
  const [cursor, setCursor] = useState<string | null>(null)
  const PAGE_SIZE = 10

  const auditLog = useQuery(
    api?.system?.getAuditLog ?? "skip",
    api?.system ? {
      paginationOpts: { cursor, numItems: PAGE_SIZE },
      filterAction: filterAction === "all" ? undefined : filterAction,
    } : "skip"
  ) as
    | {
        page: AuditEntry[]
        continueCursor: string | null
        isDone: boolean
      }
    | undefined

  const handlePrev = () => {
    // Simple approach: go back to the beginning
    setCursor(null)
  }

  const handleNext = () => {
    if (auditLog?.continueCursor) {
      setCursor(auditLog.continueCursor)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Journal d'activite
            </CardTitle>
            <CardDescription>
              Historique des operations systeme
            </CardDescription>
          </div>
          <Select
            value={filterAction}
            onValueChange={(val) => {
              setFilterAction(val)
              setCursor(null)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrer par action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              <SelectItem value="backup_export">Export backup</SelectItem>
              <SelectItem value="backup_import">Import backup</SelectItem>
              <SelectItem value="backup_import_dryrun">Import (apercu)</SelectItem>
              <SelectItem value="migration_run">Migration</SelectItem>
              <SelectItem value="version_check">Verification version</SelectItem>
              <SelectItem value="lock_force_release">Deverrouillage</SelectItem>
              <SelectItem value="maintenance_contract_set">Contrat maintenance</SelectItem>
              <SelectItem value="migration_request_created">Demande de migration</SelectItem>
              <SelectItem value="migration_request_status_changed">Migration (statut)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {auditLog === undefined ? (
          <LoadingState variant="table" count={5} />
        ) : auditLog.page.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune entree dans le journal
          </p>
        ) : (
          <>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resultat</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.page.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <span className="text-sm">{formatActionLabel(entry.action)}</span>
                      </TableCell>
                      <TableCell>
                        {entry.result === "success" ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-500"
                          >
                            <CheckCircle2Icon className="h-3 w-3 mr-1" />
                            Succes
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-red-500/10 text-red-500"
                          >
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Echec
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatTimestamp(entry.performedAt)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {entry.errorMessage ?? entry.details ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={!cursor}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Debut
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={auditLog.isDone}
              >
                Suivant
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Section: Force Unlock ───────────────────────────────────────────────────

function ForceUnlockButton({ info }: { info: SystemInfo }) {
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
      toast.success("Verrou systeme libere")
      setConfirmUnlockOpen(false)
    } catch {
      toast.error("Echec du deverrouillage")
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
              Cette action va forcer la liberation du verrou systeme. Si une operation est en cours, elle pourrait etre corrompue. Etes-vous sur de vouloir continuer ?
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SystemPage() {
  const { api } = useAdminApiStore()

  const systemInfo = useQuery(
    api?.system?.getSystemInfo ?? "skip",
    api?.system ? {} : "skip"
  ) as
    | SystemInfo
    | undefined

  const maintenanceOverview = useQuery(
    api?.maintenance?.getOverview ?? "skip",
    api?.maintenance ? { currentVersion: APP_VERSION } : "skip"
  ) as MaintenanceOverview | undefined

  // Back from Stripe Checkout (?maintenance=success) — the contract itself
  // is updated by the webhook and refreshes live via the reactive query
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("maintenance") === "success") {
      toast.success(
        "Renouvellement de la maintenance active. La couverture se met a jour d'ici quelques instants."
      )
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  if (systemInfo === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Systeme</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centre de controle systeme
          </p>
        </div>
        <LoadingState variant="form" count={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ServerIcon className="h-6 w-6" />
            Systeme
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maintenance, mises a jour, sauvegardes et journal d'activite
          </p>
        </div>
        <ForceUnlockButton info={systemInfo} />
      </div>

      {/* System Info Cards */}
      <SystemInfoSection info={systemInfo} overview={maintenanceOverview} />

      {/* Tabbed Sections */}
      <Tabs defaultValue="maintenance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="updates">Mises a jour</TabsTrigger>
          <TabsTrigger value="backup">Sauvegarde</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="audit">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance">
          <MaintenanceSection overview={maintenanceOverview} />
        </TabsContent>

        <TabsContent value="updates">
          <UpdatesSection overview={maintenanceOverview} />
        </TabsContent>

        <TabsContent value="backup">
          <BackupSection />
        </TabsContent>

        <TabsContent value="migrations">
          <MigrationsSection info={systemInfo} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
