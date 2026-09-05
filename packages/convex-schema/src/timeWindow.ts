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
 * The day and the time it is *at the restaurant*.
 *
 * Falls back to UTC when `Intl` refuses the timezone — a settings row holding a
 * typo must not close the whole catalogue.
 */
export function restaurantClock(
  now: number,
  timezone?: string
): { day: number; minutes: number } {
  const date = new Date(now)

  if (timezone) {
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
      // Unknown timezone identifier — fall through to UTC.
    }
  }

  return {
    day: date.getUTCDay(),
    minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
  }
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
