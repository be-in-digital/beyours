"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { Download, Search, Users } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-yours/ui"

import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"

/**
 * The establishment's book of the people who have ordered from it.
 *
 * WHAT WAS BROKEN (#364, #98). This screen rendered the "coming soon"
 * placeholder in both apps, while three surfaces sold it — the strongest being
 * the onboarding tour, which said « Clients — Votre carnet d'adresses
 * intelligent ! » and navigated here. #363 deleted that step rather than let it
 * lead somewhere empty.
 *
 * The placeholder's component name is deliberately not written out anywhere in
 * this file: `onboarding-tour.test.ts` scans a page's source for that literal
 * to catch a tour step that narrates a feature and lands on a placeholder, and
 * the scan cannot tell a comment from a render. Naming it here would fail that
 * guard over a sentence about history.
 *
 * The data was collected four times and grouped nowhere: `orders.customerInfo`
 * per order, `emailSubscribers.metadata` for subscribers only, `gamePlays` for
 * players, `userProfiles` for accounts. `customers` is the aggregate, written
 * by the same hook that already maintained the subscriber one.
 *
 * ## WHAT THIS SCREEN IS NOT
 *
 * It is not a mailing list. `orders.ts` states the rule the product already
 * followed — *"an order is a purchase, not consent to be marketed to"* — and
 * nothing here subscribes anyone. The export below is the establishment's own
 * trade record, which is what the site means by "vous possédez vos clients";
 * campaigning to a person still requires them to have opted in, through the
 * Email screen.
 */

/** One of the person's orders, as the detail view shows it. */
interface CustomerOrder {
  _id: string
  orderNumber: string
  status: string
  total: number
  createdAt: number
}

interface Customer {
  _id: string
  email: string
  name: string
  phone?: string
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  firstOrderAt: number
  lastOrderAt: number
  orderTypes: string[]
}

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  )

const day = (ms: number) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(ms))

/**
 * The book as a CSV the owner keeps.
 *
 * `apps/site` sells « Vous possédez vos clients (emails, data) », and ownership
 * in the sense of portability had no mechanism anywhere in the admin — the only
 * CSV in the whole package was an IMPORT. Built in the browser from rows the
 * screen already has, so it needs no second endpoint and cannot export more
 * than the reader is allowed to see.
 *
 * Semicolon-separated and BOM-prefixed: Excel in a French locale reads a
 * comma-separated file as one column, and a file an owner cannot open is not an
 * export.
 */
function toCsv(rows: Customer[]): string {
  const escape = (value: string | number) => {
    const text = String(value ?? "")
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = [
    "Nom",
    "Email",
    "Téléphone",
    "Commandes",
    "Total dépensé (€)",
    "Panier moyen (€)",
    "Première commande",
    "Dernière commande",
  ]
  const lines = rows.map((row) =>
    [
      escape(row.name),
      escape(row.email),
      escape(row.phone ?? ""),
      row.totalOrders,
      (row.totalSpent / 100).toFixed(2).replace(".", ","),
      (row.averageOrderValue / 100).toFixed(2).replace(".", ","),
      day(row.firstOrderAt),
      day(row.lastOrderAt),
    ].join(";")
  )
  return `﻿${[header.join(";"), ...lines].join("\n")}`
}

export function CustomersPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const [search, setSearch] = useState("")
  const [order, setOrder] = useState<"recent" | "spend">("recent")
  const [openEmail, setOpenEmail] = useState<string | null>(null)

  const page = useQuery(
    api.customers.list,
    storeId ? { storeId, order } : "skip"
  ) as { customers: Customer[]; isDone: boolean } | undefined

  /**
   * How many orders this book cannot account for.
   *
   * An order with no e-mail is not a person here — a cash walk-in who gave a
   * first name has no contact — and a list that silently omitted them would
   * answer "how many customers do I have?" with a number wrong in one direction
   * and never say so.
   */
  const anonymous = useQuery(
    api.customers.anonymousOrderCount,
    storeId ? { storeId } : "skip"
  ) as { count: number; atLeast: boolean } | undefined

  /**
   * One person and the orders behind their totals.
   *
   * Loaded only when a row is opened: the list shows a page of people, and
   * fetching every one of their order histories to render a table nobody has
   * clicked is the read this screen exists to avoid.
   */
  const detail = useQuery(
    api.customers.get,
    storeId && openEmail ? { storeId, email: openEmail } : "skip"
  ) as { customer: Customer; orders: CustomerOrder[] } | null | undefined

  const customers = page?.customers ?? []
  const needle = search.trim().toLowerCase()
  // Filtered in the browser, over the page already loaded. A server-side search
  // would need an index on a prefix of the name and the e-mail, and this screen
  // shows a page at a time — a filter that silently searched only what was
  // loaded WITHOUT saying so is the version worth refusing, which is why the
  // count below says what it is counting.
  const shown = needle
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.email.toLowerCase().includes(needle)
      )
    : customers

  const download = () => {
    const blob = new Blob([toCsv(customers)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!storeId) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Les personnes qui ont commandé chez vous, et ce qu'elles ont commandé.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={download}
          disabled={customers.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exporter en CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un nom ou un e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Rechercher un client"
          />
        </div>
        <Button
          variant={order === "recent" ? "default" : "outline"}
          onClick={() => setOrder("recent")}
        >
          Récents
        </Button>
        <Button
          variant={order === "spend" ? "default" : "outline"}
          onClick={() => setOrder("spend")}
        >
          Meilleurs clients
        </Button>
      </div>

      {page === undefined ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Aucun client pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cette liste se remplit toute seule : chaque commande confirmée qui
            porte une adresse e-mail y ajoute la personne.
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Panier moyen</TableHead>
                <TableHead>Dernière</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((customer) => (
                <TableRow
                  key={customer._id}
                  className="cursor-pointer"
                  // Keyboard reachable, because a row that only answers a mouse
                  // is a row half the people using this screen cannot open.
                  tabIndex={0}
                  role="button"
                  aria-label={`Voir les commandes de ${customer.name}`}
                  onClick={() => setOpenEmail(customer.email)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setOpenEmail(customer.email)
                    }
                  }}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block">{customer.email}</span>
                    {customer.phone && (
                      <span className="block text-xs">{customer.phone}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{customer.totalOrders}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {euros(customer.totalSpent)}
                  </TableCell>
                  <TableCell className="text-right">
                    {euros(customer.averageOrderValue)}
                  </TableCell>
                  <TableCell>{day(customer.lastOrderAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {needle && shown.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun client de cette page ne correspond. La recherche porte sur les{" "}
              {customers.length} client{customers.length > 1 ? "s" : ""} chargés.
            </p>
          )}
        </>
      )}

      <Dialog open={openEmail !== null} onOpenChange={(open) => !open && setOpenEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.customer.name ?? "Client"}</DialogTitle>
            <DialogDescription>
              {openEmail}
              {detail?.customer.phone ? ` · ${detail.customer.phone}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail === undefined ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : detail === null ? (
            <p className="text-sm text-muted-foreground">
              Ce client n'est plus dans le carnet.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Commandes</p>
                  <p className="font-semibold">{detail.customer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total dépensé</p>
                  <p className="font-semibold">{euros(detail.customer.totalSpent)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Client depuis</p>
                  <p className="font-semibold">{day(detail.customer.firstOrderAt)}</p>
                </div>
              </div>

              {detail.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {/* Orders placed before the customer book existed carry no
                      derived key until the backfill migration has run, so this
                      is a real state on an existing deployment rather than a
                      contradiction — and saying so beats an empty table. */}
                  Aucune commande retrouvée pour cette adresse. Les commandes
                  antérieures à la création du carnet y apparaissent une fois la
                  migration passée.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.orders.map((order) => (
                      <TableRow key={order._id}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{day(order.createdAt)}</TableCell>
                        <TableCell>{order.status}</TableCell>
                        <TableCell className="text-right">{euros(order.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {anonymous && anonymous.count > 0 && (
        <p className="text-sm text-muted-foreground">
          {anonymous.atLeast ? "Au moins " : ""}
          {anonymous.count} commande{anonymous.count > 1 ? "s" : ""} sans adresse
          e-mail {anonymous.count > 1 ? "ne figurent" : "ne figure"} pas dans
          cette liste : sans contact, il n'y a personne à y inscrire.
        </p>
      )}
    </div>
  )
}
