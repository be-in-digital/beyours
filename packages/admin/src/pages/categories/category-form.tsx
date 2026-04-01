"use client"

import { useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAction, useMutation } from "convex/react"
import { toast } from "sonner"
import { Button, Input, Textarea, Label, Switch } from "@be-in-digital/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { ImageUploader } from "../../components/image-uploader"

const categorySchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100, "Le nom est trop long"),
  slug: z.string().min(1, "Le slug est requis").max(100, "Le slug est trop long"),
  description: z.string().max(500, "La description est trop longue").optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean(),
})

type CategoryFormData = z.infer<typeof categorySchema>

interface CategoryFormProps {
  storeId: string
  category?: any
  onSuccess?: () => void
}

export function CategoryForm({ storeId, category, onSuccess }: CategoryFormProps) {
  const { api } = useAdminApiStore()
  const createMutation = useMutation(api?.categories?.create)
  const updateMutation = useMutation(api?.categories?.update)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPresignedUrl = useAction(api?.storageUpload?.getPresignedUploadUrl ?? (null as any))

  const isEditMode = !!category

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || "",
      slug: category?.slug || "",
      description: category?.description || "",
      imageUrl: category?.imageUrl || "",
      isActive: category?.isActive ?? true,
    },
  })

  const handleRequestUploadUrl = useCallback(
    async (args: { folder: string; contentType: string }) => {
      if (!getPresignedUrl) throw new Error("API non disponible")
      return getPresignedUrl(args)
    },
    [getPresignedUrl]
  )

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (!isEditMode || !category?.slug) {
      const slug = value
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      setValue("slug", slug)
    }
  }

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (isEditMode) {
        await updateMutation({
          id: category._id,
          name: data.name,
          slug: data.slug,
          description: data.description || undefined,
          imageUrl: data.imageUrl || undefined,
          isActive: data.isActive,
        })
        toast.success("Catégorie mise à jour avec succès")
      } else {
        await createMutation({
          storeId,
          name: data.name,
          slug: data.slug,
          description: data.description || undefined,
          imageUrl: data.imageUrl || undefined,
          sortOrder: 0,
          isActive: data.isActive,
        })
        toast.success("Catégorie créée avec succès")
      }

      onSuccess?.()
    } catch (error) {
      toast.error(isEditMode ? "Échec de la mise à jour de la catégorie" : "Échec de la création de la catégorie")
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom *</Label>
        <Input
          id="name"
          {...register("name")}
          onChange={(e) => {
            register("name").onChange(e)
            handleNameChange(e)
          }}
          placeholder="ex : Burgers, Desserts, Boissons"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          {...register("slug")}
          placeholder="Identifiant URL..."
          readOnly={!isEditMode}
          className={!isEditMode ? "bg-muted" : ""}
        />
        <p className="text-xs text-muted-foreground">
          {isEditMode
            ? "Identifiant URL (modifiable)"
            : "Généré automatiquement à partir du nom"}
        </p>
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Description optionnelle pour cette catégorie"
          rows={3}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <ImageUploader
          value={watch("imageUrl") || ""}
          onChange={(url) => setValue("imageUrl", url)}
          onRequestUploadUrl={handleRequestUploadUrl}
          folder="categories"
          accept="image/jpeg,image/png,image/webp"
          maxSizeMB={5}
          label="Image de la catégorie"
          placeholder="Image affichée sur la page d'accueil dans la section catégories"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="isActive">Actif</Label>
          <p className="text-xs text-muted-foreground">
            Les catégories inactives ne seront pas affichées en ligne
          </p>
        </div>
        <Switch
          id="isActive"
          checked={watch("isActive")}
          onCheckedChange={(checked) => setValue("isActive", checked)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting
            ? "Enregistrement..."
            : isEditMode
            ? "Mettre à jour"
            : "Créer la catégorie"}
        </Button>
      </div>
    </form>
  )
}
