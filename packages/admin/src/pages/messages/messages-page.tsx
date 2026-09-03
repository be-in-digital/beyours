"use client"

import { usePaginatedQuery, useMutation } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"
import { Inbox } from "lucide-react"
import { hasPermission, type Role } from "@be-in-digital/core"
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import { formatShortDate } from "../../lib/formatters"
import { MessageDetailDialog } from "./message-detail-dialog"
import {
  statusOnOpening,
  STATUS_LABELS,
  STATUS_VARIANTS,
  type ContactMessage,
} from "./message-status"

type StatusFilter = "all" | "new" | "read" | "archived"

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Tous",
  new: "Nouveaux",
  read: "Lus",
  archived: "Archivés",
}

/**
 * What the storefront contact form collects, where the owner can read it.
 *
 * The two guards are the page; the inbox below is the screen. `usePaginatedQuery`
 * needs a real function reference on its first render, and `api` is injected by
 * the app's admin layout one render later — so the query lives in a child that
 * is not mounted until there is something to query with.
 */
export function MessagesPage() {
  const api = useAdminApiStore((state) => state.api)
  const storeId = useAdminStoreId()

  if (!storeId) {
    return (
      <NothingToShow title="Aucun établissement sélectionné">
        Sélectionnez un établissement pour lire ses messages
      </NothingToShow>
    )
  }

  if (!api) return <LoadingState />

  return <MessagesInbox api={api} storeId={storeId} />
}

function NothingToShow({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function MessagesInbox({
  api,
  storeId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected dynamically at runtime
  api: any
  storeId: string
}) {
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [opened, setOpened] = useState<ContactMessage | null>(null)
  const role = useAdminAuthStore((state) => state.role)
  const canWrite = hasPermission(role as Role, "customers:write")

  const { results, status, loadMore } = usePaginatedQuery(
    api.contactMessages.list,
    filter === "all" ? { storeId } : { storeId, status: filter },
    { initialNumItems: ADMIN_PAGE_SIZE }
  )

  const updateStatus = useMutation(api.contactMessages.updateStatus)
  const messages = results as ContactMessage[]

  /**
   * Opening a message is reading it; the owner should not have to say so.
   *
   * The open message is held rather than looked up in `results`: under the
   * "Nouveaux" filter, marking it read is what removes it from that list, and
   * a dialog that closes itself the moment it opens is not a screen anyone can
   * work an inbox on.
   */
  const open = async (message: ContactMessage) => {
    setOpened(message)

    const next = statusOnOpening(message, { canWrite })
    if (!next) return

    try {
      await updateStatus({ id: message._id, status: next })
      setOpened((current: ContactMessage | null) =>
        current?._id === message._id ? { ...current, status: next } : current
      )
    } catch {
      toast.error("Impossible de marquer le message comme lu")
    }
  }

  const archive = async (message: ContactMessage) => {
    try {
      await updateStatus({ id: message._id, status: "archived" })
      setOpened(null)
      toast.success("Message archivé")
    } catch {
      toast.error("Échec de l'archivage")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ce que vos clients vous écrivent depuis le formulaire de contact
          </p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((value) => (
              <SelectItem key={value} value={value}>
                {FILTER_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status === "LoadingFirstPage" ? (
        <LoadingState />
      ) : messages.length === 0 ? (
        <NothingToShow title="Aucun message">
          {filter === "all"
            ? "Les messages envoyés depuis votre page de contact arriveront ici"
            : `Aucun message ${FILTER_LABELS[filter].toLowerCase()}`}
        </NothingToShow>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expéditeur</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((message) => (
                <TableRow
                  key={message._id}
                  className="cursor-pointer"
                  data-testid="message-row"
                  data-status={message.status}
                  onClick={() => open(message)}
                >
                  <TableCell>
                    <div className={message.status === "new" ? "font-medium" : undefined}>
                      {message.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{message.email}</div>
                  </TableCell>
                  <TableCell className={message.status === "new" ? "font-medium" : undefined}>
                    {message.subject}
                  </TableCell>
                  <TableCell>{formatShortDate(message.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[message.status]}>
                      {STATUS_LABELS[message.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(ADMIN_PAGE_SIZE)}
              >
                {status === "LoadingMore" ? "Chargement…" : "Charger plus"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <MessageDetailDialog
        message={opened}
        canArchive={canWrite}
        open={opened !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpened(null)
        }}
        onArchive={archive}
      />
    </div>
  )
}
