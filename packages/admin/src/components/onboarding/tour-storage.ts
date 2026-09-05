/**
 * Whether an account has already been offered the onboarding tour.
 *
 * Its own module so it can be tested against a storage that throws, rather
 * than asserted at by grepping the provider's source for an identifier — which
 * is what the first version of `onboarding-tour.test.ts` did, and which passes
 * on a JSDoc comment alone.
 */

const STORAGE_PREFIX = "bid-tour-"

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

/**
 * The fallback for a browser that refuses storage — a private window, or a
 * locked-down kiosk. `hasSeenTour` answered `false` on every throw, so the tour
 * reopened 1.2 s after every page load with a mask that swallows clicks. This
 * does not survive a reload, but it holds within a session, which is the
 * difference between "asked once" and "unusable".
 */
const seenInSession = new Set<string>()

export function hasSeenTour(userId: string): boolean {
  if (seenInSession.has(userId)) return true
  try {
    return localStorage.getItem(storageKey(userId)) === "done"
  } catch {
    return false
  }
}

export function markTourSeen(userId: string): void {
  seenInSession.add(userId)
  try {
    localStorage.setItem(storageKey(userId), "done")
  } catch {
    // A browser that refuses storage still gets the in-memory guard above.
  }
}

/**
 * Forget ONE account's completion, so that account can replay the tour.
 *
 * The replay button used to loop over every `bid-tour-*` key in localStorage,
 * under a comment claiming it cleared the current user — so one person
 * replaying on the back-office tablet re-armed the auto-launch for every
 * colleague who had ever signed in on it.
 */
export function clearTourSeen(userId: string): void {
  seenInSession.delete(userId)
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    // Nothing to forget if there is nowhere to remember.
  }
}
