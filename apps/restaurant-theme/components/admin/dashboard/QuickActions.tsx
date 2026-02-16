"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ShoppingCart, PlusCircle, ChefHat } from "lucide-react"

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter un produit
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/kitchen">
              <ChefHat className="mr-2 h-4 w-4" />
              Voir la cuisine
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
