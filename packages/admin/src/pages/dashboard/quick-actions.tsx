"use client"

import Link from "next/link"
import { ShoppingCart, PlusCircle, ChefHat } from "lucide-react"
import { adminRoutes } from "../../config/admin-routes"

const actions = [
  {
    href: adminRoutes.orders,
    icon: ShoppingCart,
    label: "Nouvelle commande",
    description: "Créer une commande manuellement",
  },
  {
    href: adminRoutes.newProduct,
    icon: PlusCircle,
    label: "Ajouter un produit",
    description: "Ajouter au catalogue",
  },
  {
    href: adminRoutes.kitchen,
    icon: ChefHat,
    label: "Voir la cuisine",
    description: "Écran de préparation",
  },
]

export function QuickActions() {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        Actions rapides
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <div className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5 transition-colors hover:bg-accent/40 cursor-pointer">
              <div className="rounded-lg bg-muted/50 p-2">
                <action.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-[11px] text-muted-foreground">{action.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
