"use client"

/**
 * Colours, typography and logo for one establishment — and which of the three
 * this screen owns.
 *
 * COLOURS AND TYPOGRAPHY REACH A DINER. `stores.updateBranding` writes
 * `store.branding`; `buildBrandingCss` (`packages/ui/src/lib/branding.ts`)
 * derives design tokens from it; and `StoreTheme`, mounted in each app's
 * `app/(storefront)/layout.tsx`, emits them as an unlayered `<style>` that
 * outranks the engine defaults sitting in `globals.css`'s `@layer base`. So a
 * saved primary paints the public site, per establishment, and an
 * establishment that set nothing still renders those defaults.
 *
 * That was NOT true until #353, and the difference is worth naming because the
 * old state is what most of the surrounding code was written against: for
 * months the write path shipped alone, the toast said "Couleurs mises à jour
 * avec succès", and the site did not change. A comment, a disabled control or
 * a test here that reads as "saved but not applied" is a leftover of that
 * period, not a live constraint. `design-surface.test.ts` walks the chain from
 * a saved field to a painted token with one case per validated field, so a
 * deriver that quietly stops reading one cannot hide behind the others.
 *
 * THE LOGO IS NOT THIS SCREEN'S, and that is the settled design rather than a
 * gap. The CMS `branding` block on the `storefront-layout` page is the only
 * source for the storefront header, the dynamic favicon, the JSON-LD in
 * `lib/structured-data.ts` and this dashboard's own sidebar in
 * `app/(admin)/layout.tsx` — `branding.logoUrl` and `faviconUrl` are read by
 * none of them. The Logo tab is therefore a signpost, not a second form. The
 * two fields keep their place in `BRANDING_FIELDS` so `mergeBranding` carries
 * through what deployed stores already hold, and a store still holding one is
 * told on the tab that it is unused rather than left to conclude its site is
 * broken.
 *
 * THE ONLY GATE LEFT IS THE ROLE. `brandingControlState` renders the saves
 * inert for a role without `stores:write`: `manager` reaches this screen on
 * `stores:read` and stops there. The second gate — which disabled every role,
 * the owner included, because nothing read the result — came off with #353,
 * and `branding-eligibility.ts` records at its foot why it is not coming back.
 *
 * THE THEME TAB IS GONE, not disabled. It offered six themes — `fast-food`,
 * `pizzeria`, `chinese`, `fine-dining`, `cafe`, `sushi` — of which two
 * (`fine-dining`, `cafe`) matched no template anywhere in the repository, and
 * the other four were loose approximations of template families rather than
 * anything selectable. Its "Appliquer" button called the colours save: it wrote
 * three hex strings and let the chosen `theme.id` die in local React state.
 * `themeId` is still in the schema with no writer and no reader, and
 * `design-surface.test.ts` keeps it that way. Choosing a design remains an
 * operator running `pnpm template:apply <slug>` when the client repository is
 * cloned, which `apps/themes/README.md` documents — per-store colours layer
 * over that choice, they do not replace it.
 */

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
import { brandingControlState } from "../../lib/branding-eligibility"
import { BrandingControl } from "./branding-control"
import { BrandingPreview } from "./branding-preview"

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

/**
 * The engine's own palette, as hex — `app/globals.css` holds it as HSL triples.
 * What an unbranded site renders, and therefore where the form starts.
 */
const ENGINE_PALETTE: Record<"primary" | "secondary" | "accent", string> = {
  primary: "#f97015",
  secondary: "#f3f4f6",
  accent: "#fdf6f1",
}

/**
 * Font families a diner's browser will actually have.
 *
 * Nothing fetches a webfont: the engine bundles Inter and Poppins through
 * `next/font` and a stored family renders only where the visitor's device
 * already has it. Suggestions rather than a closed list, so an establishment
 * can still name a font it installs itself.
 */
const SAFE_FONTS = [
  "Inter",
  "Poppins",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Courier New",
]

export function DesignPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  // `stores:read` gets a role onto this screen; `stores:write` is what
  // `stores.updateBranding` checks on the click. `manager` holds the first and
  // not the second, so the two sets are not the same people. That is now the
  // only reason a save is inert: the second gate, which disabled every role
  // because nothing read the result, came off when `StoreTheme` started
  // painting the storefront with it.
  const role = useAdminAuthStore((s) => s.role)
  const branding = brandingControlState(role)
  const store = useQuery(
    api?.stores?.getById,
    storeId ? { id: storeId } : "skip"
  )
  const updateBranding = useMutation(api?.stores?.updateBranding)

  // Seeded with the engine's own palette. The saves send whatever is in state
  // and the form only loads from the store `if (store?.branding)`, so an
  // establishment that had never been branded kept the seeds: an owner changing
  // only the primary shipped white surfaces and blue hover tints, having chosen
  // neither. These three round-trip to `--primary: 24 95% 53%`,
  // `--secondary: 220 14% 96%` and `--chart-1: 24 90% 58%` exactly, so an
  // untouched field saves what the site already renders.
  const [primaryColor, setPrimaryColor] = useState(ENGINE_PALETTE.primary)
  const [secondaryColor, setSecondaryColor] = useState(ENGINE_PALETTE.secondary)
  const [accentColor, setAccentColor] = useState(ENGINE_PALETTE.accent)
  const [fontHeading, setFontHeading] = useState("Inter")
  const [fontBody, setFontBody] = useState("Inter")

  const initialized = useRef(false)
  useEffect(() => {
    if (store?.branding && !initialized.current) {
      setPrimaryColor(store.branding.primaryColor || ENGINE_PALETTE.primary)
      setSecondaryColor(store.branding.secondaryColor || ENGINE_PALETTE.secondary)
      setAccentColor(store.branding.accentColor || ENGINE_PALETTE.accent)
      setFontHeading(store.branding.fontHeading || "Inter")
      setFontBody(store.branding.fontBody || "Inter")
      initialized.current = true
    }
  }, [store])

  /**
   * Each save sends its own tab's fields and no others.
   *
   * Safe only because `updateBranding` merges into the stored blob rather than
   * replacing it — send the whole form from either handler and the two tabs
   * start overwriting each other with stale state. Between them the two must
   * still cover every colour and typography field the validator names, or a
   * setting exists that nothing can save; `design-surface.test.ts` asserts both
   * halves of that.
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
            <BrandingPreview
              branding={{ primaryColor, secondaryColor, accentColor, fontHeading, fontBody }}
            />
            <BrandingControl state={branding}>
              <Button size="sm" disabled={branding.disabled} onClick={handleSaveColors}>
                Enregistrer les couleurs
              </Button>
            </BrandingControl>
          </div>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <div className="border border-border/50 rounded-xl p-6 space-y-4">
            <datalist id="beid-safe-fonts">
              {SAFE_FONTS.map((font) => (
                <option key={font} value={font} />
              ))}
            </datalist>
            {/*
              The two previews below set `fontFamily` inline, so they resolve
              against the fonts installed on the OPERATOR's machine. That was
              the most convincing wrong signal on this screen and it still is,
              so the constraint is stated rather than left to be discovered.
            */}
            <p className="text-sm text-muted-foreground">
              Une police ne s&apos;affiche que si l&apos;appareil du client la
              possède déjà — le site ne télécharge aucune police. Inter et
              Poppins sont fournies avec le site et fonctionnent partout ; les
              autres suggestions sont installées sur presque tous les appareils.
              Une police introuvable revient à la police par défaut.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fontHeading">Police des titres</Label>
                <Input id="fontHeading" list="beid-safe-fonts" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} placeholder="Inter, Poppins, Georgia..." />
                <div className="p-4 border rounded-lg text-2xl font-bold" style={{ fontFamily: fontHeading }}>
                  Exemple de titre
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontBody">Police du texte</Label>
                <Input id="fontBody" list="beid-safe-fonts" value={fontBody} onChange={(e) => setFontBody(e.target.value)} placeholder="Inter, Poppins, Georgia..." />
                <div className="p-4 border rounded-lg text-sm" style={{ fontFamily: fontBody }}>
                  Ceci est un exemple de texte qui montre comment votre contenu
                  apparaîtra avec la police sélectionnée.
                </div>
              </div>
            </div>
            <BrandingPreview
              branding={{ primaryColor, secondaryColor, accentColor, fontHeading, fontBody }}
            />
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
          <Alert data-testid="branding-logo-elsewhere">
            <AlertTitle>Le logo se règle depuis l&apos;écran Contenu</AlertTitle>
            <AlertDescription>
              Votre logo, votre favicon et le nom de votre marque se modifient
              sur la page «&nbsp;Layout du storefront&nbsp;», dans le groupe
              Vitrine de Contenu&nbsp;› Pages, au bloc «&nbsp;Identité
              visuelle&nbsp;». C&apos;est de là que votre site, l&apos;icône de
              l&apos;onglet du navigateur et ce tableau de bord tirent tous leur
              logo — d&apos;où le réglage unique plutôt qu&apos;un second ici.
            </AlertDescription>
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
