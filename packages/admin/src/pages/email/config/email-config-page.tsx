"use client"

import { useQuery, useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useEffect } from "react"
import { Settings2 } from "lucide-react"
import {
  Button,
  ButtonGroup,
  Input,
  Textarea,
  Label,
  Switch,
  Card,
  CardContent,
  CardHeader,
  Separator,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../../components/loading-state"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"

const emailConfigSchema = z.object({
  senderName: z.string().min(1, "Le nom d'expéditeur est requis").max(100),
  fromEmail: z.string().email("Email invalide"),
  replyToEmail: z.string().email("Email invalide"),
  // Branding
  logoUrl: z.string().url("URL invalide").or(z.literal("")).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale invalide"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale invalide"),
  footerText: z.string().max(500).optional(),
  socialFacebook: z.string().url("URL invalide").or(z.literal("")).optional(),
  socialInstagram: z.string().url("URL invalide").or(z.literal("")).optional(),
  socialWebsite: z.string().url("URL invalide").or(z.literal("")).optional(),
  // Settings
  unsubscribeText: z.string().min(1, "Le texte de désabonnement est requis").max(200),
  maxEmailsPerWeek: z.coerce.number().min(1).max(100),
  // Automations
  welcomeEnabled: z.boolean(),
  postOrderEnabled: z.boolean(),
  birthdayEnabled: z.boolean(),
  inactiveEnabled: z.boolean(),
  abandonedCartEnabled: z.boolean(),
})

type EmailConfigFormData = z.infer<typeof emailConfigSchema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmailConfig = any

export function EmailConfigPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const config = useQuery(
    api?.emailConfig?.get,
    storeId ? { storeId } : "skip"
  ) as EmailConfig | null | undefined

  const upsertMutation = useMutation(api?.emailConfig?.upsert)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmailConfigFormData>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      senderName: "",
      fromEmail: "",
      replyToEmail: "",
      logoUrl: "",
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      footerText: "",
      socialFacebook: "",
      socialInstagram: "",
      socialWebsite: "",
      unsubscribeText: "Se désabonner",
      maxEmailsPerWeek: 3,
      welcomeEnabled: true,
      postOrderEnabled: true,
      birthdayEnabled: false,
      inactiveEnabled: false,
      abandonedCartEnabled: false,
    },
  })

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      reset({
        senderName: config.senderName ?? "",
        fromEmail: config.fromEmail ?? "",
        replyToEmail: config.replyToEmail ?? "",
        logoUrl: config.branding?.logoUrl ?? "",
        primaryColor: config.branding?.primaryColor ?? "#000000",
        secondaryColor: config.branding?.secondaryColor ?? "#ffffff",
        footerText: config.branding?.footerText ?? "",
        socialFacebook: config.branding?.socialLinks?.facebook ?? "",
        socialInstagram: config.branding?.socialLinks?.instagram ?? "",
        socialWebsite: config.branding?.socialLinks?.website ?? "",
        unsubscribeText: config.unsubscribeText ?? "Se désabonner",
        maxEmailsPerWeek: config.maxEmailsPerWeek ?? 3,
        welcomeEnabled: config.automationSettings?.welcomeEnabled ?? true,
        postOrderEnabled: config.automationSettings?.postOrderEnabled ?? true,
        birthdayEnabled: config.automationSettings?.birthdayEnabled ?? false,
        inactiveEnabled: config.automationSettings?.inactiveEnabled ?? false,
        abandonedCartEnabled: config.automationSettings?.abandonedCartEnabled ?? false,
      })
    }
  }, [config, reset])

  const onSubmit = async (data: EmailConfigFormData) => {
    if (!storeId) return
    try {
      await upsertMutation({
        storeId,
        senderName: data.senderName,
        fromEmail: data.fromEmail,
        replyToEmail: data.replyToEmail,
        branding: {
          logoUrl: data.logoUrl || undefined,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          footerText: data.footerText || undefined,
          socialLinks: {
            facebook: data.socialFacebook || undefined,
            instagram: data.socialInstagram || undefined,
            website: data.socialWebsite || undefined,
          },
        },
        unsubscribeText: data.unsubscribeText,
        maxEmailsPerWeek: data.maxEmailsPerWeek,
        automationSettings: {
          welcomeEnabled: data.welcomeEnabled,
          postOrderEnabled: data.postOrderEnabled,
          birthdayEnabled: data.birthdayEnabled,
          inactiveEnabled: data.inactiveEnabled,
          abandonedCartEnabled: data.abandonedCartEnabled,
        },
      })
      toast.success("Configuration email sauvegardée")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de la sauvegarde : ${message}`)
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings2 />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>
            Veuillez sélectionner un établissement pour configurer l&apos;email marketing
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (config === undefined) {
    return <LoadingState variant="form" />
  }

  const automations = [
    { key: "welcomeEnabled" as const, label: "Email de bienvenue", description: "Envoyé après la confirmation du double opt-in" },
    { key: "postOrderEnabled" as const, label: "Email post-commande", description: "Envoyé 2h après une commande confirmée" },
    { key: "birthdayEnabled" as const, label: "Email d'anniversaire", description: "Envoyé le jour de l'anniversaire de l'abonné" },
    { key: "inactiveEnabled" as const, label: "Email de réengagement", description: "Pour les abonnés inactifs depuis 90 jours" },
    { key: "abandonedCartEnabled" as const, label: "Panier abandonné", description: "Rappel 1h après un panier non finalisé" },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configuration Email</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Expéditeur, branding et paramètres de vos campagnes email
          </p>
        </div>
        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      {/* Expéditeur */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Expéditeur</h2>
          <p className="text-sm text-muted-foreground">
            Ces informations apparaissent dans la boîte de réception de vos destinataires
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senderName">Nom de l&apos;expéditeur *</Label>
              <Input
                id="senderName"
                {...register("senderName")}
                placeholder="Chez Mario"
              />
              {errors.senderName && (
                <p className="text-xs text-destructive">{errors.senderName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">Email d&apos;envoi (from) *</Label>
              <Input
                id="fromEmail"
                type="email"
                {...register("fromEmail")}
                placeholder="hello@chezmario.fr"
              />
              <p className="text-xs text-muted-foreground">Doit être vérifié dans AWS SES</p>
              {errors.fromEmail && (
                <p className="text-xs text-destructive">{errors.fromEmail.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="replyToEmail">Email de réponse (reply-to) *</Label>
            <Input
              id="replyToEmail"
              type="email"
              {...register("replyToEmail")}
              placeholder="contact@chezmario.fr"
            />
            {errors.replyToEmail && (
              <p className="text-xs text-destructive">{errors.replyToEmail.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Branding</h2>
          <p className="text-sm text-muted-foreground">
            Personnalisez l&apos;apparence de vos emails
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logoUrl">URL du logo</Label>
            <Input
              id="logoUrl"
              {...register("logoUrl")}
              placeholder="https://example.com/logo.png"
            />
            {errors.logoUrl && (
              <p className="text-xs text-destructive">{errors.logoUrl.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Couleur principale</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  {...register("primaryColor")}
                  placeholder="#000000"
                  className="flex-1"
                />
                <input
                  type="color"
                  value={watch("primaryColor")}
                  onChange={(e) => setValue("primaryColor", e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
              {errors.primaryColor && (
                <p className="text-xs text-destructive">{errors.primaryColor.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Couleur secondaire</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="secondaryColor"
                  {...register("secondaryColor")}
                  placeholder="#ffffff"
                  className="flex-1"
                />
                <input
                  type="color"
                  value={watch("secondaryColor")}
                  onChange={(e) => setValue("secondaryColor", e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
              {errors.secondaryColor && (
                <p className="text-xs text-destructive">{errors.secondaryColor.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footerText">Texte du pied de page</Label>
            <Textarea
              id="footerText"
              {...register("footerText")}
              placeholder="© 2026 Chez Mario. 12 rue de la Paix, 75001 Paris."
              rows={2}
            />
          </div>

          <Separator />

          <div>
            <Label className="text-sm font-medium">Liens réseaux sociaux</Label>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="socialFacebook" className="text-xs text-muted-foreground">Facebook</Label>
                <Input
                  id="socialFacebook"
                  {...register("socialFacebook")}
                  placeholder="https://facebook.com/chezmario"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="socialInstagram" className="text-xs text-muted-foreground">Instagram</Label>
                <Input
                  id="socialInstagram"
                  {...register("socialInstagram")}
                  placeholder="https://instagram.com/chezmario"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="socialWebsite" className="text-xs text-muted-foreground">Site web</Label>
                <Input
                  id="socialWebsite"
                  {...register("socialWebsite")}
                  placeholder="https://chezmario.fr"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paramètres */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Paramètres d&apos;envoi</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unsubscribeText">Texte du lien de désabonnement</Label>
              <Input
                id="unsubscribeText"
                {...register("unsubscribeText")}
                placeholder="Se désabonner"
              />
              {errors.unsubscribeText && (
                <p className="text-xs text-destructive">{errors.unsubscribeText.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxEmailsPerWeek">Max emails par semaine (par abonné)</Label>
              <Input
                id="maxEmailsPerWeek"
                type="number"
                min="1"
                max="100"
                {...register("maxEmailsPerWeek")}
              />
              <p className="text-xs text-muted-foreground">Protection anti-spam</p>
              {errors.maxEmailsPerWeek && (
                <p className="text-xs text-destructive">{errors.maxEmailsPerWeek.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automations */}
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">Automations</h2>
          <p className="text-sm text-muted-foreground">
            Activez ou désactivez les séquences automatiques
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {automations.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={key}>{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                id={key}
                checked={watch(key)}
                onCheckedChange={(checked) => setValue(key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex justify-end">
        <ButtonGroup>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer la configuration"}
          </Button>
        </ButtonGroup>
      </div>
    </form>
  )
}
