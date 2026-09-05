"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import { PlusIcon, LanguagesIcon, StarIcon, TrashIcon } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { ResolvingStore } from "../../components/resolving-store"

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
  embedded?: boolean
}

export function LanguagesPage({ embedded = false }: LanguagesPageProps) {
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
    api?.languages?.list,
    storeId ? { storeId } : "skip"
  ) as Language[] | undefined

  const createLanguage = useMutation(api?.languages?.create)
  const toggleActive = useMutation(api?.languages?.toggleActive)
  const setDefaultLanguage = useMutation(api?.languages?.setDefault)
  const removeLanguage = useMutation(api?.languages?.remove)

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
      setIsAddDialogOpen(false)
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

  if (!storeId) return <ResolvingStore />

  if (languages === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!embedded && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Langues</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez les langues disponibles pour votre établissement
            </p>
          </div>
        )}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className={embedded ? "ml-auto" : ""}>
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
              {/* Right-to-left is disabled on purpose. `isRtl` is still an
                  argument of `languages.create` and still stored on the row,
                  but nothing reads it: neither app's `app/layout.tsx` sets a
                  `dir` attribute on the <html> element, so Arabic and Hebrew
                  render left-to-right. The helper that would supply the value
                  already exists and has no caller — `getLocaleDirection` in
                  @be-in-digital/core/i18n. Wiring this up takes two changes:
                  pass its result to `dir` in both apps' `app/layout.tsx`, and
                  convert the storefront's physical spacing utilities
                  (`ml-`/`mr-`/`pl-`/`pr-`, ~156 of them under `components/`) to
                  the logical `ms-`/`me-`/`ps-`/`pe-` (zero today) — otherwise
                  the text flips and the layout does not. Same convention as the
                  email automations: a switch that controls nothing stays
                  disabled with a stated reason. Delete the badge, the note and
                  `disabled` once the storefront honours the direction. */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isRtl">Droite à gauche (RTL)</Label>
                    <Badge variant="outline" className="text-xs font-normal">
                      Indisponible
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le réglage est enregistré, mais la boutique en ligne ne
                    s'affiche pas encore de droite à gauche : l'arabe et l'hébreu
                    y restent orientés de gauche à droite.
                  </p>
                </div>
                <Switch
                  id="isRtl"
                  disabled
                  checked={isRtl}
                  onCheckedChange={setIsRtl}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleAddLanguage}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {languages.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LanguagesIcon />
            </EmptyMedia>
            <EmptyTitle>Aucune langue</EmptyTitle>
            <EmptyDescription>Ajoutez votre première langue pour commencer</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Drapeau</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Code</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Nom</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Nom natif</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Défaut</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Actif</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((language) => (
                <TableRow key={language._id}>
                  <TableCell className="text-lg">
                    {language.flagEmoji || "🏳️"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{language.code}</TableCell>
                  <TableCell className="text-sm">{language.name}</TableCell>
                  <TableCell className="text-sm">{language.nativeName}</TableCell>
                  <TableCell>
                    {language.isDefault ? (
                      <StarIcon className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleSetDefault(language._id)}
                      >
                        <StarIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={language.isActive}
                      onCheckedChange={() => handleToggleActive(language._id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleRemove(language._id, language.isDefault)}
                      disabled={language.isDefault}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
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
}
