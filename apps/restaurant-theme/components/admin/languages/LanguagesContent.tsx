"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { useState, useMemo, useCallback } from "react"
import {
  PlusIcon,
  LanguagesIcon,
  StarIcon,
  TrashIcon,
  ChevronsUpDown,
  CheckIcon,
  GripVertical,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react"
import frJson from "@/lib/i18n/locales/fr.json"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { LoadingState } from "@/components/admin/LoadingState"
import { EmptyState } from "@/components/admin/EmptyState"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  LANGUAGE_GROUP_LABELS,
  getLanguagesByGroup,
} from "@beindigital-engine/core"
import type { CatalogLanguage } from "@beindigital-engine/core"
import { cn } from "@/lib/utils"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

interface Language {
  _id: Id<"languages">
  code: string
  name: string
  nativeName: string
  flagEmoji?: string
  isDefault: boolean
  isActive: boolean
  isRtl: boolean
  sortOrder?: number
}

interface LanguagesContentProps {
  embedded?: boolean
}

// --- Sortable row component ---
function SortableLanguageRow({
  language,
  onToggleActive,
  onSetDefault,
  onRemove,
  onTranslate,
  isTranslating,
  defaultLanguageCode,
}: {
  language: Language
  onToggleActive: (id: Id<"languages">) => void
  onSetDefault: (id: Id<"languages">) => void
  onRemove: (id: Id<"languages">, isDefault: boolean) => void
  onTranslate: (code: string) => void
  isTranslating: boolean
  defaultLanguageCode: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: language._id,
    disabled: language.isDefault,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50 bg-muted")}
    >
      <TableCell className="w-10">
        {language.isDefault ? (
          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground/30">
            <GripVertical className="h-4 w-4" />
          </span>
        ) : (
          <button
            className="flex h-8 w-8 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="text-2xl">
        {language.flagEmoji || "🏳️"}
      </TableCell>
      <TableCell className="font-mono">{language.code}</TableCell>
      <TableCell>{language.name}</TableCell>
      <TableCell>{language.nativeName}</TableCell>
      <TableCell>
        <div className="flex h-8 w-8 items-center justify-center">
          {language.isDefault ? (
            <StarIcon className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          ) : (
            <button
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-accent"
              onClick={() => onSetDefault(language._id)}
            >
              <StarIcon className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={language.isActive}
          onCheckedChange={() => onToggleActive(language._id)}
        />
      </TableCell>
      <TableCell>
        {language.isRtl && <span className="text-xs">RTL</span>}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {language.code !== defaultLanguageCode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTranslate(language.code)}
              disabled={isTranslating}
              title="Traduire les chaînes UI"
            >
              {isTranslating ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(language._id, language.isDefault)}
            disabled={language.isDefault}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// --- Main component ---
export function LanguagesContent({ embedded = false }: LanguagesContentProps) {
  const storeId = useAdminStoreId()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<CatalogLanguage | null>(null)
  const [isDefault, setIsDefault] = useState(false)

  const languages = useQuery(
    api.languages.list,
    storeId ? { storeId } : "skip"
  ) as Language[] | undefined

  const createLanguage = useMutation(api.languages.create)
  const toggleActive = useMutation(api.languages.toggleActive)
  const setDefaultLanguage = useMutation(api.languages.setDefault)
  const removeLanguage = useMutation(api.languages.remove)
  const reorderLanguages = useMutation(api.languages.reorder)
  const translateUIAction = useAction(api.autoTranslate.translateUIStrings)

  const [translatingLangCode, setTranslatingLangCode] = useState<string | null>(null)

  const defaultLanguageCode = useMemo(
    () => languages?.find((l) => l.isDefault)?.code ?? "fr",
    [languages]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const existingCodes = useMemo(
    () => new Set(languages?.map((l) => l.code) ?? []),
    [languages]
  )

  const groupedLanguages = useMemo(() => {
    const groups = getLanguagesByGroup()
    const result: { group: CatalogLanguage["group"]; label: string; languages: CatalogLanguage[] }[] = []
    for (const [group, langs] of Object.entries(groups)) {
      const available = langs.filter((l) => !existingCodes.has(l.code))
      if (available.length > 0) {
        result.push({
          group: group as CatalogLanguage["group"],
          label: LANGUAGE_GROUP_LABELS[group as CatalogLanguage["group"]],
          languages: available,
        })
      }
    }
    return result
  }, [existingCodes])

  const languageIds = useMemo(
    () => languages?.map((l) => l._id) ?? [],
    [languages]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!storeId || !languages) return
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = languages.findIndex((l) => l._id === active.id)
      const newIndex = languages.findIndex((l) => l._id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      // Prevent moving anything to position 0 (reserved for default)
      if (newIndex === 0) return

      const reordered = arrayMove(languages, oldIndex, newIndex)
      const orderedIds = reordered.map((l) => l._id)

      try {
        await reorderLanguages({ storeId, orderedIds })
      } catch (error) {
        toast.error("Échec du réordonnancement")
        console.error(error)
      }
    },
    [storeId, languages, reorderLanguages]
  )

  const handleSelectLanguage = (lang: CatalogLanguage) => {
    setSelectedLanguage(lang)
    setIsSelectOpen(false)
  }

  const translateUIStrings = useCallback(
    async (targetLangCode: string) => {
      if (!storeId || targetLangCode === defaultLanguageCode) return

      setTranslatingLangCode(targetLangCode)
      const toastId = toast.loading(`Traduction vers ${targetLangCode} en cours...`)

      try {
        const entries = frJson as Record<string, string>

        const result = await translateUIAction({
          storeId,
          targetLang: targetLangCode,
          sourceLang: defaultLanguageCode,
          entries,
        })

        toast.success(
          `${result.translated} chaînes traduites vers ${targetLangCode}`,
          { id: toastId }
        )
      } catch (error) {
        toast.error("Échec de la traduction", { id: toastId })
        console.error(error)
      } finally {
        setTranslatingLangCode(null)
      }
    },
    [storeId, defaultLanguageCode, translateUIAction]
  )

  const handleAddLanguage = async () => {
    if (!storeId || !selectedLanguage) {
      toast.error("Veuillez sélectionner une langue")
      return
    }

    try {
      await createLanguage({
        storeId,
        code: selectedLanguage.code,
        name: selectedLanguage.name,
        nativeName: selectedLanguage.nativeName,
        flagEmoji: selectedLanguage.flagEmoji || undefined,
        isDefault,
        isActive: true,
        isRtl: selectedLanguage.direction === "rtl",
      })
      toast.success("Langue ajoutée avec succès")
      setIsAddDialogOpen(false)

      // Auto-translate UI strings for the new language (if not French)
      const newLangCode = selectedLanguage.code
      setSelectedLanguage(null)
      setIsDefault(false)

      if (newLangCode !== defaultLanguageCode) {
        translateUIStrings(newLangCode)
      }
    } catch (error) {
      toast.error("Échec de l'ajout de la langue")
      console.error(error)
    }
  }

  const handleToggleActive = async (id: Id<"languages">) => {
    try {
      await toggleActive({ id })
      toast.success("Statut de la langue mis à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour du statut")
      console.error(error)
    }
  }

  const handleSetDefault = async (languageId: Id<"languages">) => {
    if (!storeId) return
    try {
      await setDefaultLanguage({ storeId, languageId })
      toast.success("Langue par défaut mise à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour de la langue par défaut")
      console.error(error)
    }
  }

  const handleRemove = async (id: Id<"languages">, isDefaultLang: boolean) => {
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

  if (!storeId) {
    return (
      <EmptyState
        icon={LanguagesIcon}
        title="Aucun établissement sélectionné"
        description="Veuillez sélectionner un établissement pour gérer les langues"
      />
    )
  }

  if (languages === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold">Langues</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les langues disponibles pour votre établissement
            </p>
          </div>
        )}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) {
              setSelectedLanguage(null)
              setIsDefault(false)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className={embedded ? "ml-auto" : ""}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Ajouter une langue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une langue</DialogTitle>
              <DialogDescription>
                Sélectionnez une langue dans le catalogue
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Langue *</Label>
                <Popover open={isSelectOpen} onOpenChange={setIsSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSelectOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedLanguage ? (
                        <span className="flex items-center gap-2">
                          <span>{selectedLanguage.flagEmoji}</span>
                          <span>{selectedLanguage.nativeName}</span>
                          <span className="text-muted-foreground">
                            ({selectedLanguage.name})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Rechercher une langue...
                        </span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher par nom..." />
                      <CommandList>
                        <CommandEmpty>Aucune langue trouvée.</CommandEmpty>
                        {groupedLanguages.map(({ group, label, languages: langs }) => (
                          <CommandGroup key={group} heading={label}>
                            {langs.map((lang) => (
                              <CommandItem
                                key={lang.code}
                                value={`${lang.name} ${lang.nativeName} ${lang.code}`}
                                onSelect={() => handleSelectLanguage(lang)}
                              >
                                <span className="mr-2 text-base">{lang.flagEmoji}</span>
                                <span className="font-medium">{lang.nativeName}</span>
                                <span className="text-muted-foreground ml-1.5">
                                  {lang.name}
                                </span>
                                <span className="text-muted-foreground ml-auto font-mono text-xs">
                                  {lang.code}
                                </span>
                                <CheckIcon
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    selectedLanguage?.code === lang.code
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedLanguage && (
                <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedLanguage.flagEmoji}</span>
                    <div>
                      <p className="font-medium">{selectedLanguage.nativeName}</p>
                      <p className="text-muted-foreground text-xs">
                        {selectedLanguage.name} &middot; Code : {selectedLanguage.code}
                        {selectedLanguage.direction === "rtl" && " · RTL"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="isDefault">Définir par défaut</Label>
                <Switch
                  id="isDefault"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddLanguage} disabled={!selectedLanguage}>
                  Ajouter une langue
                </Button>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {languages.length === 0 ? (
        <EmptyState
          icon={LanguagesIcon}
          title="Aucune langue"
          description="Ajoutez votre première langue pour commencer"
        />
      ) : (
        <div className="border rounded-lg">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
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
              <SortableContext items={languageIds} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {languages.map((language) => (
                    <SortableLanguageRow
                      key={language._id}
                      language={language}
                      onToggleActive={handleToggleActive}
                      onSetDefault={handleSetDefault}
                      onRemove={handleRemove}
                      onTranslate={translateUIStrings}
                      isTranslating={translatingLangCode === language.code}
                      defaultLanguageCode={defaultLanguageCode}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
        </div>
      )}
    </div>
  )
}
