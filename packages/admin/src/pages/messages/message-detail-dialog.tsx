"use client"

import { Archive, Mail, Phone } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Separator,
} from "@be-yours/ui"
import { formatDate } from "../../lib/formatters"
import { STATUS_LABELS, STATUS_VARIANTS, type ContactMessage } from "./message-status"

interface MessageDetailDialogProps {
  message: ContactMessage | null
  /** `customers:write`. A manager and a waiter read the inbox without it. */
  canArchive: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onArchive: (message: ContactMessage) => void
}

/**
 * One message, in full, with the two things the owner does next: reply to the
 * address it came from, or archive it.
 */
export function MessageDetailDialog({
  message,
  canArchive,
  open,
  onOpenChange,
  onArchive,
}: MessageDetailDialogProps) {
  if (!message) return null

  const replySubject = encodeURIComponent(`Re : ${message.subject}`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{message.subject}</DialogTitle>
          <DialogDescription>
            {message.name} — {formatDate(message.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={STATUS_VARIANTS[message.status]}>
            {STATUS_LABELS[message.status]}
          </Badge>
          <a
            href={`mailto:${message.email}?subject=${replySubject}`}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Mail className="size-3.5" />
            {message.email}
          </a>
          {message.phone ? (
            <a
              href={`tel:${message.phone}`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3.5" />
              {message.phone}
            </a>
          ) : null}
        </div>

        <Separator />

        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>

        {canArchive && message.status !== "archived" ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              data-testid="archive-message"
              onClick={() => onArchive(message)}
            >
              <Archive className="mr-2 size-4" />
              Archiver
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
