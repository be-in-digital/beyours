"use client"

import { useMemo, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Badge,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@be-yours/ui"
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react"
import { CategoryForm } from "./category-form"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { ResolvingStore } from "../../components/resolving-store"
import { convexErrorMessage } from "../../lib/convex-error"

export function CategoriesPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const categories = useQuery(
    api?.categories?.listAll,
    storeId ? { storeId } : "skip"
  )

  // How many products each category holds. The deletion refuses while that
  // number is not zero, and an owner should read it before the click rather
  // than in a toast afterwards.
  const products = useQuery(
    api?.products?.listAll,
    storeId ? { storeId } : "skip"
  )

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const product of products ?? []) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1)
    }
    return counts
  }, [products])

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const reorderMutation = useMutation(api?.categories?.reorder)
  const removeMutation = useMutation(api?.categories?.remove)

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
      toast.success("Ordre mis à jour avec succès")
    } catch (error) {
      toast.error("Échec du réordonnancement des catégories")
      console.error(error)
    }
  }

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
      toast.success("Ordre mis à jour avec succès")
    } catch (error) {
      toast.error("Échec du réordonnancement des catégories")
      console.error(error)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await removeMutation({ id: deletingId })
      toast.success("Catégorie supprimée avec succès")
      setDeletingId(null)
    } catch (error) {
      toast.error(convexErrorMessage(error, "Échec de la suppression de la catégorie"))
      console.error(error)
    }
  }

  const deletingCount = deletingId ? productCounts.get(deletingId) ?? 0 : 0

  if (!storeId) return <ResolvingStore />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une catégorie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une catégorie</DialogTitle>
              <DialogDescription>
                Ajoutez une catégorie pour organiser vos produits.
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
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground mb-4">Aucune catégorie</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créez votre première catégorie
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category: any, index: number) => (
            <Card key={category._id} className="border-border/50">
              <CardHeader className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {category.imageUrl && (
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                      />
                    )}
                    <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">{category.name}</CardTitle>
                      <Badge variant={category.isActive ? "default" : "secondary"} className="text-xs">
                        {category.isActive ? "Actif" : "Inactif"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {productCounts.get(category._id) ?? 0} produit
                        {(productCounts.get(category._id) ?? 0) > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {category.description && (
                      <CardDescription className="text-xs">{category.description}</CardDescription>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Slug : {category.slug}
                    </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === categories.length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <Dialog
                      open={editingCategory?._id === category._id}
                      onOpenChange={(open) => !open && setEditingCategory(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCategory(category)}
                          className="h-7 w-7 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Modifier la catégorie</DialogTitle>
                          <DialogDescription>
                            Mettez à jour les informations de la catégorie.
                          </DialogDescription>
                        </DialogHeader>
                        <CategoryForm
                          storeId={storeId}
                          category={category}
                          onSuccess={() => setEditingCategory(null)}
                        />
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(category._id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingCount > 0 ? "Catégorie non vide" : "Êtes-vous sûr ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCount > 0 ? (
                <>
                  Cette catégorie contient {deletingCount} produit
                  {deletingCount > 1 ? "s" : ""}. Déplacez-{deletingCount > 1 ? "les" : "le"} dans
                  une autre catégorie avant de la supprimer : sans catégorie, un produit
                  reste commandable sans être classé nulle part.
                </>
              ) : (
                <>
                  Cette action est irréversible. La catégorie sera définitivement
                  supprimée.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            {deletingCount === 0 && (
              <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
