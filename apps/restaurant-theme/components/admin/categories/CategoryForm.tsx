"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

// Form validation schema
const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  slug: z.string().min(1, "Slug is required").max(100, "Slug is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  isActive: z.boolean(),
})

type CategoryFormData = z.infer<typeof categorySchema>

interface CategoryFormProps {
  storeId: Id<"stores">
  category?: any // Existing category for edit mode
  onSuccess?: () => void
}

export function CategoryForm({ storeId, category, onSuccess }: CategoryFormProps) {
  const createMutation = useMutation(api.categories.create)
  const updateMutation = useMutation(api.categories.update)

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
      isActive: category?.isActive ?? true,
    },
  })

  // Watch name field to auto-generate slug
  const nameValue = watch("name")

  // Auto-generate slug from name (only if not in edit mode or slug is empty)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (!isEditMode || !category?.slug) {
      // Generate slug: lowercase, replace spaces with hyphens, remove special chars
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
          isActive: data.isActive,
        })
        toast.success("Category updated successfully")
      } else {
        // Get the next sort order (max + 1)
        const sortOrder = 0 // This will be handled by the backend

        await createMutation({
          storeId,
          name: data.name,
          slug: data.slug,
          description: data.description || undefined,
          sortOrder,
          isActive: data.isActive,
        })
        toast.success("Category created successfully")
      }

      onSuccess?.()
    } catch (error) {
      toast.error(isEditMode ? "Failed to update category" : "Failed to create category")
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          {...register("name")}
          onChange={(e) => {
            register("name").onChange(e)
            handleNameChange(e)
          }}
          placeholder="e.g., Burgers, Desserts, Drinks"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Slug field */}
      <div className="space-y-2">
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          {...register("slug")}
          placeholder="burgers"
          readOnly={!isEditMode}
          className={!isEditMode ? "bg-muted" : ""}
        />
        <p className="text-xs text-muted-foreground">
          {isEditMode
            ? "URL-friendly identifier (can be edited)"
            : "Auto-generated from name"}
        </p>
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      {/* Description field */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Optional description for this category"
          rows={3}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Active status switch */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="isActive">Active</Label>
          <p className="text-sm text-muted-foreground">
            Inactive categories won't be shown on the storefront
          </p>
        </div>
        <Switch
          id="isActive"
          checked={watch("isActive")}
          onCheckedChange={(checked) => setValue("isActive", checked)}
        />
      </div>

      {/* Submit button */}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : isEditMode
            ? "Update Category"
            : "Create Category"}
        </Button>
      </div>
    </form>
  )
}
