/**
 * What a send does about its SES configuration set, and when it gives up.
 *
 * WHY THIS EXISTS:
 *
 * **The configuration set was hard-coded.** Every `SendEmailCommand` in the
 * campaign and automation paths asked SES to send under
 * `"beindigital-email-tracking"` — a configuration set that exists in the
 * agency's own AWS account and in no client's. `AWS_SES_CONFIGURATION_SET` was
 * declared in the env schema, written into `.env` by `setup-aws.sh`, documented
 * in three places, and read by nothing. On a client account SES answered
 * `ConfigurationSetDoesNotExist` to every single call.
 *
 * **And the failure was invisible.** The send loop caught per-subscriber errors
 * and logged them, so 342 identical refusals left `stats.sent` at 0, `markSent`
 * ran anyway, and the dashboard told the restaurant owner "Campagne envoyée
 * (0/342 emails)". The owner concluded their recipients were at fault. The
 * dashboard lied.
 *
 * So: the name comes from the environment, the field is omitted when there is
 * none — SES accepts a send with no configuration set, it simply produces no
 * open/click tracking — and a run of consecutive refusals aborts the batch
 * instead of reporting a delivery that never happened.
 */

/**
 * The configuration set to send under, or `undefined` when there is none.
 *
 * An unset variable and one set to whitespace mean the same thing: no
 * configuration set. Neither may reach SES, because an empty or blank name is
 * not "no tracking" to SES — it is a name that does not exist, and it fails the
 * send exactly like the hard-coded one did.
 */
export function resolveConfigurationSet(
  raw: string | undefined | null
): string | undefined {
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * The configuration-set field, ready to spread into an `EmailMessage`.
 *
 * Returns an empty object when no set is configured, so the key is **absent**
 * from the message rather than present and undefined. Omission is the
 * documented way to send without a configuration set; a client whose account
 * has none still gets their campaign, minus the tracking events.
 *
 * It used to spell `ConfigurationSetName` and be spread into a raw
 * `SendEmailCommand`. Since #212 the sends go through a transport that may not
 * be SES at all — Resend has no configuration sets and drops the field — so
 * the name is the message's, and mapping it onto the AWS command is the SES
 * adapter's job, in the one module that speaks to the SDK.
 */
export function configurationSetFields(
  raw: string | undefined | null
): { configurationSet?: string } {
  const name = resolveConfigurationSet(raw)
  return name === undefined ? {} : { configurationSet: name }
}

/**
 * How many sends may fail back-to-back before a batch is abandoned.
 *
 * Five, and the number matters in both directions.
 *
 * A handful of bad addresses scattered through a good list is normal and must
 * not stop a campaign: SES refuses individual recipients it considers invalid,
 * and a list with a 10% bad rate would still only produce five refusals in a row
 * once in 100,000 attempts. So five consecutive failures is not a recipient
 * problem — it is an account-level one: a configuration set that does not
 * exist, an unverified sending identity, revoked credentials, a sending pause.
 * Those fail every call, not some of them.
 *
 * Low enough to matter, too. A page is 40 subscribers and a campaign is many
 * pages, so aborting at five costs five wasted SES calls rather than 342 — and
 * a run of refusals against a paused account is exactly the traffic that makes
 * the pause permanent.
 */
export const CONSECUTIVE_SEND_FAILURE_LIMIT = 5

/**
 * Has this batch failed enough times in a row to be abandoned?
 *
 * The caller resets its counter after every send that works, so the argument is
 * a run of failures, never a total. That distinction is the whole point: a
 * campaign with twelve bad addresses among three thousand good ones must finish.
 */
export function shouldAbortSend(
  consecutiveFailures: number,
  limit: number = CONSECUTIVE_SEND_FAILURE_LIMIT
): boolean {
  return consecutiveFailures >= limit
}

/** What the SES client actually said, as a line fit for a log. */
export function describeSendError(error: unknown): string {
  if (error instanceof Error) {
    return error.name && error.name !== "Error"
      ? `${error.name}: ${error.message}`
      : error.message
  }
  return String(error)
}

/**
 * The message the aborted batch throws.
 *
 * It names the configuration set, because that is the setting this failure is
 * usually about and the one an operator can check in a second.
 */
export function describeSendAbort(input: {
  consecutiveFailures: number
  configurationSet: string | undefined
  error: unknown
}): string {
  const target =
    input.configurationSet === undefined
      ? "no configuration set"
      : `configuration set "${input.configurationSet}"`
  return (
    `SES refused ${input.consecutiveFailures} consecutive sends (${target}); ` +
    `batch aborted so the campaign is not reported as sent. ` +
    `Last error — ${describeSendError(input.error)}`
  )
}
