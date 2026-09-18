"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { toast } from "sonner"
import { useState, useMemo } from "react"
import {
  PlusIcon,
  Send,
  MoreHorizontal,
  BarChart2,
  Trash2,
  PauseCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Pencil,
  Play,
  Eye,
  TestTube,
  Mail,
  Monitor,
  Smartphone,
} from "lucide-react"
import {
  Button,
  Badge,
  Input,
  Label,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-yours/ui"
import { renderTemplateToEmailHtml } from "@be-yours/marketing"
import type { EmailBranding, EmailBlock } from "@be-yours/marketing"
import { LoadingState } from "../../../components/loading-state"
import { DeleteConfirmDialog } from "../../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { adminRoutes } from "../../../config/admin-routes"
import { formatShortDate } from "../../../lib/formatters"
import { CampaignWizardDialog } from "./campaign-wizard-dialog"
import { CampaignStatsDialog } from "./campaign-stats-dialog"
import { RELAUNCHABLE_STATUSES } from "@be-yours/convex-functions/emailCampaigns"
import { convexErrorMessage } from "../../../lib/convex-error"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = any

type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "cancelled"
  | "failed"

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  sending: "En cours",
  sent: "Envoyée",
  paused: "En pause",
  cancelled: "Annulée",
  // The send stopped and could not continue. `campaign.failureReason` says
  // what to fix, and is shown under the badge — a status word on its own would
  // be no better than the log line this replaced.
  failed: "Échouée",
}

const STATUS_VARIANTS: Record<CampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "default",
  sent: "default",
  paused: "secondary",
  cancelled: "destructive",
  failed: "destructive",
}

export function EmailCampaignsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [statsCampaign, setStatsCampaign] = useState<Campaign | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const campaigns = useQuery(
    api?.emailCampaigns?.list,
    storeId ? { storeId } : "skip"
  ) as Campaign[] | undefined

  const emailConfig = useQuery(
    api?.emailConfig?.get,
    storeId ? { storeId } : "skip"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any | null | undefined

  const templates = useQuery(
    api?.emailTemplates?.list,
    storeId ? { storeId } : "skip"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any[] | undefined

  const isConfigMissing = emailConfig === null || (emailConfig && !emailConfig.fromEmail)

  const removeMutation = useMutation(api?.emailCampaigns?.remove)
  const createMutation = useMutation(api?.emailCampaigns?.create)
  const updateMutation = useMutation(api?.emailCampaigns?.update)
  const pauseMutation = useMutation(api?.emailCampaigns?.pause)
  const cancelMutation = useMutation(api?.emailCampaigns?.cancel)
  const sendAction = useAction(api?.emailCampaignActions?.send)
  const sendTestAction = useAction(api?.emailCampaignActions?.sendTest)

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [editForm, setEditForm] = useState({ name: "", subject: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Send test state
  const [testCampaign, setTestCampaign] = useState<Campaign | null>(null)
  const [testEmail, setTestEmail] = useState("")
  const [isSendingTest, setIsSendingTest] = useState(false)

  // Preview state
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null)
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")

  const filtered = useMemo(() => {
    if (!campaigns) return []
    let result = campaigns
    if (statusFilter !== "all") {
      result = result.filter((c: Campaign) => c.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c: Campaign) =>
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q)
      )
    }
    return result
  }, [campaigns, statusFilter, search])

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Campagne supprimée")
      setDeletingId(null)
    } catch (error: unknown) {
      // The refusal says this campaign already reached part of the list and
      // points at « Relancer ». Replacing it with a generic line is how an
      // owner ends up rebuilding the campaign and mailing those people twice.
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePause = async (id: string) => {
    try {
      await pauseMutation({ id })
      toast.success("Campagne mise en pause")
    } catch (error: unknown) {
      toast.error("Échec de la mise en pause")
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation({ id })
      toast.success("Campagne annulée")
    } catch (error: unknown) {
      toast.error("Échec de l'annulation")
    }
  }

  const handleSend = async (campaign: Campaign) => {
    setSendingId(campaign._id)
    try {
      // The action starts the send and returns; the work happens in scheduled
      // batches. It used to run the whole list inline and report a count, which
      // is what made a large campaign time out mid-flight. Announcing "envoyée"
      // with `result.sent` would now be false twice over — nothing has been
      // sent yet, and the number would be zero.
      await sendAction({ campaignId: campaign._id })
      toast.success(
        campaign.status === "paused"
          ? "Envoi repris. Les abonnés déjà servis ne le seront pas deux fois."
          : "Envoi démarré. La progression apparaît dans les statistiques."
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de l'envoi : ${message}`)
    } finally {
      setSendingId(null)
    }
  }

  const openEdit = (campaign: Campaign) => {
    setEditForm({ name: campaign.name, subject: campaign.subject })
    setEditingCampaign(campaign)
  }

  const handleSaveEdit = async () => {
    if (!editingCampaign) return
    setIsSaving(true)
    try {
      await updateMutation({
        id: editingCampaign._id,
        name: editForm.name.trim(),
        subject: editForm.subject.trim(),
      })
      toast.success("Campagne mise à jour")
      setEditingCampaign(null)
    } catch (error: unknown) {
      toast.error("Échec de la mise à jour")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDuplicate = async (campaign: Campaign) => {
    if (!storeId) return
    try {
      await createMutation({
        storeId,
        name: `${campaign.name} (copie)`,
        subject: campaign.subject,
        templateId: campaign.templateId,
        segmentId: campaign.segmentId || undefined,
        abTestEnabled: campaign.abTestEnabled ?? false,
        variants: campaign.variants,
      })
      toast.success("Campagne dupliquée")
    } catch (error: unknown) {
      toast.error("Échec de la duplication")
    }
  }

  const handleSendTest = async () => {
    if (!testCampaign || !testEmail.trim()) return
    setIsSendingTest(true)
    try {
      await sendTestAction({ campaignId: testCampaign._id, testEmail: testEmail.trim() })
      toast.success(`Email test envoyé à ${testEmail.trim()}`)
      setTestCampaign(null)
      setTestEmail("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de l'envoi test : ${message}`)
    } finally {
      setIsSendingTest(false)
    }
  }

  const getPreviewHtml = (campaign: Campaign): string | null => {
    const template = templates?.find((t: { _id: string }) => t._id === campaign.templateId)
    if (!template?.blocks) return null

    const branding: EmailBranding = {
      primaryColor: emailConfig?.branding?.primaryColor ?? "#1a1a1a",
      secondaryColor: emailConfig?.branding?.secondaryColor ?? "#f5f5f5",
      logoUrl: emailConfig?.branding?.logoUrl,
      footerText: emailConfig?.branding?.footerText ?? "Aperçu de la campagne",
      socialLinks: emailConfig?.branding?.socialLinks,
      senderName: emailConfig?.senderName ?? "Mon Restaurant",
      unsubscribeUrl: "#",
      unsubscribeText: emailConfig?.unsubscribeText ?? "Se désabonner",
    }

    return renderTemplateToEmailHtml(template.blocks as EmailBlock[], branding)
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Send /></EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer vos campagnes</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (campaigns === undefined) return <LoadingState />

  const sentCount = campaigns.filter((c: Campaign) => c.status === "sent").length

  return (
    <div className="space-y-4">
      {/* Missing config alert */}
      {isConfigMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Configuration email requise
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
              Configurez votre adresse d&apos;expéditeur dans{" "}
              <a href={adminRoutes.emailConfig} className="underline font-medium">Email &gt; Configuration</a>
              {" "}avant de créer une campagne.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campagnes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
            {sentCount > 0 && ` · ${sentCount} envoyée${sentCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsWizardOpen(true)} disabled={!!isConfigMissing}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouvelle campagne
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Rechercher une campagne..."
          value={search}
          onValueChange={setSearch}
          className="flex-1 sm:max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Send /></EmptyMedia>
            <EmptyTitle>Aucune campagne</EmptyTitle>
            <EmptyDescription>
              {search || statusFilter !== "all"
                ? "Aucune campagne pour ces filtres"
                : "Créez votre première campagne email"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Envoyés</TableHead>
                <TableHead>Ouverture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign: Campaign) => {
                const openRate = campaign.stats?.delivered > 0
                  ? Math.round((campaign.stats.opened / campaign.stats.delivered) * 100 * 10) / 10
                  : null

                return (
                  <TableRow key={campaign._id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {campaign.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[campaign.status as CampaignStatus] ?? "outline"}>
                        {STATUS_LABELS[campaign.status as CampaignStatus] ?? campaign.status}
                      </Badge>
                      {campaign.status === "failed" && campaign.failureReason && (
                        <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
                          {campaign.failureReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.stats?.sent > 0
                        ? campaign.stats.sent.toLocaleString()
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {openRate !== null
                        ? <span className={openRate >= 20 ? "text-success font-medium" : ""}>{openRate}%</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.sentAt
                        ? formatShortDate(campaign.sentAt)
                        : campaign.scheduledAt
                        ? `Planif. ${formatShortDate(campaign.scheduledAt)}`
                        : formatShortDate(campaign.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Send — draft or scheduled only */}
                          {["draft", "scheduled"].includes(campaign.status) && (
                            <DropdownMenuItem
                              onClick={() => handleSend(campaign)}
                              disabled={sendingId === campaign._id}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {sendingId === campaign._id ? "Envoi..." : "Envoyer"}
                            </DropdownMenuItem>
                          )}
                          {/* Edit — draft or scheduled only */}
                          {["draft", "scheduled"].includes(campaign.status) && (
                            <DropdownMenuItem onClick={() => openEdit(campaign)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {/* Preview */}
                          <DropdownMenuItem onClick={() => setPreviewCampaign(campaign)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Aperçu
                          </DropdownMenuItem>
                          {/* Send a test */}
                          <DropdownMenuItem onClick={() => { setTestCampaign(campaign); setTestEmail("") }}>
                            <TestTube className="mr-2 h-4 w-4" />
                            Envoyer un test
                          </DropdownMenuItem>
                          {/* Duplicate — always available */}
                          <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          {/* Resend was removed: a campaign that has already been sent must never be re-sent.
                             To resend, duplicate the campaign and send the copy. */}
                          {/* Stats — sent only */}
                          {campaign.status === "sent" && (
                            <DropdownMenuItem onClick={() => setStatsCampaign(campaign)}>
                              <BarChart2 className="mr-2 h-4 w-4" />
                              Voir les stats
                            </DropdownMenuItem>
                          )}
                          {/* Pause — while sending */}
                          {campaign.status === "sending" && (
                            <DropdownMenuItem onClick={() => handlePause(campaign._id)}>
                              <PauseCircle className="mr-2 h-4 w-4" />
                              Mettre en pause
                            </DropdownMenuItem>
                          )}
                          {/* Resume — while paused, or after a failed send the
                              owner has fixed. The cursor is kept, so it picks
                              up where it stopped.

                              The list comes from the server because the delete
                              refusal quotes this button by name: two literals
                              that agree today are how a message ends up naming
                              a control the screen is not rendering. */}
                          {RELAUNCHABLE_STATUSES.includes(campaign.status) && (
                            <DropdownMenuItem
                              onClick={() => handleSend(campaign)}
                              disabled={sendingId === campaign._id}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Relancer
                            </DropdownMenuItem>
                          )}
                          {/* Cancel */}
                          {["draft", "scheduled", "paused", "failed"].includes(campaign.status) && (
                            <DropdownMenuItem onClick={() => handleCancel(campaign._id)}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Annuler
                            </DropdownMenuItem>
                          )}
                          {/* Delete */}
                          {["draft", "cancelled", "failed"].includes(campaign.status) && (
                            <DropdownMenuItem
                              onClick={() => setDeletingId(campaign._id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Wizard */}
      <CampaignWizardDialog open={isWizardOpen} onOpenChange={setIsWizardOpen} />

      {/* Stats dialog */}
      <CampaignStatsDialog
        campaign={statsCampaign}
        open={!!statsCampaign}
        onOpenChange={(open) => !open && setStatsCampaign(null)}
      />

      {/* Edit dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && setEditingCampaign(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la campagne</DialogTitle>
            <DialogDescription>Modifiez le nom et l&apos;objet de la campagne.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Objet</Label>
              <Input
                id="edit-subject"
                value={editForm.subject}
                onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingCampaign(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSaving || !editForm.name.trim() || !editForm.subject.trim()}
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer cette campagne ?"
        description="Cette action est irréversible."
        isDeleting={isDeleting}
      />

      {/* Send test dialog */}
      <Dialog open={!!testCampaign} onOpenChange={(open) => !open && setTestCampaign(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Envoyer un email test
            </DialogTitle>
            <DialogDescription>
              Un email test avec le préfixe [TEST] sera envoyé à l&apos;adresse ci-dessous.
            </DialogDescription>
          </DialogHeader>
          {testCampaign && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Campagne :</span> {testCampaign.name}</p>
                <p><span className="text-muted-foreground">Objet :</span> [TEST] {testCampaign.subject}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-email">Adresse email de test</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && testEmail.trim()) handleSendTest()
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setTestCampaign(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSendTest}
              disabled={isSendingTest || !testEmail.trim() || !testEmail.includes("@")}
            >
              {isSendingTest ? "Envoi..." : "Envoyer le test"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewCampaign} onOpenChange={(open) => !open && setPreviewCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Aperçu — {previewCampaign?.name}
              </DialogTitle>
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <Button
                  variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <DialogDescription>
              Objet : {previewCampaign?.subject}
            </DialogDescription>
          </DialogHeader>
          {previewCampaign && (() => {
            const html = getPreviewHtml(previewCampaign)
            if (!html) {
              return (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  Modèle introuvable ou sans contenu
                </div>
              )
            }
            return (
              <div className="flex justify-center overflow-auto py-4 bg-muted/30 rounded-lg">
                <iframe
                  title="Aperçu campagne"
                  srcDoc={html}
                  className="rounded-lg border shadow-sm bg-white transition-all"
                  style={{
                    width: previewDevice === "mobile" ? "375px" : "600px",
                    height: "calc(80vh - 10rem)",
                    border: "none",
                  }}
                />
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
