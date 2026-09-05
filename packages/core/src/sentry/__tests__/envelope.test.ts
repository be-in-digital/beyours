/**
 * The Convex-side Sentry envelope, read back off the wire.
 *
 * Nothing downstream of this module can report its own failure: a wrong
 * endpoint 404s into the void, a wrong item length makes Sentry drop the item,
 * and a throw inside the reporter turns one failed order into two — and all
 * three look exactly like a quiet week in the issue stream. This suite is the
 * only place the format is actually parsed back, so it pins it character for
 * character rather than asserting that a function returned something.
 *
 * Several blocks below exist because the behaviour they describe was once
 * wrong: the item length counted characters, a self-hosted DSN behind a path
 * reported nowhere, a nested `{ token }` left in full, a repeated sibling was
 * called a cycle. Each is now the assertion of the fix rather than a record of
 * the fault, and each says which fault it guards.
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_EXTRA_DEPTH,
  MAX_EXTRA_VALUE_CHARS,
  MAX_MESSAGE_CHARS,
  MAX_STACK_FRAMES,
  buildSentryEnvelope,
  buildSentryErrorEvent,
  describeUnknownError,
  formatSentryEventId,
  isSensitiveContextKey,
  parseSentryDsn,
  parseStackFrames,
  redactSentryExtra,
  sentryAuthHeader,
  type SentryDsnParts,
  type SentryErrorEvent,
  type SentryErrorEventInput,
} from '../envelope'
import {
  buildSentryEnvelope as reExportedEnvelope,
  isSensitiveContextKey as reExportedPredicate,
  isSentryDsn,
} from '../index'

const DSN = 'https://abc123@o42.ingest.sentry.io/4505'
const ENVELOPE_URL = 'https://o42.ingest.sentry.io/api/4505/envelope/'
const PREFIXED_DSN = 'https://k@sentry.example.com/some/path/7'
const EVENT_ID = '0123456789abcdef0123456789abcdef'
const FILTERED = '[Filtered]'

/** A Convex stack, as the isolate prints it: both V8 line shapes and noise. */
const STACK = [
  'Error: Stripe webhook signature mismatch',
  '    at verifyStripeSignature (../convex/stripe/webhook.ts:41:11)',
  '    at async handleStripeEvent (../convex/stripe/webhook.ts:88:5)',
  '    at ../convex/http.ts:17:3',
  '    at <anonymous>',
].join('\n')

/** `noUncheckedIndexedAccess` is on: a missing element is a broken test. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`expected an element at index ${index}`)
  return item
}

/** Every DSN handed to this is meant to parse; not parsing is the failure. */
function dsnParts(dsn: string): SentryDsnParts {
  const parts = parseSentryDsn(dsn)
  if (!parts) throw new Error(`expected ${dsn} to parse`)
  return parts
}

const parseJson = (line: string): Record<string, unknown> =>
  JSON.parse(line) as Record<string, unknown>

const utf8Length = (value: string): number => new TextEncoder().encode(value).length

/** A ConvexError as it reaches a `catch`: an Error carrying `data`. */
const withData = (message: string, data: unknown): Error =>
  Object.assign(new Error(message), { data })

/** An error whose stack is fixed, so a whole-event comparison stays stable. */
function stripeFailure(): Error {
  const error = new Error('Stripe webhook signature mismatch')
  error.stack = STACK
  return error
}

/** One valid input, so each test varies only the thing it is about. */
const eventInput = (over: Partial<SentryErrorEventInput> = {}): SentryErrorEventInput => ({
  error: stripeFailure(),
  eventId: EVENT_ID,
  now: 1_771_000_000_123,
  environment: 'production',
  source: 'stripeWebhook',
  ...over,
})

/** `levels` objects of `{ a: … }` wrapped around `leaf`, the outermost first. */
function nest(levels: number, leaf: unknown): Record<string, unknown> {
  let node: unknown = leaf
  for (let index = 0; index < levels; index += 1) node = { a: node }
  return node as Record<string, unknown>
}

/** Follows the chain `nest` built, back down to whatever sits at the bottom. */
function bottom(value: unknown, levels: number): unknown {
  let node: unknown = value
  for (let index = 0; index < levels; index += 1) node = (node as Record<string, unknown>).a
  return node
}

/**
 * The endpoint is the whole reporter: every event goes to the URL built here.
 * A DSN that parses into the wrong host reports into someone else's project,
 * and one that throws instead of returning null takes the handler down with it
 * — the second failure being invisible for the same reason as the first.
 */
describe('parseSentryDsn', () => {
  it('splits a hosted DSN into what the ingestion request needs', () => {
    expect(parseSentryDsn(DSN)).toEqual({
      publicKey: 'abc123',
      host: 'o42.ingest.sentry.io',
      projectId: '4505',
      envelopeUrl: ENVELOPE_URL,
    })
  })

  it('keeps the scheme and port of a self-hosted host', () => {
    expect(parseSentryDsn('http://key@sentry.internal:9000/2')).toEqual({
      publicKey: 'key',
      host: 'sentry.internal:9000',
      projectId: '2',
      envelopeUrl: 'http://sentry.internal:9000/api/2/envelope/',
    })
  })

  it('trims the whitespace a pasted environment variable carries', () => {
    expect(parseSentryDsn(`  ${DSN}  `)?.envelopeUrl).toBe(ENVELOPE_URL)
  })

  /**
   * The shape a self-hosted Sentry behind a reverse proxy has. The project id
   * is the LAST segment and everything before it belongs to the endpoint, so
   * the prefix has to survive into the URL — `/api/7/envelope/` alone would
   * miss the mount point and 404 every event.
   */
  it('keeps the path prefix of a self-hosted DSN in the endpoint', () => {
    expect(parseSentryDsn(PREFIXED_DSN)).toEqual({
      publicKey: 'k',
      host: 'sentry.example.com',
      projectId: '7',
      envelopeUrl: 'https://sentry.example.com/some/path/api/7/envelope/',
    })
  })

  /**
   * A DSN carries neither a query nor a fragment, and `isSentryDsn` delegates
   * here — so anything accepted reaches `Sentry.init`, where the SDK's own
   * parser would read the project id of `…/4505?x=1` as `4505?x=1` and report
   * nowhere. Refusing it names the variable in a warning instead.
   */
  it.each<[string, string]>([
    ['a query string', `${DSN}?x=1`],
    ['a fragment', `${DSN}#frag`],
  ])('refuses a DSN carrying %s', (_label, dsn) => {
    expect(parseSentryDsn(dsn)).toBeNull()
  })

  it('tolerates a bare ? or # that delimits nothing', () => {
    // `new URL` reports an empty search and hash for these, and the endpoint
    // they produce is identical — refusing them would only cost a deployment
    // whose variable picked up a stray character.
    expect(parseSentryDsn(`${DSN}?`)?.envelopeUrl).toBe(ENVELOPE_URL)
    expect(parseSentryDsn(`${DSN}#`)?.envelopeUrl).toBe(ENVELOPE_URL)
  })

  it.each<[string, string]>([
    ['the empty string', ''],
    ['a value that is not a URL', 'not a url'],
    ['a DSN with no public key', 'https://o42.ingest.sentry.io/4505'],
    ['a non-numeric project id', 'https://abc123@o42.ingest.sentry.io/pizzeria'],
    ['a DSN with no project id', 'https://abc123@o42.ingest.sentry.io/'],
    ['a DSN with a trailing slash', 'https://abc123@o42.ingest.sentry.io/4505/'],
  ])('returns null for %s rather than throwing', (_label, dsn) => {
    expect(parseSentryDsn(dsn)).toBeNull()
  })
})

/**
 * `isSentryDsn` gates `resolveSentryOptions`; `parseSentryDsn` builds the URL
 * the Convex reporter posts to. They are now one reading of the variable — the
 * gate delegates — and this table is what keeps it that way. While they were
 * two separate patterns they DID drift: `https://:pass@host/4505` passed the
 * gate and failed the parser, which initialises the browser SDK and kills every
 * Convex report with a `bad-dsn` nobody reads.
 */
describe('parseSentryDsn agrees with isSentryDsn', () => {
  it.each<[string, boolean]>([
    [DSN, true],
    [`  ${DSN}  `, true],
    ['http://key@sentry.internal:9000/2', true],
    ['https://key:legacysecret@host/42', true],
    [PREFIXED_DSN, true],
    ['', false],
    ['not a url', false],
    ['https://sentry.io/organizations/beyours/projects/pizza', false],
    ['https://abc123@o42.ingest.sentry.io/', false],
    ['https://abc123@o42.ingest.sentry.io/pizzeria', false],
    ['https://abc123@o42.ingest.sentry.io/4505/', false],
    // Refused on both sides again, which is what the old regex did before the
    // gate began delegating.
    [`${DSN}?x=1`, false],
    [`${DSN}#frag`, false],
    // The input that used to split them: `:pass` is a password with no key.
    ['https://:pass@o42.ingest.sentry.io/4505', false],
  ])('agrees on %j', (dsn, accepted) => {
    expect(isSentryDsn(dsn)).toBe(accepted)
    expect(parseSentryDsn(dsn) !== null).toBe(accepted)
  })

  it('rejects a credential that is a password with no public key', () => {
    // Named on its own because it is the regression, not just a row: a DSN
    // whose key half is empty must be refused by the gate as well.
    expect(isSentryDsn('https://:pass@o42.ingest.sentry.io/4505')).toBe(false)
  })

  it('accepts the self-hosted prefixed DSN on both sides', () => {
    // Also the regression: this one was refused everywhere, so a self-hosted
    // Sentry behind a path reported nothing from any runtime.
    expect(isSentryDsn(PREFIXED_DSN)).toBe(true)
    expect(parseSentryDsn(PREFIXED_DSN)?.projectId).toBe('7')
  })
})

describe('sentryAuthHeader', () => {
  it('is the exact header shape Sentry ingestion authenticates on', () => {
    expect(sentryAuthHeader(dsnParts(DSN), 'beyours-convex/1.0.0')).toBe(
      'Sentry sentry_version=7, sentry_client=beyours-convex/1.0.0, sentry_key=abc123',
    )
  })

  it('carries only the public half of a DSN that still has a secret', () => {
    // Pre-2019 DSNs are `key:secret@host`. The secret is a credential and has
    // no place in an outbound header we control.
    const header = sentryAuthHeader(dsnParts('https://key:legacysecret@host/42'), 'c/1')
    expect(header).toContain('sentry_key=key')
    expect(header).not.toContain('legacysecret')
  })
})

/**
 * Sentry titles an issue after the topmost `in_app` frame and draws the LAST
 * frame as the crash site. Order reversed, crash site dropped by the cap, or a
 * dependency marked as ours, and the issue points at whatever the isolate
 * happened to be doing five calls earlier — worse than no stack, because it
 * looks authoritative.
 */
describe('parseStackFrames', () => {
  it('parses both V8 line shapes, oldest first', () => {
    expect(parseStackFrames(STACK)).toEqual([
      { filename: '../convex/http.ts', lineno: 17, colno: 3, in_app: true },
      {
        function: 'async handleStripeEvent',
        filename: '../convex/stripe/webhook.ts',
        lineno: 88,
        colno: 5,
        in_app: true,
      },
      {
        function: 'verifyStripeSignature',
        filename: '../convex/stripe/webhook.ts',
        lineno: 41,
        colno: 11,
        in_app: true,
      },
    ])
  })

  it('puts the crash site last, the reverse of the stack string', () => {
    const frames = parseStackFrames(STACK)
    // First line of the stack after the header is where it threw.
    expect(at(frames, frames.length - 1).function).toBe('verifyStripeSignature')
  })

  it('drops the header line and any line it cannot read', () => {
    // A guessed filename sends whoever reads the issue to the wrong file, so
    // `Error: …` and `at <anonymous>` are dropped rather than approximated.
    const frames = parseStackFrames(STACK)
    expect(frames).toHaveLength(3)
    expect(frames.map((frame) => frame.filename)).not.toContain('<anonymous>')
    expect(JSON.stringify(frames)).not.toContain('Stripe webhook signature mismatch')
  })

  it('returns nothing for a missing or empty stack', () => {
    // A ConvexError thrown across the client boundary arrives without one.
    expect(parseStackFrames(undefined)).toEqual([])
    expect(parseStackFrames('')).toEqual([])
  })

  it('caps a deep stack while keeping the crash site', () => {
    const deep = [
      'RangeError: Maximum call stack size exceeded',
      ...Array.from(
        { length: MAX_STACK_FRAMES + 10 },
        (_, i) => `    at frame${i} (/app/f.ts:${i + 1}:1)`,
      ),
    ].join('\n')

    const frames = parseStackFrames(deep)
    expect(frames).toHaveLength(MAX_STACK_FRAMES)
    // Recursion overflows are the reason the cap exists, and the innermost
    // frame is the only one that says which function recursed.
    expect(at(frames, frames.length - 1).function).toBe('frame0')
    expect(at(frames, 0).function).toBe(`frame${MAX_STACK_FRAMES - 1}`)
  })

  it('demotes a dependency frame and keeps ours in_app', () => {
    // Both line shapes have to be demoted: `convex/server` re-throwing is the
    // top frame of most of these stacks, and an issue grouped under it merges
    // every unrelated fault in the deployment into one.
    expect(
      parseStackFrames(
        [
          'Error: x',
          '    at handleOrder (../convex/orders.ts:12:5)',
          '    at Object.<anonymous> (/app/node_modules/convex/dist/server.js:120:19)',
          '    at /app/node_modules/@stripe/lib.js:9:1',
        ].join('\n'),
      ),
    ).toEqual([
      { filename: '/app/node_modules/@stripe/lib.js', lineno: 9, colno: 1, in_app: false },
      {
        function: 'Object.<anonymous>',
        filename: '/app/node_modules/convex/dist/server.js',
        lineno: 120,
        colno: 19,
        in_app: false,
      },
      {
        function: 'handleOrder',
        filename: '../convex/orders.ts',
        lineno: 12,
        colno: 5,
        in_app: true,
      },
    ])
  })
})

/**
 * `catch (error)` is `unknown` and this repository throws four different things
 * through it. Every branch here exists to avoid one specific unreadable issue:
 * a stream of `Error: [object Object]` that no one can group, act on, or even
 * tell apart from the next one.
 */
describe('describeUnknownError', () => {
  it('reads an Error and keeps its stack', () => {
    const described = describeUnknownError(stripeFailure())
    expect(described.type).toBe('Error')
    expect(described.value).toBe('Stripe webhook signature mismatch')
    expect(described.stack).toBe(STACK)
  })

  /**
   * The grouping fix. `class TimeoutError extends Error {}` never assigns
   * `this.name`, so it inherits `'Error'` from the prototype and every such
   * class used to collapse into one undifferentiated issue. The constructor
   * name is the fallback; a built-in and an explicitly named error must both
   * keep answering as they did.
   */
  it.each<[string, Error, string]>([
    ['a plain Error', new Error('boom'), 'Error'],
    ['a built-in subclass', new TypeError('not a function'), 'TypeError'],
    [
      'a subclass that sets no name',
      new (class TimeoutError extends Error {})('slow'),
      'TimeoutError',
    ],
  ])('types %s as %s', (_label, error, type) => {
    expect(describeUnknownError(error).type).toBe(type)
  })

  it('lets an explicitly assigned name win over the constructor', () => {
    // `rebuildError` in `convex/errorReporting.ts` reassigns `name` from the
    // flattened arguments, and that round trip has to survive the fallback.
    class TimeoutError extends Error {}
    const error = Object.assign(new TimeoutError('slow'), { name: 'DeliverooTimeout' })
    expect(describeUnknownError(error).type).toBe('DeliverooTimeout')
  })

  it('falls back to Error when the name was blanked', () => {
    expect(describeUnknownError(Object.assign(new Error('boom'), { name: '' })).type).toBe('Error')
  })

  it('folds an object `data` payload into the value', () => {
    // Convex replaces the message of a thrown Error with "Server Error" in
    // production; `data` is the only part that survives, so it has to be read.
    const described = describeUnknownError(
      withData('Server Error', { code: 'seat_taken', message: 'Déjà pris' }),
    )
    expect(described.value).toBe('Server Error — {"code":"seat_taken","message":"Déjà pris"}')
  })

  it('folds a string `data` payload in as it stands', () => {
    // `convex-test` delivers the same payload already serialized.
    expect(describeUnknownError(withData('Server Error', '{"code":"seat_taken"}')).value).toBe(
      'Server Error — {"code":"seat_taken"}',
    )
  })

  it('reads a bare thrown string', () => {
    expect(describeUnknownError('upstream refused the order')).toEqual({
      type: 'Error',
      value: 'upstream refused the order',
      stack: undefined,
    })
  })

  it('serializes a plain object instead of stringifying it', () => {
    // A failed `await response.json()` throws one of these.
    expect(describeUnknownError({ status: 502, body: 'bad gateway' }).value).toBe(
      '{"status":502,"body":"bad gateway"}',
    )
  })

  it.each<[string, unknown, string]>([
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
  ])('describes a thrown %s without throwing', (_label, error, value) => {
    expect(describeUnknownError(error)).toEqual({ type: 'Error', value, stack: undefined })
  })

  it('survives a circular reference', () => {
    // An Uber Eats or Deliveroo client object holds a back-reference to its own
    // response; a bare JSON.stringify here would throw inside the reporter.
    const circular: Record<string, unknown> = { orderId: 'ord_1' }
    circular.self = circular

    expect(describeUnknownError(circular).value).toBe('{"orderId":"ord_1","self":"[Circular]"}')
  })

  it('survives a BigInt, which JSON.stringify refuses outright', () => {
    expect(describeUnknownError({ amount: 1999n, currency: 'EUR' }).value).toBe(
      '{"amount":"1999n","currency":"EUR"}',
    )
  })

  it('truncates an over-long message and says how much it dropped', () => {
    // Sentry drops a whole envelope over its size limit, so an unbounded
    // message would cost the report rather than a few characters of it.
    const described = describeUnknownError(new Error('x'.repeat(MAX_MESSAGE_CHARS + 100)))

    expect(described.value).toHaveLength(MAX_MESSAGE_CHARS + '… [100 more]'.length)
    expect(described.value.endsWith('… [100 more]')).toBe(true)
    expect(described.value.startsWith('x'.repeat(MAX_MESSAGE_CHARS))).toBe(true)
  })
})

/**
 * The key matcher, tested on its own because it is the whole security property
 * and both directions of it cost something real: a miss puts a live credential
 * in a third-party dashboard, and a false hit replaces the `statusCode` the
 * on-call person needed with `[Filtered]`.
 */
describe('isSensitiveContextKey', () => {
  it.each([
    'token',
    'tokens',
    'secret',
    'secrets',
    'password',
    'passwords',
    'passwd',
    'pwd',
    'signature',
    'signatures',
    'cookie',
    'cookies',
    'authorization',
    'auth',
    'bearerToken',
    'apiKey',
    'apiKeys',
    'api_key',
    'x-api-key',
    'X-Api-Key',
    'x_api_key',
    'sessionToken',
    'secretValue',
    'deliveroo_client_secret',
    'stripe_signature_header',
    'PRIVATE_KEY',
    'accessKey',
    'accessKeyId',
    'csrfToken',
    'webhookSecret',
    'credentials',
  ])('filters %s', (key) => {
    expect(isSensitiveContextKey(key)).toBe(true)
  })

  /**
   * The over-redaction guard, and the list to attack when the matcher changes:
   * every one of these is a key a handler in `apps/*\/convex` already attaches
   * or plausibly would, and an earlier matcher filtered four of them.
   */
  it.each([
    'statusCode',
    'errorCode',
    'postalCode',
    'discountCode',
    'qrCodeId',
    'idempotencyKey',
    's3Key',
    'sortKey',
    'partitionKey',
    'cacheKey',
    'keyName',
    'keyCount',
    'keys',
    'publicKey',
    'orderId',
    'storeId',
    'eventType',
    'externalOrderId',
    'ticketId',
    'requestId',
    'apiVersion',
    'apiUrl',
    'author',
    'authors',
    'authorId',
    'co_authors',
    'authorized',
    'oauthState',
    'keyboard',
    'codebase',
    'secretary',
    'secretariat',
    'monkey',
    'tokenizer',
    'sequence',
  ])('keeps %s', (key) => {
    expect(isSensitiveContextKey(key)).toBe(false)
  })

  it('matches a run of adjacent words, not only a whole one', () => {
    // `x-api-key` is the header Deliveroo and Uber actually send: its segments
    // are `x`, `api`, `key` and its collapsed form is `xapikey`, so only the
    // adjacent run `api`+`key` finds it. The same rule is what now catches
    // `accessKeyId`, which used to escape by its trailing `Id`.
    expect(isSensitiveContextKey('x-api-key')).toBe(true)
    expect(isSensitiveContextKey('accessKeyId')).toBe(true)
    // And it must stay a run of WHOLE words: `s3`+`key` is not `apikey`, and a
    // public key is public.
    expect(isSensitiveContextKey('s3Key')).toBe(false)
    expect(isSensitiveContextKey('publicKey')).toBe(false)
  })

  it('stems a plural without stemming an unrelated word', () => {
    // `{ tokens: [...] }` is how a batch handler names its own field, and it
    // used to leave in full. `bearings` must not become `bearer`.
    expect(isSensitiveContextKey('tokens')).toBe(true)
    expect(isSensitiveContextKey('sessions')).toBe(true)
    expect(isSensitiveContextKey('bearings')).toBe(false)
    expect(isSensitiveContextKey('keys')).toBe(false)
  })

  /**
   * The cost of the rule, measured rather than guessed. `session` is a listed
   * word, so any key built around it is filtered — including `tableSession`,
   * which in a dine-in restaurant is an ordinary identifier and not a
   * credential. Deliberate and fail-closed, but it is the one place the new
   * matcher takes context away, so it is written down.
   */
  it.each(['sessionStorage', 'sessionCount', 'tableSession', 'userSession'])(
    'filters the innocent %s because it says session',
    (key) => {
      expect(isSensitiveContextKey(key)).toBe(true)
    },
  )
})

/**
 * `extra` is assembled by hand at the call site, where `{ signature, rawBody }`
 * is the natural thing to attach to a webhook failure — so this is the last
 * thing standing between a live Stripe signing secret and a dashboard the whole
 * team can read. It is the guard for the call site that forgot, which is why it
 * has to fail closed and why it walks the whole shape.
 */
describe('redactSentryExtra', () => {
  it('filters the values whose key names a credential', () => {
    expect(
      redactSentryExtra({
        signature: 't=1,v1=live',
        token: 'live-token',
        tokens: ['live-1', 'live-2'],
        deliveroo_client_secret: 'live-deliveroo-secret',
        stripe_signature_header: 't=1,v1=live',
        secretValue: 'live-secret',
        authorization: 'Bearer live-token',
        apiKey: 'live-api-key',
        'x-api-key': 'live-api-key',
        Cookie: 'session=live',
        sessionToken: 'live-session',
      }),
    ).toEqual({
      signature: FILTERED,
      token: FILTERED,
      tokens: FILTERED,
      deliveroo_client_secret: FILTERED,
      stripe_signature_header: FILTERED,
      secretValue: FILTERED,
      authorization: FILTERED,
      apiKey: FILTERED,
      'x-api-key': FILTERED,
      Cookie: FILTERED,
      sessionToken: FILTERED,
    })
  })

  it('keeps the context that makes a report actionable', () => {
    const kept = {
      orderId: 'ord_1',
      storeId: 'st_1',
      eventType: 'order.created',
      externalOrderId: 'ue_998',
      ticketId: 'kt_7',
      statusCode: 502,
      errorCode: 'card_declined',
      postalCode: '75011',
      idempotencyKey: 'idem_1',
      s3Key: 'products/x.webp',
    }
    expect(redactSentryExtra(kept)).toEqual(kept)
  })

  it('walks into a nested object', () => {
    // `{ payload: { token } }` is one JSON.parse away from any webhook handler
    // in that directory, and a shallow pass sent it verbatim.
    expect(redactSentryExtra({ payload: { token: 'live', body: 'ok' } })).toEqual({
      payload: { token: FILTERED, body: 'ok' },
    })
  })

  it('walks into an array of objects', () => {
    expect(redactSentryExtra({ items: [{ token: 'live' }, { id: 'ok' }] })).toEqual({
      items: [{ token: FILTERED }, { id: 'ok' }],
    })
  })

  it('truncates a long string at every depth', () => {
    const long = 'y'.repeat(MAX_EXTRA_VALUE_CHARS + 50)
    const expected = MAX_EXTRA_VALUE_CHARS + '… [50 more]'.length

    expect(String(redactSentryExtra({ body: long }).body)).toHaveLength(expected)
    const nested = redactSentryExtra({ response: { body: long } }).response
    expect(String((nested as Record<string, unknown>).body)).toHaveLength(expected)
  })

  it('passes non-string scalars through, and undefined as null', () => {
    expect(
      redactSentryExtra({ status: 502, retried: false, attempt: 0, missing: undefined, nul: null }),
    ).toEqual({ status: 502, retried: false, attempt: 0, missing: null, nul: null })
  })

  it('converts a BigInt rather than leaving it to explode later', () => {
    // `JSON.stringify` refuses a BigInt, and the refusal would land in
    // `buildSentryEnvelope` — one function too late to do anything but lose the
    // report. A price in cents is a plausible thing to attach to a payment
    // failure.
    expect(redactSentryExtra({ amount: 1999n })).toEqual({ amount: '1999n' })
  })

  it('does not mutate the object it was handed', () => {
    // The caller logs the same object to the Convex dashboard; redaction is for
    // what leaves the process, not for what stays in it.
    const source = { payload: { token: 'live' } }
    redactSentryExtra(source)
    expect(source.payload.token).toBe('live')
  })
})

/**
 * The four shapes that used to walk to `{}` — their contents are not enumerable
 * own properties, so the generic walk found nothing to copy. A nested `Error`
 * arriving as `{}` is the one that cost most: it is the cause of the failure
 * being reported, and it read as though the field had been empty.
 */
describe('redactSentryExtra — non-plain values', () => {
  it('renders a nested Error as its type and message', () => {
    expect(redactSentryExtra({ cause: new RangeError('too far') })).toEqual({
      cause: 'RangeError: too far',
    })
  })

  it('truncates the message of a nested Error', () => {
    const rendered = String(
      redactSentryExtra({ cause: new Error('z'.repeat(MAX_MESSAGE_CHARS + 5)) }).cause,
    )
    expect(rendered.endsWith('… [5 more]')).toBe(true)
    expect(rendered.startsWith('Error: ')).toBe(true)
  })

  it('renders a Date as an ISO timestamp', () => {
    expect(redactSentryExtra({ at: new Date(0) })).toEqual({ at: '1970-01-01T00:00:00.000Z' })
  })

  it('renders a Set as an array, redacting what is inside it', () => {
    expect(redactSentryExtra({ s: new Set(['ok', { token: 'live' }]) })).toEqual({
      s: ['ok', { token: FILTERED }],
    })
  })

  it('walks a Map as an object, so a credential-named KEY is filtered too', () => {
    // A Map is what a handler builds when it collects per-request headers, and
    // `token` there is as much a credential as it is on an object literal.
    expect(
      redactSentryExtra({
        headers: new Map<string, unknown>([
          ['token', 'live'],
          ['content-type', 'application/json'],
        ]),
      }),
    ).toEqual({ headers: { token: FILTERED, 'content-type': 'application/json' } })
  })

  it('stringifies a class instance rather than emptying it', () => {
    class Money {
      constructor(public cents: number) {}
    }
    expect(redactSentryExtra({ total: new Money(1999) })).toEqual({ total: '{"cents":1999}' })
  })
})

/**
 * Cycle handling, which has to answer two questions that look alike and are
 * not: a value that contains itself must stop, and a value that simply appears
 * twice must NOT be mistaken for one. The `seen` set is per-branch — entries
 * come out on the way back up — which is what separates them.
 */
describe('redactSentryExtra — cycles and shared references', () => {
  it('marks a self-reference instead of expanding it once per level', () => {
    const circular: Record<string, unknown> = { orderId: 'ord_1' }
    circular.self = circular

    // The top-level object is not itself in `seen` when the walk starts, so it
    // appears once more before the cycle is caught.
    expect(redactSentryExtra(circular)).toEqual({
      orderId: 'ord_1',
      self: { orderId: 'ord_1', self: '[Circular]' },
    })
  })

  it.each<[string, () => Record<string, unknown>]>([
    [
      'an array',
      () => {
        const items: unknown[] = [1]
        items.push(items)
        return { items }
      },
    ],
    [
      'a Set',
      () => {
        const set = new Set<unknown>()
        set.add(set)
        return { set }
      },
    ],
    [
      'a Map',
      () => {
        const map = new Map<string, unknown>()
        map.set('self', map)
        return { map }
      },
    ],
  ])('catches a cycle through %s', (_label, build) => {
    expect(JSON.stringify(redactSentryExtra(build()))).toContain('[Circular]')
  })

  it('walks the same object twice when it is a sibling, not a cycle', () => {
    // The case a naive WeakSet gets wrong: one shared config object attached
    // under two keys is not a cycle, and reporting the second as `[Circular]`
    // hides the field that was actually there.
    const shared = { id: 'shared', token: 'live' }

    expect(redactSentryExtra({ x: shared, y: shared })).toEqual({
      x: { id: 'shared', token: FILTERED },
      y: { id: 'shared', token: FILTERED },
    })
    expect(redactSentryExtra({ list: [shared, shared] })).toEqual({
      list: [
        { id: 'shared', token: FILTERED },
        { id: 'shared', token: FILTERED },
      ],
    })
    expect(redactSentryExtra({ p: { one: shared, two: shared } })).toEqual({
      p: {
        one: { id: 'shared', token: FILTERED },
        two: { id: 'shared', token: FILTERED },
      },
    })
  })
})

/**
 * The ceiling. Past it the shape is dropped rather than walked: an unbounded
 * walk over a value that came off the wire is a denial of service against the
 * reporter, and dropping fails closed. It has to bite for every container the
 * walk knows about, or the newly-handled ones become the way around it.
 */
describe('redactSentryExtra — depth ceiling', () => {
  it('walks the last level inside the ceiling', () => {
    const walked = redactSentryExtra(nest(MAX_EXTRA_DEPTH, { token: 'live', id: 'ord_1' }))
    expect(bottom(walked, MAX_EXTRA_DEPTH)).toEqual({ token: FILTERED, id: 'ord_1' })
  })

  it('filters the first level past it', () => {
    const beyond = redactSentryExtra(nest(MAX_EXTRA_DEPTH + 1, { id: 'ord_1' }))
    expect(bottom(beyond, MAX_EXTRA_DEPTH + 1)).toBe(FILTERED)
  })

  it.each<[string, () => unknown]>([
    ['a plain object', () => ({ id: 'ord_1' })],
    ['an array', () => ['deep']],
    ['an Error', () => new Error('deep')],
    ['a Date', () => new Date(0)],
    ['a Set', () => new Set([1])],
    ['a Map', () => new Map([['k', 'v']])],
    ['a class instance', () => new (class Money {})()],
  ])('filters %s that sits past the ceiling', (_label, build) => {
    const out = redactSentryExtra(nest(MAX_EXTRA_DEPTH + 1, build()))
    expect(bottom(out, MAX_EXTRA_DEPTH + 1)).toBe(FILTERED)
  })

  it('still converts those containers one level inside the ceiling', () => {
    const out = redactSentryExtra(nest(MAX_EXTRA_DEPTH, new Date(0)))
    expect(bottom(out, MAX_EXTRA_DEPTH)).toBe('1970-01-01T00:00:00.000Z')
  })
})

/**
 * Reading a property is where this can throw, not only walking it: a getter
 * runs when it is read, and one that throws used to propagate out through
 * `buildSentryErrorEvent` and be caught by the reporter as "the reporter itself
 * failed" — the whole report lost over one unreadable field. Containment is the
 * property under test here, so every case checks what SURVIVED as much as what
 * was replaced.
 */
describe('redactSentryExtra — unreadable fields', () => {
  /** A field that explodes when read, with the fields either side of it. */
  const withThrower = (): Record<string, unknown> => ({
    orderId: 'ord_1',
    get boom(): string {
      throw new Error('getter exploded')
    },
    storeId: 'st_1',
  })

  it('contains the failure to the field and keeps its siblings', () => {
    expect(redactSentryExtra(withThrower())).toEqual({
      orderId: 'ord_1',
      boom: '[Unreadable]',
      storeId: 'st_1',
    })
  })

  it('does not lose the report it is attached to', () => {
    const event = buildSentryErrorEvent(eventInput({ extra: withThrower() }))
    expect(event.extra).toEqual({ orderId: 'ord_1', boom: '[Unreadable]', storeId: 'st_1' })
    expect(() => buildSentryEnvelope(event, DSN, 0)).not.toThrow()
  })

  it.each<[string, () => Record<string, unknown>]>([
    ['a nested object', () => ({ payload: withThrower() })],
    ['an array', () => ({ list: [withThrower()] })],
    ['a Set', () => ({ set: new Set([withThrower()]) })],
    ['a Map', () => ({ map: new Map([['k', withThrower()]]) })],
  ])('contains it inside %s', (_label, build) => {
    const serialized = JSON.stringify(redactSentryExtra(build()))
    expect(serialized).toContain('[Unreadable]')
    // The container and the readable fields around the bad one come through.
    expect(serialized).toContain('ord_1')
    expect(serialized).toContain('st_1')
  })

  it('never reads a property whose key already names a credential', () => {
    // The key check runs first, so a credential held behind a getter is not
    // invoked to be filtered — no side effect, no lazy fetch, no throw.
    let reads = 0
    const extra = {
      get token(): string {
        reads += 1
        return 'live-token'
      },
    }

    expect(redactSentryExtra(extra)).toEqual({ token: FILTERED })
    expect(reads).toBe(0)
  })

  it('contains a failure that happens at depth, leaving the ancestors intact', () => {
    const out = redactSentryExtra(nest(MAX_EXTRA_DEPTH - 1, withThrower()))
    expect(bottom(out, MAX_EXTRA_DEPTH - 1)).toEqual({
      orderId: 'ord_1',
      boom: '[Unreadable]',
      storeId: 'st_1',
    })
  })

  it('still applies the ceiling to the fields that read cleanly', () => {
    // Containment must not become a second way past the depth limit.
    const out = redactSentryExtra(nest(MAX_EXTRA_DEPTH + 1, { orderId: 'ord_1' }))
    expect(bottom(out, MAX_EXTRA_DEPTH + 1)).toBe(FILTERED)
  })

  it('contains a value whose own key list cannot be read', () => {
    // Not only getters: a proxy that refuses `ownKeys` fails one level up, in
    // the parent's read, and is contained there just the same.
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('ownKeys refused')
        },
      },
    )
    expect(redactSentryExtra({ orderId: 'ord_1', hostile })).toEqual({
      orderId: 'ord_1',
      hostile: '[Unreadable]',
    })
  })

  it('contains a getter that throws something that is not an Error', () => {
    expect(
      redactSentryExtra({
        get boom(): string {
          // A bare string, because a `catch` that only handles Error would let
          // this one through and the containment has to be unconditional.
          throw 'a bare string'
        },
      }),
    ).toEqual({ boom: '[Unreadable]' })
  })
})

/**
 * The event body is what an on-call person reads at 20:30 on a Saturday. The
 * two fields that silently ruin it are the timestamp — Sentry reads seconds,
 * and milliseconds land the issue in the year 58000 — and the tags, which are
 * how one restaurant's Convex errors are told from its browser errors.
 */
describe('buildSentryErrorEvent', () => {
  it('builds the whole event for a representative webhook failure', () => {
    expect(
      buildSentryErrorEvent(
        eventInput({
          release: 'pizzeria@2.1.0',
          tags: { store: 'napoli' },
          extra: { orderId: 'ord_1' },
        }),
      ),
    ).toEqual({
      event_id: EVENT_ID,
      timestamp: 1_771_000_000,
      platform: 'node',
      level: 'error',
      logger: 'convex',
      environment: 'production',
      release: 'pizzeria@2.1.0',
      tags: { runtime: 'convex', source: 'stripeWebhook', store: 'napoli' },
      extra: { orderId: 'ord_1' },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Stripe webhook signature mismatch',
            stacktrace: { frames: parseStackFrames(STACK) },
          },
        ],
      },
    })
  })

  it('records the timestamp in seconds, not milliseconds', () => {
    const event = buildSentryErrorEvent(eventInput({ now: 1_771_000_000_999 }))
    expect(event.timestamp).toBe(1_771_000_000)
    expect(String(event.timestamp)).toHaveLength(10)
  })

  it('tags the runtime and the call site, and merges the caller tags', () => {
    // `runtime: convex` is what separates these from the browser and server
    // SDK events landing in the same project.
    const event = buildSentryErrorEvent(
      eventInput({ source: 'orders.create', tags: { store: 'napoli', integration: 'deliveroo' } }),
    )
    expect(event.tags).toEqual({
      runtime: 'convex',
      source: 'orders.create',
      store: 'napoli',
      integration: 'deliveroo',
    })
  })

  it('omits release entirely rather than sending an undefined one', () => {
    // A `release: undefined` key serializes away anyway, but an empty release
    // string would attach the event to a release that owns no source maps.
    const event = buildSentryErrorEvent(eventInput())
    expect('release' in event).toBe(false)
    expect('release' in buildSentryErrorEvent(eventInput({ release: 'deadbeef' }))).toBe(true)
  })

  it('omits extra when the call site attached none', () => {
    expect('extra' in buildSentryErrorEvent(eventInput())).toBe(false)
  })

  it('redacts the extra it does carry, at depth', () => {
    const event = buildSentryErrorEvent(
      eventInput({ extra: { orderId: 'ord_1', payload: { signature: 't=1,v1=live' } } }),
    )
    expect(event.extra).toEqual({ orderId: 'ord_1', payload: { signature: FILTERED } })
  })

  it('titles the exception with the type and the message', () => {
    const event = buildSentryErrorEvent(
      eventInput({ error: withData('Server Error', { code: 'seat_taken' }) }),
    )
    const value = at(event.exception.values, 0)
    expect(value.type).toBe('Error')
    expect(value.value).toBe('Server Error — {"code":"seat_taken"}')
  })

  it('omits the stacktrace when the thrown thing had none', () => {
    // An empty `frames: []` makes Sentry render a stack widget with nothing in
    // it, which reads as "the stack was lost" rather than "there was none".
    const event = buildSentryErrorEvent(eventInput({ error: 'upstream refused the order' }))
    expect('stacktrace' in at(event.exception.values, 0)).toBe(false)
  })

  it('defaults to error level and honours an override', () => {
    expect(buildSentryErrorEvent(eventInput()).level).toBe('error')
    expect(buildSentryErrorEvent(eventInput({ level: 'fatal' })).level).toBe('fatal')
  })
})

/**
 * Envelope framing is unforgiving and fails silently: Sentry answers 200 to a
 * malformed envelope and drops the item. Three lines, no more, each one valid
 * JSON on its own — that is the entire contract, and nothing in production
 * checks it.
 */
describe('buildSentryEnvelope', () => {
  const event = buildSentryErrorEvent(eventInput({ extra: { orderId: 'ord_1' } }))
  const envelope = buildSentryEnvelope(event, DSN, 1_771_000_000_456)
  const lines = envelope.split('\n')

  it('is exactly three newline-delimited lines with no trailing newline', () => {
    expect(lines).toHaveLength(3)
    expect(envelope.endsWith('\n')).toBe(false)
  })

  it('parses every line as JSON', () => {
    for (const line of lines) expect(() => parseJson(line)).not.toThrow()
  })

  it('heads the envelope with the event id, an ISO timestamp and the DSN', () => {
    // `dsn` in the header is what routes a proxied request; the auth header
    // carries the key regardless, and only one of them being wrong is subtle.
    const header = parseJson(at(lines, 0))
    expect(header.event_id).toBe(EVENT_ID)
    expect(header.dsn).toBe(DSN)
    expect(header.sent_at).toBe('2026-02-13T16:26:40.456Z')
    expect(String(header.sent_at)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('declares the item as a JSON event of the byte length of line three', () => {
    const body = at(lines, 2)
    expect(at(lines, 1)).toBe(
      `{"type":"event","content_type":"application/json","length":${utf8Length(body)}}`,
    )
  })

  it('round-trips the event on line three', () => {
    expect(JSON.parse(at(lines, 2))).toEqual(event)
  })

  it('serializes a BigInt that reached the event, from either direction', () => {
    // Through `extra` the redaction converts it; on an event a caller built
    // itself nothing has, so the framing has to survive it too. A raw
    // `JSON.stringify` threw here, and the throw cost the whole report.
    const viaExtra = buildSentryErrorEvent(eventInput({ extra: { amount: 1999n } }))
    expect(viaExtra.extra).toEqual({ amount: '1999n' })
    expect(parseJson(at(buildSentryEnvelope(viaExtra, DSN, 0).split('\n'), 2)).extra).toEqual({
      amount: '1999n',
    })

    const handBuilt: SentryErrorEvent = { ...viaExtra, extra: { amount: 1999n } }
    expect(parseJson(at(buildSentryEnvelope(handBuilt, DSN, 0).split('\n'), 2)).extra).toEqual({
      amount: '1999n',
    })
  })

  /**
   * The bug this replaced, kept as the regression it is. `String.length` counts
   * UTF-16 code units and Sentry reads exactly `length` BYTES, so a message
   * holding a single `é` declared one byte fewer than it sent and Sentry was
   * handed truncated JSON. Every refusal string this backend throws is in
   * French, so the failure split cleanly down the middle: ASCII errors
   * reported, accented ones refused with a 400 nobody reads.
   */
  it('counts an accented French message in bytes, not characters', () => {
    const french = buildSentryErrorEvent(eventInput({ error: new Error('Commande déjà payée') }))
    const frenchLines = buildSentryEnvelope(french, DSN, 0).split('\n')
    const body = at(frenchLines, 2)
    const declared = parseJson(at(frenchLines, 1)).length

    expect(declared).toBe(utf8Length(body))
    // Three accents, three extra bytes — the gap that used to be the bug.
    expect(utf8Length(body)).toBe(body.length + 3)
    expect(declared).toBeGreaterThan(body.length)
  })

  /**
   * The last resort, and the only place it is exercised. A value can defeat
   * every identity-based cycle check by handing out a NEW object each time it
   * is read — a `toJSON` that wraps itself does exactly that — and serialising
   * it recurses until the engine gives up. The framing catches that and sends
   * the event WITHOUT its context rather than sending nothing: a report with no
   * `extra` still names the source, the release and the stack.
   */
  it('sends the event without its context when the context cannot be serialized', () => {
    const hostile = {
      name: 'hostile',
      toJSON(): unknown {
        return { wrapped: hostile }
      },
    }
    const event: SentryErrorEvent = { ...buildSentryErrorEvent(eventInput()), extra: { hostile } }
    const hostileLines = buildSentryEnvelope(event, DSN, 0).split('\n')

    expect(hostileLines).toHaveLength(3)
    const body = parseJson(at(hostileLines, 2))
    expect(body.event_id).toBe(EVENT_ID)
    expect('extra' in body).toBe(false)
    // The declared length still describes what is actually on the wire.
    expect(parseJson(at(hostileLines, 1)).length).toBe(utf8Length(at(hostileLines, 2)))
  })

  it('declares the same count as an ASCII message, where both agree', () => {
    // The half of the input space that always worked, so the fix is pinned as
    // "bytes", not as "always larger than the character count".
    const body = at(lines, 2)
    expect(utf8Length(body)).toBe(body.length)
    expect(parseJson(at(lines, 1)).length).toBe(body.length)
  })
})

/**
 * Telling a CYCLE from the same object appearing twice, on the serialisation
 * side. `{ x: shared, y: shared }` is one config object attached under two
 * keys, and calling the second one `[Circular]` deletes a field that was really
 * there — the mistake a cumulative set makes, and the one an ancestor stack
 * unwound through the replacer's holder avoids. Three routes reach it, so all
 * three are checked: a hand-built event, a thrown object, and a ConvexError's
 * `data`.
 */
describe('repeated references and real cycles', () => {
  const shared = { id: 'shared' }

  it('keeps both copies on an event a caller framed itself', () => {
    const base = buildSentryErrorEvent(eventInput())
    const handBuilt: SentryErrorEvent = { ...base, extra: { x: shared, y: shared } }
    const body = at(buildSentryEnvelope(handBuilt, DSN, 0).split('\n'), 2)

    expect(parseJson(body).extra).toEqual({ x: { id: 'shared' }, y: { id: 'shared' } })
  })

  it('keeps both copies on a thrown object and in a ConvexError payload', () => {
    expect(describeUnknownError({ a: shared, b: shared }).value).toBe(
      '{"a":{"id":"shared"},"b":{"id":"shared"}}',
    )
    expect(describeUnknownError(withData('Server Error', { a: shared, b: shared })).value).toBe(
      'Server Error — {"a":{"id":"shared"},"b":{"id":"shared"}}',
    )
  })

  /**
   * The unwinding itself, which is the fiddly part: the stack is popped back to
   * the current holder on every call, so a branch that ends deep and resumes
   * shallow has to forget exactly the nodes it left. Each case here is one way
   * that can go wrong — a false `[Circular]` hides a field, and a missed cycle
   * recurses until `JSON.stringify` gives up and the report is lost.
   */
  it.each<[string, () => unknown, string]>([
    [
      'a deep branch resuming shallow',
      () => ({ deep: { a: { b: { c: shared } } }, top: shared }),
      '{"deep":{"a":{"b":{"c":{"id":"shared"}}}},"top":{"id":"shared"}}',
    ],
    [
      'a shallow branch resuming deep',
      () => ({ top: shared, deep: { a: { b: { c: shared } } } }),
      '{"top":{"id":"shared"},"deep":{"a":{"b":{"c":{"id":"shared"}}}}}',
    ],
    [
      'an array whose every element shares one object',
      () => ({ list: [{ s: shared }, { s: shared }, { s: shared }] }),
      '{"list":[{"s":{"id":"shared"}},{"s":{"id":"shared"}},{"s":{"id":"shared"}}]}',
    ],
    [
      'a diamond under one parent',
      () => ({ p: { one: shared, two: shared } }),
      '{"p":{"one":{"id":"shared"},"two":{"id":"shared"}}}',
    ],
    [
      'the same array under two keys',
      () => {
        const list = [1, 2]
        return { p: list, q: list }
      },
      '{"p":[1,2],"q":[1,2]}',
    ],
    [
      'a cycle several levels down',
      () => {
        const root: Record<string, unknown> = { l1: { l2: { l3: {} } } }
        const l2 = (root.l1 as Record<string, unknown>).l2 as Record<string, unknown>
        l2.l3 = { back: root }
        return root
      },
      '{"l1":{"l2":{"l3":{"back":"[Circular]"}}}}',
    ],
    [
      'a cycle whose repeated node is an array',
      () => {
        const list: unknown[] = [1]
        list.push({ back: list })
        return { list }
      },
      '{"list":[1,{"back":"[Circular]"}]}',
    ],
    [
      'a value that is an ancestor on one branch and a sibling on another',
      () => {
        const parent: Record<string, unknown> = { name: 'parent' }
        const child: Record<string, unknown> = { name: 'child', up: parent }
        parent.down = child
        return { parent, alsoChild: child }
      },
      '{"parent":{"name":"parent","down":{"name":"child","up":"[Circular]"}},' +
        '"alsoChild":{"name":"child","up":{"name":"parent","down":"[Circular]"}}}',
    ],
    [
      'a cycle and a shared sibling in one object',
      () => {
        const root: Record<string, unknown> = { tag: 'root' }
        root.a = { s: shared, back: root }
        root.b = { s: shared }
        return root
      },
      '{"tag":"root","a":{"s":{"id":"shared"},"back":"[Circular]"},"b":{"s":{"id":"shared"}}}',
    ],
    [
      'two objects that point at each other',
      () => {
        const a: Record<string, unknown> = { n: 'a' }
        const b: Record<string, unknown> = { n: 'b', a }
        a.b = b
        return { a }
      },
      '{"a":{"n":"a","b":{"n":"b","a":"[Circular]"}}}',
    ],
    [
      'a value that contains itself at the root',
      () => {
        const root: Record<string, unknown> = { n: 1 }
        root.self = root
        return root
      },
      '{"n":1,"self":"[Circular]"}',
    ],
    [
      'a Date and a BigInt alongside a repeated sibling',
      () => ({ at: new Date(0), amount: 1999n, s: shared, again: shared }),
      '{"at":"1970-01-01T00:00:00.000Z","amount":"1999n","s":{"id":"shared"},' +
        '"again":{"id":"shared"}}',
    ],
  ])('serializes %s', (_label, build, expected) => {
    expect(describeUnknownError(build()).value).toBe(expected)
  })
})

/**
 * Sentry rejects an event id that is not 32 lowercase hex characters — a
 * `crypto.randomUUID()` with its dashes is refused — and a refused event is a
 * dropped event, not an error the caller sees.
 */
describe('formatSentryEventId', () => {
  const BYTES = new Uint8Array([0, 15, 255, 16, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

  it('zero-pads every byte, including 0x00 and 0x0f', () => {
    expect(formatSentryEventId(BYTES)).toBe('000fff100102030405060708090a0b0c')
  })

  it('satisfies the id format Sentry accepts', () => {
    expect(formatSentryEventId(BYTES)).toMatch(/^[0-9a-f]{32}$/)
    expect(formatSentryEventId(BYTES)).not.toContain('-')
  })

  it('pads a short input out to full width rather than emitting a short id', () => {
    expect(formatSentryEventId(new Uint8Array([1, 2, 3]))).toBe('01020300000000000000000000000000')
    expect(formatSentryEventId(new Uint8Array())).toMatch(/^0{32}$/)
  })

  it('ignores anything past the sixteenth byte', () => {
    expect(formatSentryEventId(new Uint8Array(32).fill(0xab))).toBe('ab'.repeat(16))
  })
})

describe('the sentry entry point', () => {
  it('re-exports the envelope builders, so there is one import path', () => {
    // A Convex module and a browser bundle read `@be-in-digital/core/sentry`
    // and must get the same scrubbing, not two conventions.
    expect(reExportedEnvelope).toBe(buildSentryEnvelope)
    expect(reExportedPredicate).toBe(isSensitiveContextKey)
  })

  it('redacts through the one public entry point, with its defaults', () => {
    // `redactSentryExtra` grew a `depth` and a `seen` parameter; every existing
    // caller passes neither, so the defaults are the real signature.
    expect(redactSentryExtra({ token: 'live', payload: { secret: 'live' } })).toEqual({
      token: FILTERED,
      payload: { secret: FILTERED },
    })
  })
})
