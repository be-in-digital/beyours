/**
 * Table labels.
 *
 * Two places in the product name a table, and they arrived years apart:
 *
 *   - `gameQRCodes.tableNumber` — the label printed on the QR code sitting on
 *     a table, so a winning play can be traced back to where it was played.
 *   - `orders.tableNumber` — the table a dine-in order is served to.
 *
 * They are the same real-world thing, so they share this module rather than
 * each trimming input their own way. What they deliberately do **not** share
 * is a foreign key: there is no `tables` table, and introducing one would make
 * dine-in service depend on the gamification QR codes being configured. A
 * restaurant can serve `sur place` without ever running the wheel-of-fortune,
 * and a QR code can name a terrace bench that never takes an order. So both
 * stay `v.optional(v.string())` — one *representation*, two independent fields.
 *
 * A label, not a number, on purpose: real dining rooms use `12`, `A3`,
 * `Terrasse 4`, `Bar 2`. Parsing it as an integer would reject half of them.
 */

/**
 * Longest table label accepted.
 *
 * A kitchen ticket is 48mm or 72mm of thermal paper and the table is printed
 * on one line; anything past this is not a table label, it is a paste
 * accident, and it would push the rest of the ticket off the roll.
 */
export const MAX_TABLE_NUMBER_LENGTH = 32

/**
 * Characters that carry no ink and that `\s` does not match.
 *
 * `\s` covers NBSP and the BOM but not the zero-width family or a soft hyphen,
 * so a label pasted from Word as a lone `U+200B` used to survive `trim()` as a
 * one-character string: the storefront's required check saw a truthy value, the
 * server accepted it, and the slip printed `TABLE` with nothing after it — the
 * exact outcome the doc below says this function exists to prevent.
 *
 * The C0/C1 control range goes with them. `U+001B` is the ESC/POS lead byte,
 * and the thermal path in LAUNCH-04 will feed this label to a printer.
 *
 * U+0009 to U+000D are deliberately absent: tab, newline and carriage return
 * ARE whitespace, so they belong to the collapse below rather than here.
 * Deleting them outright turned `"Table<tab>4"` into `"Table4"`.
 */
const INVISIBLE =
  /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\ufeff]/g

/**
 * Collapse a typed table label to what should be stored, or `undefined` when
 * nothing was really entered.
 *
 * Whitespace-only input is `undefined`, not `""`: an empty string stored on an
 * order is indistinguishable from a real label until something tries to print
 * it, and then it prints an empty "Table :" line that reads as a system fault
 * rather than as a missing entry. Internal runs of whitespace collapse so
 * `"Table  4"` and `"Table 4"` are one label.
 */
export function normalizeTableNumber(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Whether a normalised label is storable.
 *
 * Call it on the output of `normalizeTableNumber`; `undefined` is valid
 * because the field is optional everywhere it appears.
 */
export function isValidTableNumber(value: string | undefined): boolean {
  if (value === undefined) return true
  return value.length > 0 && value.length <= MAX_TABLE_NUMBER_LENGTH
}
