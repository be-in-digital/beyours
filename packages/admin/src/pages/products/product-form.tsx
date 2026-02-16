"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, X } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@beindigital-engine/ui"
import { slugify, centsToEuros, eurosToCents } from "../../lib/formatters"

/**
 * Form schema for product editing with euro prices for display.
 * Avoids .default() to prevent type mismatch with @hookform/resolvers v5.
 */
const productFormSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().min(1, "Slug is required").max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  priceEuros: z.number().min(0, "Price must be positive"),
  compareAtPriceEuros: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  preparationTime: z.number().int().min(1).max(240).optional(),
  sku: z.string().max(50).optional(),
  images: z.array(z.string()).optional(),
  options: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    required: z.boolean(),
    maxSelections: z.number().int().min(1).optional(),
    externalIds: z.object({
      uberEatsId: z.string().optional(),
      deliverooId: z.string().optional(),
    }).optional(),
    choices: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      priceModifier: z.number(),
      externalIds: z.object({
        uberEatsId: z.string().optional(),
        deliverooId: z.string().optional(),
      }).optional(),
    })),
  })).optional(),
  allergens: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  stock: z.object({
    tracked: z.boolean(),
    quantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0),
  }).optional(),
  scheduling: z.object({
    availableFrom: z.string().optional(),
    availableUntil: z.string().optional(),
    availableDays: z.array(z.number().min(0).max(6)).optional(),
  }).optional(),
  spiceLevel: z.number().int().min(0).max(5).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

type ProductFormData = z.infer<typeof productFormSchema>

interface Category {
  _id: string
  name: string
}

interface ProductFormProps {
  categories: Category[]
  defaultValues?: Partial<ProductFormData>
  onSubmit: (data: ProductFormData) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function ProductForm({
  categories,
  defaultValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer le produit",
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      categoryId: "",
      priceEuros: 0,
      compareAtPriceEuros: undefined,
      taxRate: 20,
      preparationTime: undefined,
      sku: "",
      images: [],
      options: [],
      allergens: [],
      tags: [],
      stock: {
        tracked: false,
        quantity: 0,
        lowStockThreshold: 0,
      },
      scheduling: {
        availableFrom: undefined,
        availableUntil: undefined,
        availableDays: undefined,
      },
      spiceLevel: undefined,
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      ...defaultValues,
    },
  })

  const name = watch("name")
  const stockTracked = watch("stock.tracked")
  const options = watch("options")

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !defaultValues?.slug) {
      setValue("slug", slugify(name))
    }
  }, [name, defaultValues?.slug, setValue])

  // Add new option
  const addOption = () => {
    const currentOptions = options || []
    setValue("options", [
      ...currentOptions,
      {
        id: `opt_${Date.now()}`,
        name: "",
        required: false,
        maxSelections: undefined,
        choices: [],
      },
    ])
  }

  // Remove option
  const removeOption = (index: number) => {
    const currentOptions = options || []
    setValue(
      "options",
      currentOptions.filter((_, i) => i !== index)
    )
  }

  // Add choice to option
  const addChoice = (optionIndex: number) => {
    const currentOptions = [...(options || [])]
    const option = currentOptions[optionIndex]
    if (!option) return
    option.choices.push({
      id: `choice_${Date.now()}`,
      name: "",
      priceModifier: 0,
    })
    setValue("options", currentOptions)
  }

  // Remove choice from option
  const removeChoice = (optionIndex: number, choiceIndex: number) => {
    const currentOptions = [...(options || [])]
    const option = currentOptions[optionIndex]
    if (!option) return
    option.choices = option.choices.filter((_, i) => i !== choiceIndex)
    setValue("options", currentOptions)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="scheduling">Planification</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">
              Nom du produit <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="ex : Pizza Margherita"
              className="h-9"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-sm">
              Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="slug"
              {...register("slug")}
              placeholder="margherita-pizza"
              className="h-9"
            />
            {errors.slug && (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Description du produit..."
              rows={3}
              className="text-sm"
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="categoryId" className="text-sm">
              Catégorie <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch("categoryId")}
              onValueChange={(value) => setValue("categoryId", value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-xs text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="priceEuros" className="text-sm">
                Prix (€) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="priceEuros"
                type="number"
                step="0.01"
                {...register("priceEuros", { valueAsNumber: true })}
                placeholder="0.00"
                className="h-9"
              />
              {errors.priceEuros && (
                <p className="text-xs text-destructive">
                  {errors.priceEuros.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compareAtPriceEuros" className="text-sm">Prix barré (€)</Label>
              <Input
                id="compareAtPriceEuros"
                type="number"
                step="0.01"
                {...register("compareAtPriceEuros", { valueAsNumber: true })}
                placeholder="0.00"
                className="h-9"
              />
            </div>
          </div>

          {/* Tax Rate & Prep Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="taxRate" className="text-sm">Taux de TVA (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.1"
                {...register("taxRate", { valueAsNumber: true })}
                placeholder="20"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preparationTime" className="text-sm">Temps de préparation (min)</Label>
              <Input
                id="preparationTime"
                type="number"
                {...register("preparationTime", { valueAsNumber: true })}
                placeholder="15"
                className="h-9"
              />
            </div>
          </div>

          {/* SKU */}
          <div className="space-y-1.5">
            <Label htmlFor="sku" className="text-sm">SKU / PLU</Label>
            <Input
              id="sku"
              {...register("sku")}
              placeholder="PRODUCT-001"
              className="h-9"
            />
          </div>

          {/* Status toggles */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
              <Label htmlFor="isActive" className="text-sm">Actif</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isFeatured"
                checked={watch("isFeatured")}
                onCheckedChange={(checked) => setValue("isFeatured", checked)}
              />
              <Label htmlFor="isFeatured" className="text-sm">En vedette</Label>
            </div>
          </div>
        </TabsContent>

        {/* Options Tab */}
        <TabsContent value="options" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Ajoutez des options de personnalisation pour ce produit
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Ajouter une option
            </Button>
          </div>

          {options && options.length > 0 ? (
            <div className="space-y-3">
              {options.map((option, optionIndex) => (
                <div
                  key={option.id}
                  className="border border-border/50 rounded-lg p-3 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Option Name */}
                      <div className="space-y-1.5">
                        <Label className="text-sm">Nom de l'option</Label>
                        <Input
                          {...register(`options.${optionIndex}.name`)}
                          placeholder="ex : Taille, Garnitures"
                          className="h-9"
                        />
                      </div>

                      {/* Option Settings */}
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`option-${optionIndex}-required`}
                            checked={watch(`options.${optionIndex}.required`)}
                            onCheckedChange={(checked) =>
                              setValue(
                                `options.${optionIndex}.required`,
                                checked as boolean
                              )
                            }
                          />
                          <Label htmlFor={`option-${optionIndex}-required`} className="text-xs">
                            Obligatoire
                          </Label>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Sélections max</Label>
                          <Input
                            type="number"
                            {...register(`options.${optionIndex}.maxSelections`, {
                              valueAsNumber: true,
                            })}
                            placeholder="Illimité"
                            className="w-24 h-8 text-xs"
                          />
                        </div>
                      </div>

                      {/* Choices */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Choix</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addChoice(optionIndex)}
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Ajouter un choix
                          </Button>
                        </div>

                        {option.choices.map((choice, choiceIndex) => (
                          <div
                            key={choice.id}
                            className="flex items-center gap-2"
                          >
                            <Input
                              {...register(
                                `options.${optionIndex}.choices.${choiceIndex}.name`
                              )}
                              placeholder="Nom du choix"
                              className="h-8 text-sm"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              {...register(
                                `options.${optionIndex}.choices.${choiceIndex}.priceModifier`,
                                { valueAsNumber: true }
                              )}
                              placeholder="Prix +/-"
                              className="w-24 h-8 text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeChoice(optionIndex, choiceIndex)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOption(optionIndex)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-border/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                Aucune option ajoutée
              </p>
            </div>
          )}
        </TabsContent>

        {/* Stock Tab */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="stock-tracked"
              checked={stockTracked}
              onCheckedChange={(checked) => setValue("stock.tracked", checked)}
            />
            <Label htmlFor="stock-tracked" className="text-sm">Suivre le stock de ce produit</Label>
          </div>

          {stockTracked && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stock-quantity" className="text-sm">Quantité</Label>
                <Input
                  id="stock-quantity"
                  type="number"
                  {...register("stock.quantity", { valueAsNumber: true })}
                  placeholder="0"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-threshold" className="text-sm">Seuil de stock faible</Label>
                <Input
                  id="stock-threshold"
                  type="number"
                  {...register("stock.lowStockThreshold", {
                    valueAsNumber: true,
                  })}
                  placeholder="0"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Scheduling Tab */}
        <TabsContent value="scheduling" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">
            Définissez la disponibilité de ce produit
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="availableFrom" className="text-sm">Disponible à partir de</Label>
              <Input
                id="availableFrom"
                type="time"
                {...register("scheduling.availableFrom")}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="availableUntil" className="text-sm">Disponible jusqu'à</Label>
              <Input
                id="availableUntil"
                type="time"
                {...register("scheduling.availableUntil")}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Jours disponibles (0=Dimanche, 6=Samedi)</Label>
            <p className="text-xs text-muted-foreground">
              Laisser vide pour tous les jours
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isLoading} size="sm">
          {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
