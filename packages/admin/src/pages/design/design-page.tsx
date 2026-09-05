"use client"

/**
 * Colours, typography and logo for one establishment — and why none of it
 * reaches the public site yet.
 *
 * WHAT IS CORRECT, AND MUST NOT BE "FIXED" BY DELETING IT: the write path.
 * `stores.updateBranding` is a real `storeMutation`, gated on `stores:write`,
 * validated field by field against `BRANDING_FIELDS`, merging rather than
 * replacing so a partial save stays partial, and audited through
 * `recordStoreAudit`. Nothing about it is broken. A future reader who finds
 * these buttons disabled and concludes the mutation is dead code would be
 * removing the half of the chain that works.
 *
 * WHAT IS MISSING: the reader. There are zero reads of the Convex
 * `store.branding` document in either app — not under `app`, not under
 * `components`, not under `lib`. Every branding read in the product goes
 * through the CMS block instead —
 * `cms.block("branding")` on the `storefront-layout` page — and that is true of
 * the storefront header, the dynamic favicon, the JSON-LD in
 * `lib/structured-data.ts`, and even the admin sidebar in
 * `app/(admin)/layout.tsx`. The storefront's palette and fonts are not read
 * from anywhere at runtime at all: they are compile-time constants in
 * `app/globals.css` and `site/fonts.ts` via `next/font/google`. So an owner
 * picked a colour, was told "Couleurs mises à jour avec succès", and their site
 * was unchanged.
 *
 * WHY THE TABS ARE DISABLED RATHER THAN WIRED HERE: there are two rival stores
 * for the same facts — the Convex `store.branding` document and the CMS
 * `branding` block — and they have to be reconciled before either can render.
 * Choosing which one wins is not a decision this screen can make: the CMS block
 * already owns the logo across four surfaces and carries drafts, publishing and
 * media handling; `store.branding` carries colours and fonts, which the CMS has
 * no field type for and which have to become CSS custom properties before any
 * component can consume them. Wiring one of them up in isolation would leave a
 * logo that answers to two screens.
 *
 * THE THEME TAB IS GONE, not disabled. It offered six themes — `fast-food`,
 * `pizzeria`, `chinese`, `fine-dining`, `cafe`, `sushi` — of which two
 * (`fine-dining`, `cafe`) matched no template anywhere in the repository, and
 * the other four were loose approximations of template families rather than
 * anything selectable. Its "Appliquer" button called the colours save: it wrote
 * three hex strings and let the chosen `theme.id` die in local React state.
 * `themeId` is in the schema with no writer and no reader. Choosing a design is
 * an operator running `pnpm template:apply <slug>` when the client repository
 * is cloned, which `apps/themes/README.md` documents.
 *
 * THE LOGO TAB POINTS AT THE CMS rather than duplicating it. Unlike colours and
 * typography, the logo is not waiting on wiring — a control for it already
 * ships, works, and drives every surface that shows a logo. This screen's
 * version was a second, rival input for the same fact, whose value nothing
 * read. Sending the owner to the one that works is more useful than disabling
 * ours, so `logoUrl` and `faviconUrl` now have no writer here; they keep their
 * place in `BRANDING_FIELDS` because deployed stores may already hold them and
 * `mergeBranding` must keep carrying them through.
 */

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"
import {
  Alert,
  Button,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { adminRoutes } from "../../config/admin-routes"
import { ResolvingStore } from "../../components/resolving-store"
import { unappliedBrandingState } from "../../lib/branding-eligibility"
import { BrandingControl } from "./branding-control"

/**
 * The CMS page that genuinely owns the logo, favicon and brand name.
 *
 * Both apps register this slug (`cms/index.ts`) with a `branding` block, under
 * the `storefront` group labelled "Vitrine". The slug is spelled here because
 * `packages/admin` has no view of an app's CMS registry; `design-surface.test.ts`
 * checks it against both apps so this link cannot start pointing at a page that
 * no longer exists.
 */
const STOREFRONT_LAYOUT_SLUG = "storefront-layout"

export function DesignPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  // `stores:read` gets a role onto this screen; `stores:write` is what
  // `stores.updateBranding` checks on the click. `manager` holds the first and
  // not the second, so the two sets are not the same people. On top of that,
  // no role at all can make these settings reach the site today — see
  // `unappliedBrandingState`.
  const role = useAdminAuthStore((s) => s.role)
  const branding = unappliedBrandingState(role)
  const store = useQuery(
    api?.stores?.getById,
    storeId ? { id: storeId } : "skip"
  )
  const updateBranding = useMutation(api?.stores?.updateBranding)

  const [primaryColor, setPrimaryColor] = useState("#000000")
  const [secondaryColor, setSecondaryColor] = useState("#ffffff")
  const [accentColor, setAccentColor] = useState("#0066cc")
  const [fontHeading, setFontHeading] = useState("Inter")
  const [fontBody, setFontBody] = useState("Inter")

  const initialized = useRef(false)
  useEffect(() => {
    if (store?.branding && !initialized.current) {
      setPrimaryColor(store.branding.primaryColor || "#000000")
      setSecondaryColor(store.branding.secondaryColor || "#ffffff")
      setAccentColor(store.branding.accentColor || "#0066cc")
      setFontHeading(store.branding.fontHeading || "Inter")
      setFontBody(store.branding.fontBody || "Inter")
      initialized.current = true
    }
  }, [store])

  /**
   * Kept, and kept correct, while the button that calls it is inert.
   *
   * The mutation, the permission and the audit entry are all right; only the
   * reader is missing. Deleting these handlers would mean rebuilding them
   * against a validator that already accepts exactly these fields.
   */
  const handleSaveColors = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        branding: { primaryColor, secondaryColor, accentColor },
      })
      toast.success("Couleurs mises à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour des couleurs")
      console.error(error)
    }
  }

  const handleSaveTypography = async () => {
    if (!storeId) return
    try {
      await updateBranding({
        id: storeId,
        branding: { fontHeading, fontBody },
      })
      toast.success("Typographie mise à jour avec succès")
    } catch (error) {
      toast.error("Échec de la mise à jour de la typographie")
      console.error(error)
    }
  }

  if (!storeId) return <ResolvingStore />

  if (store === undefined) {
    return <LoadingState />
  }

  /** A logo saved on this screen before the CMS block took the job over. */
  const orphanedLogoUrl: string | undefined =
    store?.branding?.logoUrl || store?.branding?.faviconUrl

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Design</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez l'apparence de votre établissement
        </p>
      </div>

      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colors">Couleurs</TabsTrigger>
          <TabsTrigger value="typography">Typographie</TabsTrigger>
          <TabsTrigger value="logo">Logo</TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-4">
          {/*
            The plain version of the header comment, for the person who has to
            live with it. No date, and no suggestion that saving would do
            anything: the button is disabled precisely so that it stops
            promising a change customers would not see.
          */}
          <Alert
            variant="warning"
            title="Ces couleurs ne s'appliquent pas encore à votre site"
            data-testid="branding-colors-unapplied"
          >
            <p>
              Votre site public affiche les couleurs de son modèle de design, et
              cet écran ne les remplace pas encore. L&apos;enregistrement est
              donc désactivé : il vous annoncerait un changement que vos clients
              ne verraient pas. Le modèle, lui, se choisit à l&apos;installation
              du site — voyez avec votre intégrateur.
            </p>
          </Alert>

          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Couleur primaire</Label>
                <div className="flex gap-2">
                  <Input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 h-9" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
                <div className="h-16 rounded-lg border" style={{ backgroundColor: primaryColor }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Couleur secondaire</Label>
                <div className="flex gap-2">
                  <Input id="secondaryColor" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-16 h-9" />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                </div>
                <div className="h-16 rounded-lg border" style={{ backgroundColor: secondaryColor }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Couleur d'accent</Label>
                <div className="flex gap-2">
                  <Input id="accentColor" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-16 h-9" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                </div>
                <div className="h-16 rounded-lg border" style={{ backgroundColor: accentColor }} />
              </div>
            </div>
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveColors}>
                Enregistrer les couleurs
              </Button>
            </BrandingControl>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          {/*
            The last sentence is not padding. The previews below set
            `fontFamily` inline, so they resolve against the fonts installed on
            the operator's own machine — an owner typing a font name they have
            locally sees it change here and nowhere else, which is the most
            convincing wrong signal on the screen.
          */}
          <Alert
            variant="warning"
            title="Ces polices ne s'appliquent pas encore à votre site"
            data-testid="branding-typography-unapplied"
          >
            <p>
              Les titres et le texte de votre site public utilisent les polices
              de son modèle de design, chargées avec la page.
              L&apos;enregistrement est désactivé tant que cet écran ne les
              remplace pas. L&apos;aperçu ci-dessous utilise les polices
              installées sur votre ordinateur : il ne montre pas ce que verront
              vos clients.
            </p>
          </Alert>

          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontHeading">Police des titres</Label>
                <Input id="fontHeading" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} placeholder="Inter, Roboto, Arial..." />
                <div className="p-4 border rounded-lg text-2xl font-bold" style={{ fontFamily: fontHeading }}>
                  Exemple de titre
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontBody">Police du texte</Label>
                <Input id="fontBody" value={fontBody} onChange={(e) => setFontBody(e.target.value)} placeholder="Inter, Roboto, Arial..." />
                <div className="p-4 border rounded-lg text-sm" style={{ fontFamily: fontBody }}>
                  Ceci est un exemple de texte qui montre comment votre contenu
                  apparaîtra avec la police sélectionnée.
                </div>
              </div>
            </div>
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveTypography}>
                Enregistrer la typographie
              </Button>
            </BrandingControl>
          </div>
        </TabsContent>

        {/*
          A signpost, not a form. The CMS `branding` block is what the storefront
          header, the browser tab icon, the JSON-LD and this dashboard's own
          sidebar all read; the two URL fields that used to live here were read
          by nothing.
        */}
        <TabsContent value="logo" className="space-y-4">
          <Alert
            title="Le logo se règle depuis l'écran Contenu"
            data-testid="branding-logo-elsewhere"
          >
            <p>
              Votre logo, votre favicon et le nom de votre marque se modifient
              sur la page «&nbsp;Layout du storefront&nbsp;», dans le groupe
              Vitrine de Contenu&nbsp;› Pages, au bloc «&nbsp;Identité
              visuelle&nbsp;». C&apos;est de là que votre site, l&apos;icône de
              l&apos;onglet du navigateur et ce tableau de bord tirent tous leur
              logo — d&apos;où le réglage unique plutôt qu&apos;un second ici.
            </p>
          </Alert>

          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous pourrez y déposer un fichier plutôt que de coller une adresse,
              et prévisualiser avant de publier.
            </p>
            {/*
              An establishment that filled the old fields deserves to be told
              why the logo it saved never appeared, rather than left to conclude
              its site is broken.
            */}
            {orphanedLogoUrl && (
              <p className="text-sm text-muted-foreground">
                Une adresse de logo avait été enregistrée sur cet écran&nbsp;:
                elle n&apos;est utilisée nulle part. Redéposez votre logo sur
                «&nbsp;Layout du storefront&nbsp;» pour qu&apos;il apparaisse.
              </p>
            )}
            <Button size="sm" asChild>
              <Link href={adminRoutes.contentPageEdit(STOREFRONT_LAYOUT_SLUG)}>
                Ouvrir «&nbsp;Layout du storefront&nbsp;»
                <ExternalLinkIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
