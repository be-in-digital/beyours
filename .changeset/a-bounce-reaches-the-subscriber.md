---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
---

Let a bounce or a complaint reach the subscriber when SES sends no headers

`handleSesWebhook` correlates feedback to a subscriber through `X-Store-Id`,
`X-Subscriber-Id` and `X-Campaign-Id`, injected at send time and readable only
from `mail.headers` — and SES omits `mail.headers` from a notification unless
the sending identity is configured to include the original headers. Nothing in
this repository configured that, and nothing provisioned the notification at
all: `setup-aws.sh` created the configuration set with no destination and no SNS
topic, so `POST /webhooks/ses` was routed and never called.

    grep -rniE "event-destination|EventDestination|sns create-topic|sns subscribe" \
      --include='*.sh' --include='*.ts' --include='*.mjs' --include='*.yml' .
    (no output)

The provisioning is the apps' half (`scripts/setup-aws.sh`, Step 2b). This is
the engine's: what the handler needs to act on a notification that arrives
without those headers, which is every notification any client provisioned before
today will send.

- `emailSubscribers` gains `.index("by_email", ["email"])` — the address alone,
  no store.
- `emailSubscribers.listByEmail` reads it, capped at 32 rows.

**Across stores, and that is the conservative direction rather than the
convenient one.** A hard bounce says the mailbox does not exist, which is
equally true of every store holding it; a complaint says this person reported
the operator for spam. The rate AWS suspends over is per-ACCOUNT — one AWS
account per client, every store of theirs inside it — so suppressing the address
wherever it appears is what keeps the account sending. The cost is one
subscriber row belonging to a store that did not send the message, and that row
would have bounced too.

Deliveries, opens and clicks deliberately do not fall back: those are campaign
statistics, and attributing one to a store that did not send the message
corrupts the figure rather than completing it. A bounce or complaint that still
matches nobody is reported through `captureBackendError` instead of answering a
silent 200, because a 200 tells SNS the delivery succeeded and is exactly how
this stayed invisible.
