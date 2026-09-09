/**
 * Recurring time windows, read on the restaurant's clock.
 *
 * Two features ask the same question — "is now inside this window?" — of the
 * same kind of configuration: a dish served 11:00–14:00 on weekdays, and a
 * happy hour running 17:00–19:00 Monday to Friday. Both are stored as a set of
 * days plus two times, and both are meaningless without the timezone they were
 * written in.
 *
 * WHY THE TIMEZONE MATTERS: Convex runs its functions in UTC. "Before 14:00"
 * evaluated on the server clock closes a lunch menu at 16:00 Paris time in
 * summer, and opens a happy hour two hours early. The kitchen's clock decides,
 * and that clock is `globalSettings.timezone`.
 */

/** A recurring window: days it runs on, and the times it opens and closes. */
export interface RecurringWindow {
  /** 0 = Sunday … 6 = Saturday. Empty or absent means every day. */
  days?: number[]
  /** "11:00" */
  from?: string
  /** "14:00" */
  until?: string
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/**
 * The clock a French restaurant keeps, used whenever nothing says otherwise.
 *
 * WHY THERE IS A DEFAULT AT ALL. The timezone comes from
 * `globalSettings.timezone`, and `globalSettings` is a singleton the team
 * writes — NOTHING seeds it. A deployment whose settings have never been saved
 * has no row, so every caller passed `undefined` and this module read the
 * server clock. Convex runs in UTC. Measured on a store open 11:00–14:00 with
 * no settings row: an order at 14:30 Paris was ACCEPTED and written to the
 * kitchen, and one at 11:30 Paris — mid-service — was refused
 * `outside_opening_hours`. Two hours of every summer day taking orders after
 * closing, and two hours refusing them during service.
 *
 * WHY PARIS. This engine is sold to French établissements: prices format
 * `fr-FR`/EUR, the retention window defaults to the CNIL's three years, and the
 * refusals are written in French. UTC was never anybody's kitchen clock — it
 * was the absence of an answer. A deployment outside this timezone still sets
 * `globalSettings.timezone` and is unaffected; what changes is only what
 * happens when the question was never answered.
 *
 * It is also the fallback for a timezone `Intl` refuses, for the same reason
 * the UTC fallback was: a settings row holding a typo must not close the whole
 * catalogue. It now fails to the product's clock instead of to the server's.
 */
export const DEFAULT_RESTAURANT_TIMEZONE = "Europe/Paris"

/**
 * The day and the time it is *at the restaurant*.
 *
 * `timezone` absent, or unusable, means DEFAULT_RESTAURANT_TIMEZONE — see
 * above. The UTC branch below survives only for the case where even that
 * cannot be resolved, which would mean an ICU build with no timezone data at
 * all; returning nothing is not an option a caller can use.
 */
export function restaurantClock(
  now: number,
  timezone?: string
): { day: number; minutes: number } {
  const date = new Date(now)

  for (const zone of [timezone, DEFAULT_RESTAURANT_TIMEZONE]) {
    if (!zone) continue
    const read = readClock(date, zone)
    if (read) return read
  }

  return {
    day: date.getUTCDay(),
    minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
  }
}

/** The day and minute-of-day in `timezone`, or `null` if `Intl` refuses it. */
function readClock(
  date: Date,
  timezone: string
): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)

    const weekday = parts.find((p) => p.type === "weekday")?.value
    const hour = parts.find((p) => p.type === "hour")?.value
    const minute = parts.find((p) => p.type === "minute")?.value
    const day = weekday ? WEEKDAY_INDEX[weekday] : undefined

    if (day !== undefined && hour !== undefined && minute !== undefined) {
      // Some ICU versions render midnight as "24" under hour12: false.
      const hours = Number(hour) % 24
      return { day, minutes: hours * 60 + Number(minute) }
    }
  } catch {
    // Unknown timezone identifier — the caller tries the next one.
  }

  return null
}

/** "11:00" → 660. Returns undefined for anything that is not HH:MM. */
export function parseClockTime(value?: string): number | undefined {
  if (!value) return undefined
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return hours * 60 + minutes
}

/**
 * Whether the window is open right now.
 *
 * A window whose end is before its start crosses midnight — 22:00 → 02:00 is a
 * late-night menu, not an empty set. In its small hours the day being served is
 * the one that started the evening before, so a Friday-only late menu is still
 * on at 01:00 on Saturday morning.
 */
export function isWithinWindow(
  window: RecurringWindow | undefined,
  now: number,
  timezone?: string
): boolean {
  if (!window) return true

  const { day, minutes } = restaurantClock(now, timezone)

  const days = window.days
  const from = parseClockTime(window.from)
  const until = parseClockTime(window.until)

  const overnight = from !== undefined && until !== undefined && until < from

  const servedDay =
    overnight && from !== undefined && minutes < from ? (day + 6) % 7 : day

  if (days && days.length > 0 && !days.includes(servedDay)) return false

  if (overnight && from !== undefined && until !== undefined) {
    return minutes >= from || minutes <= until
  }
  if (from !== undefined && minutes < from) return false
  if (until !== undefined && minutes > until) return false

  return true
}
