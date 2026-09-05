/**
 * Reading the reason out of a `ConvexError`, admin-side.
 *
 * Convex redacts the message of a plainly thrown `Error` in production — the
 * browser receives "Server Error" — so a refusal the owner is meant to act on
 * is thrown as `ConvexError({ code, message })`, whose `data` survives. This is
 * the reader for the other end.
 *
 * It deliberately mirrors each app's own `lib/convex-error.ts` rather than
 * importing it: this package is consumed BY those apps, so the dependency only
 * runs the other way. It is kept to the two functions the admin screens need,
 * and the app-side copy stays the fuller one.
 *
 * `data` arrives as an object from the browser client and as a JSON string from
 * `convex-test`. A screen that degrades to a generic message under one of the
 * two is a defect that only shows up on the side nobody exercised, so both are
 * handled.
 */

/** The shape every ConvexError in this product carries. */
export interface ConvexErrorPayload {
  code: string
  message?: string
}

/** Read `{ code, message }` off a thrown value, whichever form `data` took. */
export function convexErrorPayload(error: unknown): ConvexErrorPayload | null {
  const raw = (error as { data?: unknown } | null | undefined)?.data
  if (raw == null) return null

  let data: unknown = raw
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (typeof data !== "object" || data === null) return null
  const code = (data as { code?: unknown }).code
  if (typeof code !== "string") return null

  const message = (data as { message?: unknown }).message
  return { code, message: typeof message === "string" ? message : undefined }
}

/**
 * Turn a thrown value into something worth showing a restaurant owner.
 *
 * An unrecognised code still falls back to the server's own message —
 * deliberate, not an accident: a refusal added later reads correctly here
 * before anyone updates a screen. Only a value that is not a `ConvexError`
 * reaches `fallback`, and by then it has been redacted and there is genuinely
 * nothing left to say.
 */
export function convexErrorMessage(error: unknown, fallback: string): string {
  return convexErrorPayload(error)?.message ?? fallback
}
