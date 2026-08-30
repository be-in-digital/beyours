# Verifying email delivery locally

The campaign send loop and the automation engine are the one part of this
codebase that no test reaches. Both call SES from a `"use node"` module, which
`convex-test` cannot execute, so the unit and integration tests cover every
decision those loops make and never the loops making them.

This closes that gap: a real Convex backend, the real actions, real SES calls —
pointed at a stand-in that records what was sent.

## What it checks

`verify-campaign-send.mjs`

- one email per subscriber, and nobody twice
- `List-Unsubscribe` and `List-Unsubscribe-Post` (RFC 8058 one-click, required
  by Gmail and Yahoo for bulk senders since February 2024)
- the `X-Campaign-Id` / `X-Subscriber-Id` / `X-Store-Id` headers the SES webhook
  correlates on
- the campaign reaching `sent`, with matching `stats.sent`
- re-sending a finished campaign mailing nobody again
- `maxEmailsPerWeek` holding a campaign back entirely
- both A/B arms going out, and `variantId` recorded on every event

`verify-resume-and-automation.mjs`

- pausing a send mid-flight and resuming it — **the P0 where "Relancer"
  restarted at the first subscriber and mailed everyone a second time**
- a send spanning several batch pages
- the welcome automation, from the confirmation link to the delivered email

## Running it

```bash
# 1. A backend of your own. Pick ports nothing else is using — several
#    worktrees on one machine will collide otherwise.
#    Convex stores environment variables IN THE DATABASE, so wiping the
#    backend's sqlite wipes them too and they must be set again after.
cd apps/reference
CONVEX_AGENT_MODE=anonymous npx convex dev

# 2. The SES stand-in, on 3282.
node scripts/local-ses.mjs /tmp/sent-mail.json

# 3. Point the deployment's SDK at it, and give it the rest of what the send
#    path reads. `AWS_ENDPOINT_URL` is what redirects the AWS SDK; the
#    credentials are never checked by the stand-in but must be present.
npx convex env set AWS_ENDPOINT_URL http://127.0.0.1:3282
npx convex env set AWS_REGION eu-west-3
npx convex env set AWS_ACCESS_KEY_ID probe
npx convex env set AWS_SECRET_ACCESS_KEY probe-secret
npx convex env set SITE_URL http://127.0.0.1:3000
npx convex env set ADMIN_BOOTSTRAP_TOKEN probe-loop-token

# 4. Run them. The admin key is in the deployment's own config file.
CONVEX_ADMIN_KEY="$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.convex/anonymous-convex-backend-state/<name>/config.json')))['adminKey'])")" \
ADMIN_BOOTSTRAP_TOKEN=probe-loop-token \
node scripts/verify-campaign-send.mjs
```

Both scripts seed their own store and are safe to re-run against the same
deployment: they use a fixed admin subject, tolerate an already-claimed
bootstrap, and count only the mail their own run produced.

## Things that will waste your time otherwise

**`CONVEX_SITE_URL` is built-in.** Convex refuses to let you set it, and it
already points at the deployment's site proxy — the port beside the main one.
The unsubscribe links in the captured mail use it.

**Environment variables live in the database.** Wiping
`convex_local_backend.sqlite3` to get a clean slate also deletes every
`convex env set`, and the next run fails with `bootstrap_not_configured`
rather than anything that names the cause.

**The local backend enforces a 1 second budget per function**, main-thread and
actions alike. On a loaded machine — several worktrees building at once — that
is easy to exceed on a cold isolate, and the failure looks like a product bug.
Both scripts retry timed-out reads and, for the send action, check whether the
campaign actually started before deciding anything failed.

**Do not trust a settle loop that stops at the first quiet sample.** A single
send is an SES call plus two mutation round-trips plus a 100 ms pace; under load
that can exceed a poll interval, and two equal readings mean nothing. An earlier
version of these scripts reported "7 of 12 sent" while all 12 were in flight —
the database said 12, and it was right.
