"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  GripVertical,
  Package,
  List,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react"
import { useAdminStoreId, useAdminApi, useDebounce } from "../../hooks/admin-hooks"
import { centsToEuros, eurosToCents } from "../../lib/formatters"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Input,
  Switch,
  Checkbox,
  Badge,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@be-in-digital/ui"

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionType = "fixed" | "pick_products" | "pick_category"

interface MenuSection {
  sectionId: string
  label: string
  type: SectionType
  required: boolean
  minChoices: number
  maxChoices: number
  allowDuplicates: boolean
  sortOrder: number
  productId?: string
  productIds?: string[]
  categoryId?: string
}

interface MenuFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menu?: any
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0
function nanoid(): string {
  return `s_${Date.now().toString(36)}_${(++idCounter).toString(36)}`
}

function createEmptySection(sortOrder: number): MenuSection {
  return {
    sectionId: nanoid(),
    label: "",
    type: "fixed",
    required: true,
    minChoices: 1,
    maxChoices: 1,
    allowDuplicates: true,
    sortOrder,
  }
}

const TYPE_CONFIG: Record<SectionType, { label: string; icon: typeof Package; description: string }> = {
  fixed: {
    label: "Produit fixe",
    icon: Package,
    description: "Un produit spécifique inclus dans le menu",
  },
  pick_products: {
    label: "Choix parmi des produits",
    icon: List,
    description: "Le client choisit parmi une sélection de produits",
  },
  pick_category: {
    label: "Choix dans une catégorie",
    icon: FolderOpen,
    description: "Le client choisit parmi tous les produits d'une catégorie",
  },
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MenuFormDialog({ open, onOpenChange, menu }: MenuFormDialogProps) {
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any

  const createMenu = useMutation(api?.menus?.create)
  const updateMenu = useMutation(api?.menus?.update)

  const products = useQuery(api?.products?.listAll, storeId ? { storeId } : "skip")
  const categories = useQuery(api?.categories?.listAll, storeId ? { storeId } : "skip")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [priceEuros, setPriceEuros] = useState("")
  const [sections, setSections] = useState<MenuSection[]>([])
  const [uberEatsVisible, setUberEatsVisible] = useState(false)
  const [deliverooVisible, setDeliverooVisible] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const isEditMode = !!menu

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (menu) {
        setName(menu.name || "")
        setDescription(menu.description || "")
        setPriceEuros(menu.price ? centsToEuros(menu.price).toString() : "")
        setSections(
          menu.sections?.map((s: any, i: number) => ({ ...s, sortOrder: i })) || []
        )
        setUberEatsVisible(menu.platformVisibility?.uberEats || false)
        setDeliverooVisible(menu.platformVisibility?.deliveroo || false)
        setIsActive(menu.isActive ?? true)
      } else {
        setName("")
        setDescription("")
        setPriceEuros("")
        setSections([createEmptySection(0)])
        setUberEatsVisible(false)
        setDeliverooVisible(false)
        setIsActive(true)
      }
    }
  }, [open, menu])

  // Product name lookup
  const productMap = useMemo(() => {
    const map = new Map<string, string>()
    products?.forEach((p: any) => map.set(p._id, p.name))
    return map
  }, [products])

  // Category name lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories?.forEach((c: any) => map.set(c._id, c.name))
    return map
  }, [categories])

  // ── Section CRUD ──

  const addSection = () => {
    setSections((prev) => [...prev, createEmptySection(prev.length)])
  }

  const removeSection = (sectionId: string) => {
    setSections((prev) =>
      prev
        .filter((s) => s.sectionId !== sectionId)
        .map((s, i) => ({ ...s, sortOrder: i }))
    )
  }

  const updateSection = (sectionId: string, patch: Partial<MenuSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.sectionId === sectionId ? { ...s, ...patch } : s))
    )
  }

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.sectionId === sectionId)
      if (idx < 0) return prev
      const newIdx = direction === "up" ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      const temp = copy[idx]!
      copy[idx] = copy[newIdx]!
      copy[newIdx] = temp
      return copy.map((s, i) => ({ ...s, sortOrder: i }))
    })
  }

  const handleTypeChange = (sectionId: string, newType: SectionType) => {
    updateSection(sectionId, {
      type: newType,
      productId: undefined,
      productIds: undefined,
      categoryId: undefined,
      minChoices: newType === "fixed" ? 1 : 1,
      maxChoices: newType === "fixed" ? 1 : 1,
      allowDuplicates: true,
    })
  }

  // ── Save ──

  const handleSave = async () => {
    if (!storeId) return

    if (!name.trim()) {
      toast.error("Le nom du menu est requis")
      return
    }

    const price = eurosToCents(parseFloat(priceEuros) || 0)
    if (price < 0) {
      toast.error("Le prix doit être positif")
      return
    }

    if (sections.length === 0) {
      toast.error("Ajoutez au moins une ligne au menu")
      return
    }

    // Client-side validation
    for (const s of sections) {
      if (!s.label.trim()) {
        toast.error("Chaque ligne doit avoir un nom")
        return
      }
      if (s.type === "fixed" && !s.productId) {
        toast.error(`Ligne "${s.label}" : sélectionnez un produit`)
        return
      }
      if (s.type === "pick_products" && (!s.productIds || s.productIds.length === 0)) {
        toast.error(`Ligne "${s.label}" : sélectionnez au moins un produit`)
        return
      }
      if (s.type === "pick_category" && !s.categoryId) {
        toast.error(`Ligne "${s.label}" : sélectionnez une catégorie`)
        return
      }
    }

    setSaving(true)
    try {
      const platformVisibility = {
        uberEats: uberEatsVisible,
        deliveroo: deliverooVisible,
      }

      // Clean up sections: strip fields not relevant to the type
      const cleanSections = sections.map((s, i) => {
        const base = {
          sectionId: s.sectionId,
          label: s.label.trim(),
          type: s.type,
          required: s.required,
          minChoices: s.minChoices,
          maxChoices: s.maxChoices,
          allowDuplicates: s.allowDuplicates,
          sortOrder: i,
        }
        if (s.type === "fixed") {
          return { ...base, productId: s.productId, minChoices: 1, maxChoices: 1 }
        }
        if (s.type === "pick_products") {
          return { ...base, productIds: s.productIds }
        }
        return { ...base, categoryId: s.categoryId }
      })

      if (isEditMode) {
        await updateMenu({
          id: menu._id,
          name: name.trim(),
          description: description.trim() || undefined,
          price,
          sections: cleanSections,
          platformVisibility,
          isActive,
        })
        toast.success("Menu mis à jour")
      } else {
        await createMenu({
          storeId,
          name: name.trim(),
          description: description.trim() || undefined,
          price,
          sections: cleanSections,
          platformVisibility,
          isActive,
          sortOrder: 0,
        })
        toast.success("Menu créé avec succès")
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(isEditMode ? "Échec de la mise à jour" : "Échec de la création")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEditMode ? "Modifier le menu" : "Nouveau menu"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Composez votre formule avec des lignes : produit fixe, choix parmi des produits, ou choix dans une catégorie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Name + Price row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nom *</Label>
              <Input
                placeholder="ex: Menu Big Wrap"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prix TTC (€) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="12.90"
                value={priceEuros}
                onChange={(e) => setPriceEuros(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              placeholder="Wrap + Frites + Boisson au choix"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Sections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                Composition du menu ({sections.length} ligne{sections.length > 1 ? "s" : ""})
              </Label>
              <Button variant="outline" size="sm" onClick={addSection} className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" />
                Ajouter une ligne
              </Button>
            </div>

            {sections.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucune ligne. Cliquez sur « Ajouter une ligne » pour commencer.
              </p>
            )}

            {sections.map((section, idx) => (
              <SectionCard
                key={section.sectionId}
                section={section}
                index={idx}
                total={sections.length}
                products={products || []}
                categories={categories || []}
                productMap={productMap}
                categoryMap={categoryMap}
                onUpdate={(patch) => updateSection(section.sectionId, patch)}
                onRemove={() => removeSection(section.sectionId)}
                onMove={(dir) => moveSection(section.sectionId, dir)}
                onTypeChange={(type) => handleTypeChange(section.sectionId, type)}
              />
            ))}
          </div>

          <Separator />

          {/* Platform + Active row */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={uberEatsVisible} onCheckedChange={setUberEatsVisible} className="scale-75" />
              Uber Eats
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={deliverooVisible} onCheckedChange={setDeliverooVisible} className="scale-75" />
              Deliveroo
            </label>
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={isActive} onCheckedChange={setIsActive} className="scale-75" />
              Actif
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : isEditMode ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Section Card ────────────────────────────────────────────────────────────

interface SectionCardProps {
  section: MenuSection
  index: number
  total: number
  products: any[]
  categories: any[]
  productMap: Map<string, string>
  categoryMap: Map<string, string>
  onUpdate: (patch: Partial<MenuSection>) => void
  onRemove: () => void
  onMove: (direction: "up" | "down") => void
  onTypeChange: (type: SectionType) => void
}

function SectionCard({
  section,
  index,
  total,
  products,
  categories,
  productMap,
  categoryMap,
  onUpdate,
  onRemove,
  onMove,
  onTypeChange,
}: SectionCardProps) {
  return (
    <div className="border rounded-lg bg-card p-3 space-y-3">
      {/* Header: drag handle, label, actions */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            className="inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

        <Input
          placeholder="Nom de la ligne (ex: Boisson au choix)"
          value={section.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="h-7 text-xs flex-1"
        />

        <label className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Switch
            checked={section.required}
            onCheckedChange={(v) => onUpdate({ required: v })}
            className="scale-[0.65]"
          />
          Requis
        </label>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="shrink-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1.5">
        {(Object.keys(TYPE_CONFIG) as SectionType[]).map((type) => {
          const config = TYPE_CONFIG[type]
          const Icon = config.icon
          const isSelected = section.type === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => onTypeChange(type)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium border transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Type-specific content */}
      {section.type === "fixed" && (
        <FixedProductPicker
          selectedProductId={section.productId}
          products={products}
          productMap={productMap}
          onSelect={(pid) => onUpdate({ productId: pid })}
        />
      )}

      {section.type === "pick_products" && (
        <ProductListPicker
          selectedIds={section.productIds || []}
          products={products}
          categories={categories}
          productMap={productMap}
          onChange={(ids) => onUpdate({ productIds: ids })}
        />
      )}

      {section.type === "pick_category" && (
        <CategoryPicker
          selectedCategoryId={section.categoryId}
          categories={categories}
          onSelect={(cid) => onUpdate({ categoryId: cid })}
        />
      )}

      {/* Choices config (only for pick types) */}
      {section.type !== "fixed" && (
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">Min</Label>
            <Input
              type="number"
              min={0}
              max={section.maxChoices}
              value={section.minChoices}
              onChange={(e) => onUpdate({ minChoices: Math.max(0, parseInt(e.target.value) || 0) })}
              className="h-6 w-14 text-[10px]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">Max</Label>
            <Input
              type="number"
              min={1}
              value={section.maxChoices}
              onChange={(e) => onUpdate({ maxChoices: Math.max(1, parseInt(e.target.value) || 1) })}
              className="h-6 w-14 text-[10px]"
            />
          </div>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <Switch
              checked={section.allowDuplicates}
              onCheckedChange={(v) => onUpdate({ allowDuplicates: v })}
              className="scale-[0.6]"
            />
            Doublons
          </label>
        </div>
      )}
    </div>
  )
}

// ─── Fixed Product Picker ────────────────────────────────────────────────────

function FixedProductPicker({
  selectedProductId,
  products,
  productMap,
  onSelect,
}: {
  selectedProductId?: string
  products: any[]
  productMap: Map<string, string>
  onSelect: (id: string) => void
}) {
  return (
    <Select value={selectedProductId || ""} onValueChange={onSelect}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Sélectionner un produit" />
      </SelectTrigger>
      <SelectContent>
        {products.map((p: any) => (
          <SelectItem key={p._id} value={p._id} className="text-xs">
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Product List Picker (multi-select with search) ──────────────────────────

function ProductListPicker({
  selectedIds,
  products,
  categories,
  productMap,
  onChange,
}: {
  selectedIds: string[]
  products: any[]
  categories: any[]
  productMap: Map<string, string>
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("all")
  const debouncedSearch = useDebounce(search, 200)

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (catFilter !== "all" && p.categoryId !== catFilter) return false
      if (debouncedSearch && !p.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false
      return true
    })
  }, [products, debouncedSearch, catFilter])

  const toggle = useCallback(
    (pid: string) => {
      onChange(
        selectedIds.includes(pid)
          ? selectedIds.filter((id) => id !== pid)
          : [...selectedIds, pid]
      )
    },
    [selectedIds, onChange]
  )

  return (
    <div className="space-y-1.5">
      {/* Selected badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((pid) => (
            <Badge
              key={pid}
              variant="secondary"
              className="text-[10px] h-5 px-1.5 gap-1 cursor-pointer hover:bg-destructive/10"
              onClick={() => toggle(pid)}
            >
              {productMap.get(pid) || "..."}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
        </div>
      )}

      {/* Search + Category filter */}
      <div className="flex gap-1.5">
        <SearchInput
          placeholder="Rechercher..."
          value={search}
          onValueChange={setSearch}
          size="sm"
          className="flex-1"
        />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[120px] h-8 text-[10px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {categories.map((cat: any) => (
              <SelectItem key={cat._id} value={cat._id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product list */}
      <div className="border rounded-md max-h-32 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun produit trouvé</p>
        ) : (
          filtered.map((product: any) => (
            <label
              key={product._id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
            >
              <Checkbox
                checked={selectedIds.includes(product._id)}
                onCheckedChange={() => toggle(product._id)}
              />
              <span className="text-xs flex-1 truncate">{product.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Category Picker ─────────────────────────────────────────────────────────

function CategoryPicker({
  selectedCategoryId,
  categories,
  onSelect,
}: {
  selectedCategoryId?: string
  categories: any[]
  onSelect: (id: string) => void
}) {
  return (
    <Select value={selectedCategoryId || ""} onValueChange={onSelect}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Sélectionner une catégorie" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((c: any) => (
          <SelectItem key={c._id} value={c._id} className="text-xs">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
