"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react"
import { CategoryForm } from "./CategoryForm"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function CategoriesContent() {
  const storeId = useAdminStoreId()
  const categories = useQuery(
    api.categories.list,
    storeId ? { storeId } : "skip"
  )

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<Id<"categories"> | null>(null)

  const reorderMutation = useMutation(api.categories.reorder)
  const removeMutation = useMutation(api.categories.remove)

  // Handle moving category up in sort order
  const handleMoveUp = async (index: number) => {
    if (!categories || index === 0) return

    const newOrder = [...categories]
    const a = newOrder[index - 1]
    const b = newOrder[index]
    if (a && b) {
      newOrder[index - 1] = b
      newOrder[index] = a
    }

    try {
      await reorderMutation({ ids: newOrder.map((cat: any) => cat._id) })
      toast.success("Order updated successfully")
    } catch (error) {
      toast.error("Failed to reorder categories")
      console.error(error)
    }
  }

  // Handle moving category down in sort order
  const handleMoveDown = async (index: number) => {
    if (!categories || index === categories.length - 1) return

    const newOrder = [...categories]
    const a = newOrder[index]
    const b = newOrder[index + 1]
    if (a && b) {
      newOrder[index] = b
      newOrder[index + 1] = a
    }

    try {
      await reorderMutation({ ids: newOrder.map((cat: any) => cat._id) })
      toast.success("Order updated successfully")
    } catch (error) {
      toast.error("Failed to reorder categories")
      console.error(error)
    }
  }

  // Handle category deletion
  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await removeMutation({ id: deletingId })
      toast.success("Category deleted successfully")
      setDeletingId(null)
    } catch (error) {
      toast.error("Failed to delete category")
      console.error(error)
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">Please select a store</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add Category button */}
      <div className="flex items-center justify-end">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
              <DialogDescription>
                Add a new category to organize your products.
              </DialogDescription>
            </DialogHeader>
            <CategoryForm
              storeId={storeId}
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!categories ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No categories yet</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category: any, index: number) => (
            <Card key={category._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{category.name}</CardTitle>
                      <Badge variant={category.isActive ? "default" : "secondary"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {category.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Slug: {category.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === categories.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Edit button */}
                    <Dialog
                      open={editingCategory?._id === category._id}
                      onOpenChange={(open) => !open && setEditingCategory(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCategory(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Category</DialogTitle>
                          <DialogDescription>
                            Update category information.
                          </DialogDescription>
                        </DialogHeader>
                        <CategoryForm
                          storeId={storeId}
                          category={category}
                          onSuccess={() => setEditingCategory(null)}
                        />
                      </DialogContent>
                    </Dialog>

                    {/* Delete button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingId(category._id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category.
              Products in this category will not be deleted, but will lose their category assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
