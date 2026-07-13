export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CURRENCIES = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "CHF", label: "Swiss Franc (CHF)" },
]

export const TIMEZONES = [
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "America/New_York", label: "America/New_York (GMT-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
]

// Day names in French - IMPORTANT: day 0 = Dimanche (Sunday), day 1 = Lundi (Monday)
export const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

// Display order: Monday first (day=1), Sunday last (day=0)
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
