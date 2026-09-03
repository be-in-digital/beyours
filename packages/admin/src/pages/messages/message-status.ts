/**
 * The three states a contact message moves between, and who may move it.
 *
 * Shared by the table, the dialog and the test, so the words the owner reads
 * and the rule the screen applies cannot drift apart.
 */

export type ContactMessageStatus = "new" | "read" | "archived"

/** A row of `contactMessages`, as the screen reads it. */
export interface ContactMessage {
  _id: string
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  status: ContactMessageStatus
  createdAt: number
}

export const STATUS_LABELS: Record<ContactMessageStatus, string> = {
  new: "Nouveau",
  read: "Lu",
  archived: "Archivé",
}

export const STATUS_VARIANTS: Record<
  ContactMessageStatus,
  "default" | "secondary" | "outline"
> = {
  new: "default",
  read: "secondary",
  archived: "outline",
}

/**
 * The status opening a message should leave it in, or `null` to leave it as it
 * is.
 *
 * `updateStatus` asks for `customers:write`, which a manager and a waiter do
 * not hold even though `customers:read` puts the screen in front of them. For
 * them opening a message changes nothing, rather than failing on every click.
 */
export function statusOnOpening(
  message: Pick<ContactMessage, "status">,
  reader: { canWrite: boolean }
): ContactMessageStatus | null {
  if (!reader.canWrite) return null
  return message.status === "new" ? "read" : null
}
