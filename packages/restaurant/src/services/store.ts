/**
 * Store Service
 *
 * Pure business logic functions for store operations
 * No side effects, no Convex calls - operates on data only
 */

import type { BusinessHours, Address, StoreDoc, StoreHoursStatus } from '../types'

/**
 * Is this a service that runs past midnight?
 *
 * `"18:00" – "02:00"` closes on the *next* calendar day. The two times are
 * compared as strings, so a service that ends before it starts can only mean it
 * crossed midnight. `open === close` is the 24-hour day that `"00:00" – "00:00"`
 * has always meant; a day that is shut says so with `isClosed`.
 */
const isOvernight = (open: string, close: string): boolean => close <= open

/** Minutes past midnight, for arithmetic the `"HH:mm"` strings cannot do. */
const toMinutes = (time: string): number => {
  const parts = time.split(':').map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

/** `now`, moved to `time` on the same day, offset by `dayOffset` days. */
const at = (now: Date, time: string, dayOffset = 0): Date => {
  const parts = time.split(':').map(Number)
  const moment = new Date(now)
  if (dayOffset !== 0) moment.setDate(now.getDate() + dayOffset)
  moment.setHours(parts[0] ?? 0, parts[1] ?? 0, 0, 0)
  return moment
}

/**
 * The same instant, with its local fields set to the wall clock of `timeZone`.
 *
 * WHY: opening hours are the restaurant's hours, not the visitor's. `getDay()`
 * and `getHours()` read the *browser's* clock, so a customer in Montréal saw a
 * Paris restaurant open at what was midday for them and the small hours in
 * Paris — and any visitor could change the answer by changing their system
 * clock. `globalSettings.timezone` was written by the settings page and read by
 * nothing.
 *
 * Returned as a Date whose local getters happen to spell the zone's calendar
 * date and time, so the rest of this module keeps using `getDay()` and
 * `getHours()`. `zoneShift` converts the results back to real instants.
 */
const inZone = (now: Date, timeZone: string): Date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now)

  const field = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  return new Date(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second')
  )
}

/**
 * The reading frame: a clock to compute in, and the offset back to real time.
 *
 * Without a time zone this is the visitor's own clock and a zero shift, which
 * is exactly what this module did before — so a caller that has no zone to give
 * loses nothing.
 */
const readingFrame = (now: Date, timeZone?: string): { clock: Date; shift: number } => {
  if (!timeZone) return { clock: now, shift: 0 }
  try {
    const clock = inZone(now, timeZone)
    return { clock, shift: clock.getTime() - now.getTime() }
  } catch {
    // An unknown zone must not take the storefront down. `Intl` throws on a
    // name it does not know, and a settings row can hold anything.
    return { clock: now, shift: 0 }
  }
}

/**
 * Which hours actually govern an establishment.
 *
 * `useGlobalHours` is a per-store flag the dashboard writes and the storefront
 * ignored: `use-store-status` read `store.hours` and nothing else, so an owner
 * who edited the global hours and left every location on "horaires globaux"
 * changed nothing anyone could see. `stores.create` seeds a hard-coded
 * 09:00–22:00 week, so what the storefront showed was that placeholder.
 *
 * Resolved on read rather than copied on write: one source of truth, and
 * editing the global hours reaches every location that follows them without a
 * migration.
 */
export const resolveStoreHours = (
  store: { hours?: BusinessHours[] | null; useGlobalHours?: boolean | null } | null | undefined,
  globalSettings?: { hours?: BusinessHours[] | null } | null
): BusinessHours[] => {
  if (!store) return []
  const globalHours = globalSettings?.hours
  if (store.useGlobalHours && globalHours && globalHours.length > 0) {
    return globalHours
  }
  return store.hours ?? []
}

/**
 * Check if store is currently open based on business hours
 *
 * WHY THE PREVIOUS DAY IS READ: a service declared on Friday as 18:00–02:00 is
 * still serving at 01:00 on Saturday. Saturday's own row says nothing about it —
 * Saturday's service starts at 18:00, and Saturday may even be closed. So the
 * hour before the close time belongs to the day before, and that is the row
 * that has to answer.
 *
 * The comparison used to be a plain `open <= now < close` on `"HH:mm"` strings,
 * with no wrap. An evening restaurant read as closed all evening: at 23:00
 * `"23:00" < "02:00"` is false, and at 01:00 `"01:00" >= "18:00"` is false. The
 * boolean disables add-to-cart everywhere and blocks checkout, so the shipped
 * `fast-food-minuit` vertical and the food trucks could not sell anything.
 */
export const isStoreOpen = (
  hours: BusinessHours[],
  now: Date = new Date(),
  timeZone?: string
): StoreHoursStatus => {
  const { clock, shift } = readingFrame(now, timeZone)
  /** A moment computed on the establishment's clock, back as a real instant. */
  const real = (moment: Date | null): Date | null =>
    moment === null ? null : new Date(moment.getTime() - shift)

  const currentDay = clock.getDay() // 0=Sunday, 6=Saturday
  const currentTime = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`

  // 1. Yesterday's service, if it runs into today.
  const yesterdayHours = hours.find((h) => h.day === (currentDay + 6) % 7)
  if (
    yesterdayHours &&
    !yesterdayHours.isClosed &&
    isOvernight(yesterdayHours.open, yesterdayHours.close) &&
    toMinutes(currentTime) < toMinutes(yesterdayHours.close)
  ) {
    return {
      isOpen: true,
      nextChange: real(at(clock, yesterdayHours.close)),
      currentPeriod: { open: yesterdayHours.open, close: yesterdayHours.close },
    }
  }

  const todayHours = hours.find((h) => h.day === currentDay)

  if (!todayHours || todayHours.isClosed) {
    return {
      isOpen: false,
      nextChange: real(nextOpeningOn(hours, clock)),
      currentPeriod: undefined,
    }
  }

  // 2. Today's own service.
  const overnight = isOvernight(todayHours.open, todayHours.close)
  const isOpen = overnight
    ? currentTime >= todayHours.open
    : currentTime >= todayHours.open && currentTime < todayHours.close

  let nextChange: Date | null
  if (isOpen) {
    // Closing time — tomorrow's date when the service crosses midnight.
    nextChange = at(clock, todayHours.close, overnight ? 1 : 0)
  } else if (currentTime < todayHours.open) {
    // Still to open today. This is also where an overnight day lands between
    // its close and its open — 10:00 on an 18:00–02:00 day opens at 18:00.
    nextChange = at(clock, todayHours.open)
  } else {
    // Done for today. Only a same-day range reaches this branch: an overnight
    // one is open from its opening time until midnight.
    nextChange = nextOpeningOn(hours, clock)
  }

  return {
    isOpen,
    nextChange: real(nextChange),
    currentPeriod: {
      open: todayHours.open,
      close: todayHours.close,
    },
  }
}

/**
 * The next opening, read on whatever clock `clock` is keeping.
 *
 * Looks at the days *after* today only: every reason to ask this question —
 * today is closed, or today's service is over — has already ruled today out.
 */
const nextOpeningOn = (hours: BusinessHours[], clock: Date): Date | null => {
  const currentDay = clock.getDay()

  // Check remaining days this week
  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7
    const dayHours = hours.find((h) => h.day === checkDay)

    if (dayHours && !dayHours.isClosed) {
      // Return opening time for this day
      return at(clock, dayHours.open, i)
    }
  }

  return null // Store never opens (all days closed)
}

/**
 * Get next opening time from now
 *
 * `timeZone` is the establishment's, not the visitor's — see `inZone`.
 */
export const getNextOpenTime = (
  hours: BusinessHours[],
  now: Date = new Date(),
  timeZone?: string
): Date | null => {
  const { clock, shift } = readingFrame(now, timeZone)
  const next = nextOpeningOn(hours, clock)
  return next === null ? null : new Date(next.getTime() - shift)
}

/**
 * Format store address for display
 */
export const formatStoreAddress = (address: Address): string => {
  return `${address.street}, ${address.postalCode} ${address.city}, ${address.country}`
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 * Returns Infinity if coordinates are invalid
 */
export const getStoreDistance = (
  storeLat: number | undefined,
  storeLng: number | undefined,
  userLat: number,
  userLng: number
): number => {
  if (storeLat === undefined || storeLng === undefined) {
    return Infinity
  }

  const R = 6371 // Earth's radius in km
  const dLat = toRad(userLat - storeLat)
  const dLng = toRad(userLng - storeLng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(storeLat)) * Math.cos(toRad(userLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Math.round(distance * 100) / 100 // Round to 2 decimals
}

/**
 * Helper: Convert degrees to radians
 */
const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180
}

/**
 * Sort stores by distance from user location
 */
export const sortStoresByDistance = (
  stores: StoreDoc[],
  userLat: number,
  userLng: number
): StoreDoc[] => {
  return [...stores].sort((a, b) => {
    const distA = getStoreDistance(a.address.latitude, a.address.longitude, userLat, userLng)
    const distB = getStoreDistance(b.address.latitude, b.address.longitude, userLat, userLng)

    return distA - distB
  })
}

/**
 * Split a store address into the lines a postal address is written on.
 *
 * `formatStoreAddress` joins the same fields with commas for a single-line
 * context — a select, a confirmation email. A contact card wants the shape the
 * visitor would copy onto an envelope, so the two live side by side rather
 * than one being derived from the other by splitting on a comma.
 *
 * Empty fields are dropped instead of leaving a stray "75009 ," on screen: a
 * store seeded from a partial import has them, and the visitor should see the
 * part that is known, not the punctuation around the part that is not.
 */
export const formatStoreAddressLines = (address: Address): string[] => {
  const locality = [address.postalCode, address.city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')

  return [address.street, locality, address.country]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
}

/** A run of consecutive days that keep the same service, as displayed. */
export type WeeklyHoursRow = {
  /** `"Lun"`, or `"Lun - Ven"` when the run covers several days. */
  days: string
  /** `"11h30 - 22h00"`, or `"Fermé"`. */
  hours: string
}

/** Monday first: the French week, not the schema's Sunday-indexed one. */
const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const SHORT_DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const

/** `"11:30"` reads as `"11h30"` to a French visitor. */
const toFrenchTime = (time: string): string => time.replace(':', 'h')

/**
 * Turn the stored week into the rows a contact card shows.
 *
 * The storefront used to render `store.openingHours` — a field that has never
 * existed on the document — so every visitor read an invented
 * `Lun - Ven / 11h00 - 22h00`. The real field is `hours`, indexed 0=Sunday,
 * one row per day, and it is not display-ready: seven identical lines is not
 * what a restaurant puts on its door.
 *
 * So consecutive days that serve the same times collapse into one range, and
 * only consecutive ones — a place open Monday and Wednesday but shut Tuesday
 * must not read `Lun - Mer`. Days the store never declared are left out
 * entirely rather than guessed as closed.
 */
export const formatWeeklyHours = (hours: BusinessHours[]): WeeklyHoursRow[] => {
  const byDay = new Map<number, BusinessHours>()
  for (const entry of hours) {
    if (!byDay.has(entry.day)) byDay.set(entry.day, entry)
  }

  const rows: WeeklyHoursRow[] = []
  let runStart: number | null = null
  let runEnd: number | null = null
  let runLabel: string | null = null

  const flush = (): void => {
    if (runStart === null || runEnd === null || runLabel === null) return
    const from = SHORT_DAY_NAMES[runStart]
    const to = SHORT_DAY_NAMES[runEnd]
    rows.push({
      days: runStart === runEnd ? `${from}` : `${from} - ${to}`,
      hours: runLabel,
    })
    runStart = null
    runEnd = null
    runLabel = null
  }

  for (const day of WEEK_DISPLAY_ORDER) {
    const entry = byDay.get(day)
    if (!entry) {
      flush()
      continue
    }

    const label = entry.isClosed
      ? 'Fermé'
      : `${toFrenchTime(entry.open)} - ${toFrenchTime(entry.close)}`

    if (label === runLabel) {
      runEnd = day
      continue
    }

    flush()
    runStart = day
    runEnd = day
    runLabel = label
  }

  flush()
  return rows
}
