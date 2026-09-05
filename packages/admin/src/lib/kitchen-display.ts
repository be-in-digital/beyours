/**
 * The dining-room screen's auto-dismiss window.
 *
 * WHY THIS EXISTS: `stores.displayConfig` decides how long a finished order
 * stays on the customer-facing screen, `kitchenTickets.getForDisplay` has read
 * it since the screen shipped, and nothing wrote it. The field was filed as
 * dead in 74de4e9 on a claim nobody checked and its mutation was deleted, so
 * every establishment ran on the query's own fallback: an order still being
 * waited for vanished from the wall fifteen minutes after the kitchen called it
 * ready, with no setting anywhere to change that (Q-2).
 *
 * The defaults live here, in the shared admin package, because two places have
 * to agree on them: the editor an owner sets the window in, and the query that
 * applies it. `DEFAULT_DISPLAY_CONFIG` mirrors the literal in
 * `kitchenTickets.getForDisplay` exactly — the form has to open on what the
 * screen is currently doing, not on a second opinion about it.
 */

export interface KitchenDisplayConfig {
  /** Whether a ready order is dropped from the screen at all. */
  autoDismissEnabled: boolean
  /** How long it stays there after the kitchen calls it ready. */
  autoDismissMinutes: number
}

/**
 * What the dining-room screen does for an establishment that has never been
 * configured.
 *
 * Must stay equal to the fallback in `kitchenTickets.getForDisplay`. A form
 * that opens on different numbers than the screen is running on is a lie the
 * owner cannot see through.
 */
export const DEFAULT_DISPLAY_CONFIG: KitchenDisplayConfig = {
  autoDismissEnabled: true,
  autoDismissMinutes: 15,
}

/**
 * The narrowest and widest windows the editor will send.
 *
 * Must stay equal to `MIN_AUTO_DISMISS_MINUTES` / `MAX_AUTO_DISMISS_MINUTES` in
 * `packages/convex-functions/src/stores.ts`, which is where the range is
 * enforced. A wider range here offers the owner a value the mutation refuses; a
 * narrower one hides a value it would accept.
 */
export const MIN_AUTO_DISMISS_MINUTES = 1
export const MAX_AUTO_DISMISS_MINUTES = 240

/**
 * Fill in what a stored config does not carry.
 *
 * A row written before the field was typed, or hand-edited, must not leave the
 * form reading `undefined.autoDismissMinutes`. A stored duration outside the
 * editor's range is clamped rather than refused: the schema is the authority on
 * what may be stored, and a settings page that will not open is worse than one
 * that opens on a corrected number.
 */
export function resolveDisplayConfig(
  stored: Partial<KitchenDisplayConfig> | null | undefined
): KitchenDisplayConfig {
  return {
    autoDismissEnabled:
      stored?.autoDismissEnabled ?? DEFAULT_DISPLAY_CONFIG.autoDismissEnabled,
    autoDismissMinutes: clampAutoDismissMinutes(
      stored?.autoDismissMinutes ?? DEFAULT_DISPLAY_CONFIG.autoDismissMinutes
    ),
  }
}

/**
 * A whole number of minutes the query can multiply by 60 000 and mean it.
 *
 * `getForDisplay` computes `autoDismissMinutes * 60_000` and compares it to a
 * timestamp; `NaN` makes every one of those comparisons false, and zero or a
 * negative keeps only tickets that became ready in the future. Either way the
 * dining-room screen's ready column empties.
 *
 * THIS CLAMP GUARDS THE FORM, NOT THE MUTATION. It is client-side — it stops
 * the editor sending a value it would then display back as if it had been
 * saved. The guard that actually holds is server-side, in
 * `stores.updateDisplayConfig`, which REFUSES anything outside the same range
 * and writes nothing; a caller bypassing this form cannot get past it. The two
 * ranges are deliberately equal so the form never offers a value the mutation
 * will reject.
 */
export function clampAutoDismissMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_DISPLAY_CONFIG.autoDismissMinutes
  return Math.round(
    Math.max(MIN_AUTO_DISMISS_MINUTES, Math.min(MAX_AUTO_DISMISS_MINUTES, minutes))
  )
}
