"use client"

import Link from "next/link"
import Image from "next/image"
import { useMutation } from "convex/react"
import { MoreVertical, Edit, Trash2, Eye, EyeOff, Link2 } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { useAdminApi } from "../../hooks/admin-hooks"
import { formatPrice } from "../../lib/formatters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@beindigital-engine/ui"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"

/** Product source values matching the database schema */
type ProductSource = "manual" | "uber_eats" | "deliveroo"

interface Product {
  _id: string
  name: string
  description?: string
  categoryId: string
  price: number
  images: string[]
  stock?: {
    tracked: boolean
    quantity: number
    lowStockThreshold: number
  }
  isActive: boolean
  isFeatured: boolean
  source?: ProductSource
  linkedProductId?: string
}

interface Category {
  _id: string
  name: string
}

interface ProductsTableProps {
  products: Product[]
  categories: Category[]
}

export function ProductsTable({ products, categories }: ProductsTableProps) {
  const api = useAdminApi() as any
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)

  const toggleStatus = useMutation(api?.products?.toggleStatus)
  const removeProduct = useMutation(api?.products?.remove)

  const getCategoryName = (categoryId: string) => {
    return categories.find((cat) => cat._id === categoryId)?.name || "Inconnu"
  }

  /** Returns the badge element matching the given product source */
  const getSourceBadge = (source: ProductSource | undefined) => {
    switch (source) {
      case "uber_eats":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            Uber Eats
          </span>
        )
      case "deliveroo":
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            Deliveroo
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
            Manuel
          </span>
        )
    }
  }

  const handleToggleStatus = async (productId: string) => {
    try {
      await toggleStatus({ id: productId })
      toast.success("Statut du produit mis à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour du statut")
      console.error(error)
    }
  }

  const handleDelete = async () => {
    if (!productToDelete) return

    try {
      await removeProduct({ id: productToDelete })
      toast.success("Produit supprimé avec succès")
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (error) {
      toast.error("Échec de la suppression du produit")
      console.error(error)
    }
  }

  const openDeleteDialog = (productId: string) => {
    setProductToDelete(productId)
    setDeleteDialogOpen(true)
  }

  return (
    <>
      <div className="border border-border/50 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Aucun produit à afficher</p>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product._id}>
                  {/* Image */}
                  <TableCell>
                    <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted">
                      {product.images[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-[10px]">
                          Sans
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Name + Description */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">{product.name}</div>
                      {product.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {product.description}
                        </div>
                      )}
                      {product.isFeatured && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          En vedette
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryName(product.categoryId)}
                    </Badge>
                  </TableCell>

                  {/* Price */}
                  <TableCell className="font-medium text-sm">
                    {formatPrice(product.price)}
                  </TableCell>

                  {/* Stock */}
                  <TableCell>
                    {product.stock?.tracked ? (
                      <div className="text-xs">
                        <div>{product.stock.quantity} unités</div>
                        {product.stock.quantity <= product.stock.lowStockThreshold && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1 mt-0.5">
                            Stock faible
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Non suivi
                      </span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={product.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {product.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>

                  {/* Source — shows colored badge and a link icon when duplicated */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {getSourceBadge(product.source)}
                      {product.linkedProductId && (
                        <Link2
                          className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
                          aria-label="Produit lié"
                        />
                      )}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/products/${product._id}`} className="text-xs">
                            <Edit className="mr-2 h-3.5 w-3.5" />
                            Modifier
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(product._id)}
                          className="text-xs"
                        >
                          {product.isActive ? (
                            <>
                              <EyeOff className="mr-2 h-3.5 w-3.5" />
                              Désactiver
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              Activer
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(product._id)}
                          className="text-destructive text-xs"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Supprimer le produit"
        description="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
      />
    </>
  )
}
