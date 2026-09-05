/**
 * The key names whose values never leave the process.
 *
 * Extracted into its own module for one reason: `index.ts` re-exports
 * `envelope.ts`, and `envelope.ts` needs this list. Importing it back from
 * `index.ts` would make a cycle that survives bundling today and stops
 * surviving it the day one of the two modules grows a top-level side effect.
 * A leaf both can import cannot.
 *
 * `index.ts` still re-exports the name, so this file is an implementation
 * detail rather than a second import path.
 *
 * @module sentry/redaction-keys
 */

/**
 * Query parameters whose VALUE is replaced before an event leaves, and — via
 * `redactSentryExtra` — the context keys a Convex report drops too.
 *
 * `request.url` is not a header and survives the header allowlist. This product
 * puts real credentials in query strings: `/reset-password?token=…` is a live
 * password reset, and `/order/<id>?token=…` opens one customer's order to
 * whoever holds the link. Neither belongs in a monitoring tool.
 */
export const SENTRY_REDACTED_QUERY_KEYS: readonly string[] = [
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'secret',
  'password',
  'signature',
  'key',
  'api_key',
  'apikey',
]

/** What replaces a redacted value. */
export const REDACTED = '[Filtered]'

/**
 * Context KEYS whose value never leaves — a different list from the one above,
 * on purpose.
 *
 * Reusing the query-parameter list here was wrong in both directions. `code`
 * and `key` are credentials in a URL (`?code=` is an OAuth grant) and are
 * ordinary words in an object: `statusCode`, `errorCode` and `idempotencyKey`
 * are exactly what a webhook failure attaches, and all three would have
 * arrived as `[Filtered]`. Meanwhile `authorization` was not on the list at
 * all, and `stripe_signature_header` escaped a suffix match because the
 * credential word was not at the end.
 *
 * Matched per SEGMENT — `snake_case`, `kebab-case`, `dotted` and camelCase are
 * split first — and additionally against the whole key with separators removed,
 * so `api_key`, `apiKey` and `apikey` are one entry rather than three. That
 * redacts `stripe_signature_header` and `secretValue`, and keeps `statusCode`
 * and `s3Key`.
 */
export const SENTRY_REDACTED_CONTEXT_KEYS: readonly string[] = [
  'token',
  'secret',
  'password',
  'passwd',
  'pwd',
  'signature',
  'auth',
  'authorization',
  'credential',
  'credentials',
  'cookie',
  'session',
  'bearer',
  'apikey',
  'privatekey',
  'accesskey',
  'secretkey',
]
