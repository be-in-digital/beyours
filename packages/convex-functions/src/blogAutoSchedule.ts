/**
 * When an Auto Blog configuration is due, and which theme it gets.
 *
 * The subscription was sold as "weekly, Tuesday, 09:00": the owner picked a
 * frequency, days, an hour and a timezone, the form saved all four, and nothing
 * ever read them. `blogAutoQueue` carried an index whose own comment said
 * "Cron: find pending jobs due for execution", and there was no cron.
 *
 * Everything here is pure, so the rule can be tested against a clock rather
 * than against a database. `planAutoBlogJobs` supplies the row and the time.
 */

/** Local wall-clock reading of an instant, in the configuration's own zone. */
export interface LocalParts {
  year: number
  month: number
  /** Day of the month, 1-31. */
  day: number
  /** Hour of the day, 0-23. */
  hour: number
  /** Day of the week, 0 = Sunday — the numbering `preferredWeekdays` uses. */
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/**
 * Read an instant as a wall clock in `timezone`.
 *
 * A restaurant in Paris wants its article at 09:00 Paris time in January and in
 * July alike, so this cannot be an offset applied to UTC — the offset changes
 * twice a year. `Intl` carries the zone database and does the arithmetic; an
 * unknown zone name falls back to UTC rather than throwing, because one badly
 * configured store must not stop the sweep for every other one.
 */
export function getLocalParts(at: number, timezone: string): LocalParts {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(new Date(at))
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(new Date(at))
  }

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "0"

  // `hour12: false` renders midnight as "24" in some ICU versions.
  const hour = Number(value("hour")) % 24

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour,
    weekday: WEEKDAY_INDEX[value("weekday")] ?? 0,
  }
}

/**
 * The scheduling half of a `blogAutoConfig` row.
 *
 * The singular fields are the deprecated shape the schema still declares and
 * still holds for configurations saved before the multi-day pickers. Reading
 * only the plural ones meant every one of those rows was silently never due:
 * not queued, not skipped, not reported — the subscription simply produced
 * nothing, for ever.
 */
export interface ScheduleConfig {
  frequency: "weekly" | "monthly"
  preferredWeekday?: number
  preferredMonthDay?: number
  preferredWeekdays?: number[]
  preferredMonthDays?: number[]
  preferredHour: number
  timezone: string
}

/**
 * The days a configuration asks for, whichever shape it was saved in.
 *
 * `normalizeScheduleDays` in `blogAutoGuards` says the same thing and existed
 * for exactly this, with tests, called by nothing. Kept local so the scheduling
 * rule stays self-contained and testable against a clock.
 */
function scheduledDays(config: ScheduleConfig): {
  weekdays: number[]
  monthDays: number[]
} {
  return {
    weekdays:
      config.preferredWeekdays ??
      (config.preferredWeekday !== undefined ? [config.preferredWeekday] : []),
    monthDays:
      config.preferredMonthDays ??
      (config.preferredMonthDay !== undefined ? [config.preferredMonthDay] : []),
  }
}

/**
 * One occurrence, named. Two sweeps of the same hour produce the same string,
 * which is what stops the planner queueing an article twice when a run is
 * retried or overlaps the next one.
 */
export function slotKey(local: LocalParts): string {
  const mm = String(local.month).padStart(2, "0")
  const dd = String(local.day).padStart(2, "0")
  const hh = String(local.hour).padStart(2, "0")
  return `${local.year}-${mm}-${dd}T${hh}`
}

/**
 * Is this configuration due at `at`?
 *
 * The planner runs hourly, so "due" means the local hour matches the one the
 * owner chose and the local day is one of the days they chose. A configuration
 * with no days selected is never due — it is not a configuration that was
 * finished.
 *
 * Summer time is handled by asking the zone rather than by arithmetic, which
 * settles the autumn case correctly: an hour that occurs twice is one slot, not
 * two, because `slotKey` names it once and `buildIdempotencyKey` refuses the
 * second. The spring case is the one gap left — an owner who chose exactly the
 * hour the clocks skip (02:00 in Europe/Paris) gets no article on that one day
 * of the year, because that hour genuinely does not happen. `preferredMonthDays`
 * is capped at 28 by `validateConfigAgainstPlan`, so February needs no such
 * caveat.
 */
export function isDue(config: ScheduleConfig, at: number): boolean {
  const local = getLocalParts(at, config.timezone)
  if (local.hour !== config.preferredHour) return false

  const { weekdays, monthDays } = scheduledDays(config)
  if (config.frequency === "weekly") {
    return weekdays.includes(local.weekday)
  }
  return monthDays.includes(local.day)
}

/**
 * The theme this occurrence gets.
 *
 * Rotates through the list in order rather than picking at random, so an owner
 * with three themes sees all three over three weeks instead of the same one
 * twice. Derived from the date, so a replanned slot chooses the same theme.
 */
export function themeForSlot(themes: string[], local: LocalParts): string | null {
  if (themes.length === 0) return null
  const daysSinceEpoch = Math.floor(
    Date.UTC(local.year, local.month - 1, local.day) / 86_400_000,
  )
  return themes[((daysSinceEpoch % themes.length) + themes.length) % themes.length] ?? null
}

/**
 * The key that makes queueing idempotent: one article per store per slot.
 *
 * The theme is deliberately absent. Including it would let a config edit
 * between two sweeps of the same hour queue a second article for the slot the
 * owner is paying for once.
 */
export function buildIdempotencyKey(storeId: string, key: string): string {
  return `${storeId}:${key}`
}

/**
 * How far back a sweep will look for a slot it missed.
 *
 * The planner runs hourly and `isDue` only ever matched the current hour, so a
 * deploy, a Convex incident or a cron backlog that swallowed one 09:00 cost the
 * owner that week's article outright — with nothing recorded, because a slot
 * that never became due is not a failure anybody sees. Six hours is late enough
 * to survive an outage and early enough that an article for "Tuesday morning"
 * does not arrive on Wednesday.
 */
export const CATCH_UP_WINDOW_HOURS = 6

/**
 * The slots this configuration owes, most recent first.
 *
 * Returns the current hour if it is due, plus any of the preceding
 * `CATCH_UP_WINDOW_HOURS` that were. The idempotency key is per slot, so a
 * catch-up cannot duplicate one that was already queued — the planner checks
 * before it inserts.
 */
export function dueSlots(
  config: ScheduleConfig,
  at: number,
  windowHours: number = CATCH_UP_WINDOW_HOURS,
): LocalParts[] {
  const slots: LocalParts[] = []
  for (let back = 0; back <= windowHours; back++) {
    const moment = at - back * 3_600_000
    if (isDue(config, moment)) slots.push(getLocalParts(moment, config.timezone))
  }
  return slots
}
