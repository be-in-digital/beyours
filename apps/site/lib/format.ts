/**
 * Helpers de formatage — fr-FR, montants en centimes (comme le modèle Convex).
 * Tout ce qui touche à l'argent transite en centimes (entiers) et se formate ici.
 */

const CURRENCY_LOCALE = "fr-FR";

/** 123456 (cents) → "1 234,56 €" */
export function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
  }).format((cents ?? 0) / 100);
}

/** 123456 (cents) → "1 235 €" (pas de décimales, pour les KPI compacts) */
export function formatCentsRounded(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

/** 1234567 (cents) → "12,3 k€" — pour gros chiffres de dashboard */
export function formatCentsCompact(cents: number, currency = "EUR"): string {
  const euros = (cents ?? 0) / 100;
  const compact = new Intl.NumberFormat(CURRENCY_LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(euros);
  return currency === "EUR" ? `${compact} €` : `${compact} ${currency}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE).format(n ?? 0);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n ?? 0);
}

/** 0.0734 → "+7,3 %" (signe optionnel) */
export function formatPercent(ratio: number, withSign = false): string {
  const v = new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio ?? 0);
  return withSign && (ratio ?? 0) > 0 ? `+${v}` : v;
}

/** points de pourcentage déjà calculés (12.4 → "12,4 %") */
export function formatPercentPoints(points: number): string {
  return `${new Intl.NumberFormat(CURRENCY_LOCALE, {
    maximumFractionDigits: 1,
  }).format(points ?? 0)} %`;
}

const DATE_FMT = new Intl.DateTimeFormat(CURRENCY_LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const DATETIME_FMT = new Intl.DateTimeFormat(CURRENCY_LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const TIME_FMT = new Intl.DateTimeFormat(CURRENCY_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
});
const DAY_MONTH_FMT = new Intl.DateTimeFormat(CURRENCY_LOCALE, {
  day: "2-digit",
  month: "short",
});

export function formatDate(ts?: number | null): string {
  if (!ts) return "—";
  return DATE_FMT.format(new Date(ts));
}

export function formatDateTime(ts?: number | null): string {
  if (!ts) return "—";
  return DATETIME_FMT.format(new Date(ts));
}

export function formatTime(ts?: number | null): string {
  if (!ts) return "—";
  return TIME_FMT.format(new Date(ts));
}

export function formatDayMonth(ts?: number | null): string {
  if (!ts) return "—";
  return DAY_MONTH_FMT.format(new Date(ts));
}

const RELATIVE_FMT = new Intl.RelativeTimeFormat(CURRENCY_LOCALE, {
  numeric: "auto",
});

/** "il y a 3 h", "dans 12 j" — relatif à maintenant */
export function formatRelative(ts?: number | null, now = Date.now()): string {
  if (!ts) return "—";
  const diff = ts - now;
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (abs < min) return "à l'instant";
  if (abs < hour) return RELATIVE_FMT.format(Math.round(diff / min), "minute");
  if (abs < day) return RELATIVE_FMT.format(Math.round(diff / hour), "hour");
  if (abs < week) return RELATIVE_FMT.format(Math.round(diff / day), "day");
  if (abs < month) return RELATIVE_FMT.format(Math.round(diff / week), "week");
  if (abs < year) return RELATIVE_FMT.format(Math.round(diff / month), "month");
  return RELATIVE_FMT.format(Math.round(diff / year), "year");
}

/** Nombre de jours entiers entre maintenant et une date future (négatif si passée). */
export function daysUntil(ts?: number | null, now = Date.now()): number {
  if (!ts) return 0;
  return Math.ceil((ts - now) / (24 * 60 * 60 * 1000));
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
