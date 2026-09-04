/**
 * Retry with exponential backoff and jitter, for the delivery platforms.
 *
 * WHY THIS EXISTS: neither client had any. `fetchUberEats` and `fetchDeliveroo`
 * retried exactly one thing — an expired token — and handed every other status
 * straight back to the caller, which turned it into an `IntegrationError`. A
 * `429` from Uber's menu endpoint (roughly one call a minute per store) or a
 * `502` from Deliveroo therefore failed the whole push, wrote `menuSyncStatus:
 * "error"` on the establishment, and waited for a human.
 *
 * Both platforms document the same remedy: back off exponentially, add jitter
 * so a fleet of stores does not retry in lockstep, and honour the wait the
 * response asked for — `Retry-After` at Uber, plus
 * `X-Deliveroo-RateLimit-Wait-Time-Seconds` on Deliveroo's Catalogue API.
 *
 * Three bounds, all deliberate:
 *
 * - **Attempts.** Three, so at most two retries. Uber's own guidance caps a
 *   non-idempotent call (`PUT .../menu`) at two retries before alerting.
 * - **A total sleep budget**, not just a per-delay cap. A Deliveroo token lives
 *   **300 seconds**; a loop that sleeps its way past that is retrying with
 *   credentials that have already expired, and the retry it finally makes is
 *   guaranteed to fail. The budget keeps the whole sequence well inside one
 *   token's life, and the callers re-resolve the token before each attempt so a
 *   refresh happens instead of a doomed retry.
 * - **What is retryable at all.** `429` always — a rate-limited request was not
 *   processed, so replaying it is safe whatever the method. `5xx` only for
 *   idempotent methods: a `502` on a `POST /accept` may mean the order WAS
 *   accepted and the reply was lost, and accepting it twice is worse than
 *   failing once. `PUT` is idempotent by definition, which is what both menu
 *   uploads use.
 *
 * Nothing else is retried. `4xx` other than `429` is a payload or credential
 * problem, and repeating it just spends quota.
 */

/** Statuses worth a second attempt when the request can safely be replayed. */
export const RETRYABLE_SERVER_STATUSES: readonly number[] = [500, 502, 503, 504]

/** HTTP methods that may be replayed after a server error. */
const IDEMPOTENT_METHODS: readonly string[] = ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]

export const DEFAULT_MAX_ATTEMPTS = 3
export const DEFAULT_BASE_DELAY_MS = 500
export const DEFAULT_MAX_DELAY_MS = 30_000

export interface BackoffPolicy {
  /** Total tries, initial attempt included. */
  maxAttempts: number
  /** Delay before the first retry, doubled each time. */
  baseDelayMs: number
  /** Ceiling for one computed delay, before any server hint is applied. */
  maxDelayMs: number
  /**
   * Total milliseconds this sequence may spend asleep. A delay that would
   * overrun it ends the sequence instead — see the token-lifetime note above.
   */
  totalBudgetMs: number
  /** Response headers carrying an explicit wait, in the order they are read. */
  waitHintHeaders: readonly string[]
}

export const DEFAULT_WAIT_HINT_HEADERS: readonly string[] = ["retry-after"]

/**
 * The subset of `Response` this module reads.
 *
 * Declared structurally because the package's own tests mock `fetch` with plain
 * objects — `{ ok, status, json }` — that carry no `headers` at all. Code that
 * assumed a real `Response` here would throw inside the retry path on every
 * existing test in the suite.
 */
export interface RetryableResponse {
  status?: number
  headers?: { get?: (name: string) => string | null | undefined }
}

export interface RetryHooks {
  /** Injected in tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
  /** Injected in tests; defaults to `Math.random`. */
  random?: () => number
  /** Called before each retry, so the caller can refresh an expiring token. */
  onRetry?: (attempt: number, delayMs: number, status: number | undefined) => void
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Read a wait hint off a response, in milliseconds.
 *
 * `Retry-After` is either a number of seconds or an HTTP date; Deliveroo's
 * `X-Deliveroo-RateLimit-Wait-Time-Seconds` is always seconds. A header that is
 * absent, unparseable or negative yields `null`, and the caller falls back to
 * the computed delay rather than to zero — a hint we cannot read is not a
 * licence to retry immediately.
 */
export function readWaitHintMs(
  response: RetryableResponse,
  headerNames: readonly string[],
  now: number = Date.now()
): number | null {
  const headers = response.headers
  if (!headers || typeof headers.get !== "function") return null

  for (const name of headerNames) {
    let raw: string | null | undefined
    try {
      raw = headers.get(name)
    } catch {
      continue
    }
    if (typeof raw !== "string" || raw.trim() === "") continue

    const seconds = Number(raw)
    if (Number.isFinite(seconds)) {
      return seconds > 0 ? Math.round(seconds * 1000) : 0
    }

    const asDate = Date.parse(raw)
    if (Number.isFinite(asDate)) {
      return Math.max(0, asDate - now)
    }
  }

  return null
}

/**
 * The delay before retry number `attempt` (1 for the first retry).
 *
 * Equal jitter — half the computed delay, plus a random share of the other
 * half. Full jitter (uniform over the whole delay) spreads a fleet slightly
 * better but lets a later retry fire sooner than an earlier one, which makes
 * "the delay grows" untestable and, worse, unprovable in production. Half the
 * window is enough to break lockstep between stores.
 */
export function backoffDelayMs(
  attempt: number,
  policy: Pick<BackoffPolicy, "baseDelayMs" | "maxDelayMs">,
  random: () => number = Math.random
): number {
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1)
  const capped = Math.min(exponential, policy.maxDelayMs)
  return Math.round(capped / 2 + random() * (capped / 2))
}

/** Whether this response is worth replaying, given the method used. */
export function isRetryable(
  response: RetryableResponse,
  method: string
): boolean {
  const status = response.status
  if (typeof status !== "number") return false
  if (status === 429) return true
  if (!RETRYABLE_SERVER_STATUSES.includes(status)) return false
  return IDEMPOTENT_METHODS.includes(method.toUpperCase())
}

/**
 * Send a request, retrying a `429` (and a `5xx` on idempotent methods).
 *
 * `send` must build and send a *fresh* request each call: the clients use that
 * to re-resolve their access token, so a sequence that outlives the token it
 * started with refreshes rather than replaying an expired one.
 *
 * Returns the last response received. It does not throw on an exhausted
 * sequence — the callers already turn a non-ok response into an
 * `IntegrationError` with the platform's own body attached, and swallowing that
 * body to raise a generic "out of retries" would lose the only useful part.
 */
export async function sendWithRetry<T extends RetryableResponse>(
  send: (attempt: number) => Promise<T>,
  method: string,
  policy: BackoffPolicy,
  hooks: RetryHooks = {}
): Promise<T> {
  const sleep = hooks.sleep ?? defaultSleep
  const random = hooks.random ?? Math.random

  let spentMs = 0
  let attempt = 1
  let response = await send(attempt)

  while (attempt < policy.maxAttempts && isRetryable(response, method)) {
    const hinted = readWaitHintMs(response, policy.waitHintHeaders)
    const delay = hinted ?? backoffDelayMs(attempt, policy, random)

    // Out of budget: stop here rather than sleep past the token's life and
    // spend the last attempt on credentials that have already expired.
    if (spentMs + delay > policy.totalBudgetMs) break

    hooks.onRetry?.(attempt, delay, response.status)
    await sleep(delay)
    spentMs += delay

    attempt += 1
    response = await send(attempt)
  }

  return response
}
