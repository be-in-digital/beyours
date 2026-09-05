"use client"

import Link from "next/link"
import { STORE_STATUS_CONFIG } from "../../lib/vocabulary"
import {
  MoreVertical,
  Eye,
  Trash2,
  ArrowUpDown,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@be-in-digital/ui"
import { formatShortDate } from "../../lib/formatters"
import { cn } from "../../lib/utils"

type StoreStatus = "open" | "closed" | "temporarily_unavailable"

interface Store {
  _id: string
  name: string
  address: {
    street: string
    city: string
    postalCode: string
    country: string
  }
  phone?: string
  status: StoreStatus
  createdAt: number
}

interface StoresTableProps {
  stores: Store[]
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
  onChangeStatus: (storeId: string, status: StoreStatus) => void
  onDelete: (storeId: string) => void
}

const statusConfig = STORE_STATUS_CONFIG

export function StoresTable({
  stores,
  selectedIds,
  onSelectionChange,
  onChangeStatus,
  onDelete,
}: StoresTableProps) {
  const allSelected = stores.length > 0 && selectedIds.size === stores.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < stores.length

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(stores.map((s) => s._id)))
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectionChange(next)
  }

  if (stores.length === 0) {
    return (
      <div className="border border-border/50 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead className="text-xs">Nom</TableHead>
              <TableHead className="text-xs">Adresse</TableHead>
              <TableHead className="text-xs">Téléphone</TableHead>
              <TableHead className="text-xs">Statut</TableHead>
              <TableHead className="text-xs">Créé le</TableHead>
              <TableHead className="text-right w-[60px] text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  Aucun établissement trouvé.
                </p>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="border border-border/50 rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              {/*
                The mixed state is a `checked` value now, not a DOM property.
                The old Checkbox was a native `<input>` and this reached for
                `el.indeterminate`; the converged one is a Radix `<button
                role="checkbox">`, which carries the third state itself and
                reports it as `aria-checked="mixed"` — which the native input
                never did, so the header checkbox used to look mixed and
                announce itself as simply unchecked.
              */}
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Tout sélectionner"
              />
            </TableHead>
            <TableHead className="text-xs">Nom</TableHead>
            <TableHead className="text-xs">Adresse</TableHead>
            <TableHead className="text-xs">Téléphone</TableHead>
            <TableHead className="text-xs">Statut</TableHead>
            <TableHead className="text-xs">Créé le</TableHead>
            <TableHead className="text-right w-[60px] text-xs">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((store) => (
            <TableRow key={store._id} data-state={selectedIds.has(store._id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(store._id)}
                  onCheckedChange={() => toggleOne(store._id)}
                  aria-label={`Sélectionner ${store.name}`}
                />
              </TableCell>
              <TableCell className="text-sm font-medium">
                <Link href={`/dashboard/stores/${store._id}`} className="hover:underline">
                  {store.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {store.address.street}, {store.address.city}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {store.phone || "—"}
              </TableCell>
              <TableCell>
                <Badge className={cn("text-xs", statusConfig[store.status]?.className)}>
                  {statusConfig[store.status]?.label || store.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatShortDate(store.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/stores/${store._id}`} className="text-xs">
                        <Eye className="mr-2 h-3.5 w-3.5" />
                        Voir détails
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Changer le statut</DropdownMenuLabel>
                    {/* "draft" is displayed when present but never offered as a target */}
                    {(Object.keys(statusConfig) as StoreStatus[])
                      .filter((s) => s !== store.status && (s as string) !== "draft")
                      .map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => onChangeStatus(store._id, s)}
                          className="text-xs"
                        >
                          <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                          {statusConfig[s]?.label ?? s}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(store._id)}
                      className="text-destructive text-xs"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
