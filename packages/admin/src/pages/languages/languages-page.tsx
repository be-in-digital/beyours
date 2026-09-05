"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { toast } from "sonner"
import { useState, type ReactNode } from "react"
import { PlusIcon, LanguagesIcon, StarIcon, TrashIcon } from "lucide-react"
import { Button } from "@be-in-digital/ui"
import { ButtonGroup } from "@be-in-digital/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@be-in-digital/ui"
import { Input } from "@be-in-digital/ui"
import { Label } from "@be-in-digital/ui"
import { Switch } from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@be-in-digital/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@be-in-digital/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-in-digital/ui"

interface Language {
  _id: string
  code: string
  name: string
  nativeName: string
  flagEmoji?: string
  isDefault: boolean
  isActive: boolean
  isRtl: boolean
}

interface LanguagesPageProps {
  /**
   * The UI-string overrides panel, rendered as a second tab when supplied.
   *
   * It stays in the app because it is the only part of this screen that is
   * app-specific: it lists the storefront's own translation keys
   * (`lib/i18n`'s `REFERENCE_KEYS`), which differ per template. Everything
   * above — adding a language, the default, RTL, auto-translation — is the
   * engine's and lives here.
   */
  uiOverrides?: ReactNode
}

/**
 * Languages, and the only copy of the screen.
 *
 * The live version lived in `apps/reference/components/admin/languages/` and,
 * byte for byte, in `apps/themes/`, while this package exported an older
 * `LanguagesPage` that nothing rendered and that had no overrides tab at all.
 * The two apps also drew the page title twice — once in the route, once inside
 * the panel, which passed no `embedded` flag. One header now, here.
 */
export function LanguagesPage({ uiOverrides }: LanguagesPageProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [nativeName, setNativeName] = useState("")
  const [flagEmoji, setFlagEmoji] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [isRtl, setIsRtl] = useState(false)

  const languages = useQuery(
    api.languages.list,
    storeId ? { storeId } : "skip"
  ) as Language[] | undefined

  const createLanguage = useMutation(api.languages.create)
  const translateCatalogue = useAction(api.autoTranslate.translateCatalogue)
  const toggleActive = useMutation(api.languages.toggleActive)
  const setDefaultLanguage = useMutation(api.languages.setDefault)
  const removeLanguage = useMutation(api.languages.remove)

  /**
   * Translate the catalogue that was already there into the new language.
   *
   * The incremental translator only fires on a write, so without this a
   * restaurant that adds Spanish after filling its menu waits for someone to
   * re-save sixty dishes one by one. Three batch jobs, one per catalogue
   * table, whose progress the owner can follow in `translationJobs`.
   */
  const backfillCatalogue = async (
    store: string,
    targetLang: string
  ): Promise<void> => {
    try {
      const jobs = await Promise.all(
        (["products", "categories", "menus"] as const).map((entityType) =>
          translateCatalogue({ storeId: store, targetLang, entityType })
        )
      )
      const total = jobs.reduce((sum, job) => sum + job.totalItems, 0)
      if (total > 0) {
        toast.success(`Traduction du catalogue lancée : ${total} éléments`)
      }
    } catch (error) {
      // The language itself was created — that must not be reported as a
      // failure because the back-fill could not start.
      toast.warning("La traduction automatique du catalogue n'a pas pu démarrer")
      console.error(error)
    }
  }

  const handleAddLanguage = async () => {
    if (!storeId || !code || !name || !nativeName) {
      toast.error("Veuillez remplir tous les champs requis")
      return
    }

    try {
      await createLanguage({
        storeId,
        code,
        name,
        nativeName,
        flagEmoji: flagEmoji || undefined,
        isDefault,
        isActive: true,
        isRtl,
      })
      toast.success("Langue ajoutée avec succès")

      // Only worth doing when there is a source language to translate FROM,
      // and when the new language is not itself becoming that source.
      const hasSourceLanguage = languages?.some((l) => l.isDefault) ?? false
      if (!isDefault && hasSourceLanguage) {
        void backfillCatalogue(storeId, code)
      }

      setIsAddDialogOpen(false)
      // Reset form
      setCode("")
      setName("")
      setNativeName("")
      setFlagEmoji("")
      setIsDefault(false)
      setIsRtl(false)
    } catch (error) {
      toast.error("Échec de l'ajout de la langue")
      console.error(error)
    }
  }

  const handleToggleActive = async (id: string) => {
    try {
      await toggleActive({ id })
      toast.success("Statut de la langue mis à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour du statut")
      console.error(error)
    }
  }

  const handleSetDefault = async (languageId: string) => {
    if (!storeId) return
    try {
      await setDefaultLanguage({ storeId, languageId })
      toast.success("Langue par défaut mise à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour de la langue par défaut")
      console.error(error)
    }
  }

  const handleRemove = async (id: string, isDefaultLang: boolean) => {
    if (isDefaultLang) {
      toast.error("Impossible de supprimer la langue par défaut")
      return
    }
    try {
      await removeLanguage({ id })
      toast.success("Langue supprimée avec succès")
    } catch (error) {
      toast.error("Échec de la suppression de la langue")
      console.error(error)
    }
  }

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Langues</h1>
      <p className="text-muted-foreground">
        Configurez les langues disponibles et les traductions de votre
        établissement.
      </p>
    </div>
  )

  /**
   * The panel's own states, INSIDE the tab rather than above it.
   *
   * Returning early on `!storeId` or a pending `languages` would take the
   * whole `<Tabs>` with it, and `Tabs` is uncontrolled: `languages` returns to
   * `undefined` on every establishment change and on every socket reconnect, so
   * the subtree would unmount and remount and a reader sitting on "Traductions
   * UI" would be thrown back to "Langues" without touching anything.
   */
  const panel = !storeId ? (
    <Empty className="min-h-[400px]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LanguagesIcon className="h-5 w-5" />
        </EmptyMedia>
        <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
        <EmptyDescription>Veuillez sélectionner un établissement pour gérer les langues</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : languages === undefined ? (
    <LoadingState />
  ) : (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une langue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une langue</DialogTitle>
              <DialogDescription>
                Ajoutez une nouvelle langue à votre établissement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code langue *</Label>
                  <Input
                    id="code"
                    placeholder="en, fr, es..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flagEmoji">Drapeau</Label>
                  <Input
                    id="flagEmoji"
                    placeholder="🇬🇧"
                    value={flagEmoji}
                    onChange={(e) => setFlagEmoji(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  placeholder="Anglais"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nativeName">Nom natif *</Label>
                <Input
                  id="nativeName"
                  placeholder="English"
                  value={nativeName}
                  onChange={(e) => setNativeName(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isDefault">Définir par défaut</Label>
                <Switch
                  id="isDefault"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isRtl">Droite à gauche (RTL)</Label>
                <Switch
                  id="isRtl"
                  checked={isRtl}
                  onCheckedChange={setIsRtl}
                />
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddLanguage}>Ajouter une langue</Button>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {languages.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LanguagesIcon className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>Aucune langue</EmptyTitle>
            <EmptyDescription>Ajoutez votre première langue pour commencer</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drapeau</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Nom natif</TableHead>
                <TableHead>Défaut</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead>RTL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((language) => (
                <TableRow key={language._id}>
                  <TableCell className="text-2xl">
                    {language.flagEmoji || "🏳️"}
                  </TableCell>
                  <TableCell className="font-mono">{language.code}</TableCell>
                  <TableCell>{language.name}</TableCell>
                  <TableCell>{language.nativeName}</TableCell>
                  <TableCell>
                    {language.isDefault ? (
                      <StarIcon className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(language._id)}
                      >
                        <StarIcon className="h-5 w-5" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={language.isActive}
                      onCheckedChange={() => handleToggleActive(language._id)}
                    />
                  </TableCell>
                  <TableCell>
                    {language.isRtl && <span className="text-xs">RTL</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(language._id, language.isDefault)}
                      disabled={language.isDefault}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )

  if (!uiOverrides) {
    return (
      <div className="space-y-6">
        {header}
        {panel}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}
      <Tabs defaultValue="languages">
        <TabsList>
          <TabsTrigger value="languages">Langues</TabsTrigger>
          <TabsTrigger value="overrides">Traductions UI</TabsTrigger>
        </TabsList>
        <TabsContent value="languages" className="mt-4">
          {panel}
        </TabsContent>
        <TabsContent value="overrides" className="mt-4">
          {uiOverrides}
        </TabsContent>
      </Tabs>
    </div>
  )
}
