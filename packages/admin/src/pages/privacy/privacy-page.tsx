"use client"

import { useState } from "react"
import { useConvex, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { ShieldCheckIcon, DownloadIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { hasPermission, type Role } from "@be-yours/core"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Switch,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { PrivacyReport, type PrivacyReportShape } from "./privacy-report"

/**
 * Answering a customer who exercises their RGPD rights, from the dashboard.
 *
 * WHY IT EXISTS: a French restaurant running this product is the data
 * controller. It has one month to answer an access, erasure or portability
 * request, and until this screen there was no way to answer one at all — the
 * only delete that reached a diner's data was the one that deletes the entire
 * establishment.
 *
 * THE ORDER OF THE BUTTONS IS THE DESIGN. Preview, then export, then erase.
 * Erasure is irreversible and an address is easy to mistype, so the operator
 * looks first and is made to type the address a second time before anything
 * happens.
 */

interface PrivacyExportShape extends PrivacyReportShape {
  generatedAt: number
  subject: { email?: string; fingerprint?: string }
  records: Array<{ table: string; rows: unknown[] }>
}

interface RetentionShape {
  customerDataDays: number
  enabled: boolean
  isDefault: boolean
}

export function PrivacyPage() {
  const role = useAdminAuthStore((state) => state.role)
  const canManage = hasPermission(role as Role, "customers:manage")

  return (
    <div className="space-y-8">
      <PageHeader
        title="Données personnelles"
        description="Répondre à une demande d'accès, d'effacement ou de portabilité, et fixer la durée de conservation."
      />

      {!canManage ? (
        <Alert>
          <ShieldCheckIcon className="h-4 w-4" />
          <AlertTitle>Accès réservé</AlertTitle>
          <AlertDescription>
            Répondre à une demande RGPD engage l&apos;établissement en tant que responsable
            de traitement. Seul le propriétaire du compte peut le faire.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <SubjectRequestCard />
          <RetentionCard />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SubjectRequestCard() {
  const api = useAdminApiStore((state) => state.api)
  const convex = useConvex()
  const erase = useMutation(api?.privacy?.eraseDataSubject)

  const [email, setEmail] = useState("")
  const [fingerprint, setFingerprint] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState<"preview" | "export" | "erase" | null>(null)
  const [preview, setPreview] = useState<PrivacyReportShape | null>(null)
  const [done, setDone] = useState<PrivacyReportShape | null>(null)

  const subject = {
    ...(email.trim() ? { email: email.trim() } : {}),
    ...(fingerprint.trim() ? { fingerprint: fingerprint.trim() } : {}),
  }
  const named = Boolean(subject.email || subject.fingerprint)
  // Typed again, and folded before comparing — the operator is confirming an
  // address, not a capitalisation.
  const confirmed =
    subject.email !== undefined
      ? confirmation.trim().toLowerCase() === subject.email.toLowerCase()
      : confirmation.trim() === subject.fingerprint

  async function runPreview() {
    if (!api?.privacy) return
    setBusy("preview")
    setDone(null)
    try {
      const report = (await convex.query(
        api.privacy.previewErasure,
        subject
      )) as PrivacyReportShape
      setPreview(report)
    } catch (error) {
      toast.error(messageFor(error))
    } finally {
      setBusy(null)
    }
  }

  async function runExport() {
    if (!api?.privacy) return
    setBusy("export")
    try {
      const bundle = (await convex.query(
        api.privacy.exportDataSubject,
        subject
      )) as PrivacyExportShape
      // Art. 20 asks for a machine-readable format the person can take
      // elsewhere. This is the rows themselves, not a summary of them.
      downloadJson(bundle, subject.email ?? subject.fingerprint ?? "client")
      toast.success("Export téléchargé.")
    } catch (error) {
      toast.error(messageFor(error))
    } finally {
      setBusy(null)
    }
  }

  async function runErase() {
    if (!erase) return
    setBusy("erase")
    try {
      const result = (await erase(subject)) as { report: PrivacyReportShape }
      setDone(result.report)
      setPreview(null)
      setConfirmation("")
      toast.success(
        result.report.complete
          ? "Effacement terminé."
          : "Effacement en cours : il se poursuit en arrière-plan."
      )
    } catch (error) {
      toast.error(messageFor(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demande d&apos;un client</CardTitle>
        <CardDescription>
          Vérifiez d&apos;abord l&apos;identité de la personne — demandez un élément
          qu&apos;elle seule possède, par exemple un numéro de commande. Puis regardez ce
          que contient le compte avant d&apos;effacer quoi que ce soit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="privacy-email">Adresse e-mail</Label>
            <Input
              id="privacy-email"
              type="email"
              autoComplete="off"
              placeholder="client@example.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacy-fingerprint">
              Identifiant d&apos;appareil (jeu)
            </Label>
            <Input
              id="privacy-fingerprint"
              autoComplete="off"
              placeholder="fp-…"
              value={fingerprint}
              onChange={(event) => setFingerprint(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pour une personne qui a joué sans jamais donner son adresse. Elle le trouve
              sur la page du jeu, sur son propre téléphone.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!named || busy !== null}
            onClick={runPreview}
          >
            <SearchIcon className="mr-2 h-4 w-4" />
            {busy === "preview" ? "Recherche…" : "Voir ce que nous avons"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!named || busy !== null}
            onClick={runExport}
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            {busy === "export" ? "Export…" : "Exporter (art. 15 et 20)"}
          </Button>
        </div>

        {preview && (
          <div className="space-y-4 rounded-lg border p-4">
            <PrivacyReport report={preview} verb="seraient" />
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="privacy-confirm">
                Pour effacer, retapez l&apos;identifiant ci-dessus
              </Label>
              <Input
                id="privacy-confirm"
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                L&apos;effacement est définitif : il n&apos;existe aucun moyen de revenir
                en arrière, et aucune copie n&apos;est conservée quelque part.
              </p>
              <Button
                type="button"
                variant="destructive"
                disabled={!confirmed || busy !== null}
                onClick={runErase}
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                {busy === "erase" ? "Effacement…" : "Effacer définitivement (art. 17)"}
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="rounded-lg border border-emerald-300 p-4 dark:border-emerald-800">
            <PrivacyReport report={done} verb="ont été" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function RetentionCard() {
  const api = useAdminApiStore((state) => state.api)
  const current = useQuery(
    api?.privacy?.getRetention ?? "skip",
    api?.privacy ? {} : "skip"
  ) as RetentionShape | undefined
  const setRetention = useMutation(api?.privacy?.setRetention)

  const [days, setDays] = useState<string>("")
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  const effectiveDays = days !== "" ? days : String(current?.customerDataDays ?? "")
  const effectiveEnabled = enabled ?? current?.enabled ?? true

  async function save() {
    if (!setRetention) return
    setSaving(true)
    try {
      await setRetention({
        customerDataDays: Number(effectiveDays),
        enabled: effectiveEnabled,
      })
      setDays("")
      setEnabled(null)
      toast.success("Durée de conservation enregistrée.")
    } catch (error) {
      toast.error(
        messageFor(error).includes("RETENTION_WINDOW_OUT_OF_RANGE")
          ? "Durée hors limites : entre 30 jours et 10 ans."
          : messageFor(error)
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Durée de conservation</CardTitle>
        <CardDescription>
          Passé ce délai, les données personnelles de vos clients sont effacées
          automatiquement, chaque nuit. Les commandes, elles, sont conservées mais
          anonymisées : les montants et la TVA restent pour votre comptabilité, le client
          en disparaît.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {current?.isDefault && (
          <Alert>
            <AlertTitle>Valeur par défaut</AlertTitle>
            <AlertDescription>
              Trois ans à compter du dernier contact, la durée que la CNIL retient pour la
              clientèle d&apos;un commerce. Cette durée engage votre établissement :
              confirmez-la, ou ajustez-la avec votre conseil.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retention-days">Durée, en jours</Label>
            <Input
              id="retention-days"
              type="number"
              min={30}
              max={3650}
              value={effectiveDays}
              onChange={(event) => setDays(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              1095 jours = 3 ans. Entre 30 jours et 10 ans.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention-enabled">Effacement automatique</Label>
            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="retention-enabled"
                checked={effectiveEnabled}
                onCheckedChange={(next) => setEnabled(next)}
              />
              <span className="text-sm text-muted-foreground">
                {effectiveEnabled ? "Actif" : "En pause"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              En pause, rien n&apos;est supprimé — mais les données continuent de
              s&apos;accumuler au-delà de la durée que vous avez annoncée à vos clients.
            </p>
          </div>
        </div>

        <Button type="button" disabled={saving || !effectiveDays} onClick={save}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Une erreur est survenue."
}

/** Hand the bundle to the browser as a file the person can keep. */
function downloadJson(bundle: unknown, subject: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  link.download = `donnees-personnelles-${subject.replace(/[^a-z0-9.@-]/gi, "_")}-${stamp}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
