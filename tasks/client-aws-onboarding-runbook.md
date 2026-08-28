# Runbook — AWS setup for a new client

> **Start this on day one, before anything else.** Not because it is long to do
> — the script runs in a couple of minutes — but because it ends in a queue at
> AWS that nobody can hurry. Everything else in an onboarding can be done the
> week before go-live. This cannot.

Counterpart to [`client-offboarding-runbook.md`](./client-offboarding-runbook.md).
Ownership rationale: [`aws-ownership.md`](../apps/docs/deployment/aws-ownership.md).
This file contains **no credential**.

## Why it has to be first

Four steps, and each one can only start when the previous finished:

```
client's AWS account  →  setup-aws.sh  →  DNS records  →  SES production access
   (they create it)      (2 minutes)     (propagation)     (AWS reviews it)
```

The last two are the problem:

- **DKIM verification waits on DNS propagation.** The script prints three CNAME
  records; SES only marks the domain verified once it can read them — and it
  **gives up after 72 hours**. Publish them the same day, or the identity fails
  and the whole thing restarts.
- **SES production access is reviewed by AWS.** Their stated target is an
  initial response within 24 hours, and longer when they come back with
  questions — which they do. Plan for days, not hours.
- **Verifying the domain first is what makes the request go through quickly.**
  AWS treats a verified domain as the signal that you are a real sender, so the
  order above is not arbitrary: skipping ahead gets the request bounced back.

Until production access is granted the account is in the **sandbox**, and the
sandbox is not a soft-launch mode:

| Sandbox | Limit |
|---|---|
| Recipients | **only verified addresses and domains** — a real customer receives nothing |
| Volume | **200 messages per 24 hours** |
| Rate | **1 message per second** |

A restaurant in the sandbox takes orders and confirms none of them. No password
reset, no winning ticket, no order confirmation. And nothing errors visibly —
the mail is simply refused at SES.

Sources: [Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html),
[SES FAQ](https://aws.amazon.com/ses/faqs/). Checked 2026-08-28.

## Step 1 — the client's AWS account

One AWS account per client: its bucket, its sender and its IAM user live in an
account the restaurant owns, so they follow it if it leaves.

**The client creates it, not you.** Signing up means entering their card and
their identity — do that for them and the account is yours in every way that
matters at recovery time. Ask them for it, or have them create it on an address
they control and grant you access.

Note the account id: step 2 uses it to refuse to provision into the wrong one.

## Step 2 — provision

From the client's site repository, authenticated to **their** account:

```bash
SITE_SLUG=chez-mario DOMAIN=chez-mario.fr EXPECTED_ACCOUNT_ID=123456789012 ./scripts/setup-aws.sh
```

- `SITE_SLUG` — lowercase, digits and hyphens. Names the bucket
  (`beyours-<slug>-assets`), the IAM user, the IAM policy and the SES
  configuration set.
- `DOMAIN` — the client's sending domain. The sender becomes `noreply@<domain>`.
- `EXPECTED_ACCOUNT_ID` — optional and worth setting. The AWS CLI silently uses
  whatever profile is default; with one account per client, provisioning into
  the wrong one is the easiest mistake to make and the least visible.
- `AWS_REGION` defaults to `eu-west-3`.

> **Never run it without `SITE_SLUG`.** With none it falls back to the
> fleet-wide names for the shared legacy account. That mode exists only for the
> clients already on it.

It creates a **private** S3 bucket (versioned, AES256, no public policy), the
SES domain identity with DKIM, the MAIL FROM subdomain, the configuration set,
an IAM user scoped to that one bucket (`s3:GetObject/PutObject/DeleteObject`,
plus `ListBucket`/`GetBucketLocation`) and to sending through that one SES
identity, and writes the credentials into `.env.local`.

## Step 3 — DNS, the same day

The script prints the records. Add them at the client's DNS provider:

- **three DKIM CNAMEs** — `<token>._domainkey.<domain>` → `<token>.dkim.amazonses.com`
- **MAIL FROM** on `mail.<domain>` — the MX and SPF records SES asks for, needed
  for alignment

Then poll until it flips to `SUCCESS`:

```bash
aws sesv2 get-email-identity --email-identity chez-mario.fr --region eu-west-3 --query 'DkimAttributes.Status'
```

Do not move on while this says `PENDING`. Requesting production access against
an unverified domain is what turns a one-day approval into a week.

## Step 4 — request production access

Once DKIM reads `SUCCESS`:

<https://console.aws.amazon.com/ses/home?region=eu-west-3#/account> → **Request
production access**.

They ask what you send, to whom, and how recipients opted in. Answer concretely
— transactional mail for one restaurant's own customers: order confirmations,
password resets, prize notifications; recipients are people who ordered from
that restaurant. Name the bounce and complaint handling. Vague answers are what
triggers the follow-up round that costs the extra days.

**Record the date you filed it.** It is the only number that tells you whether
the go-live date still holds.

## Step 5 — wire the deployment

```bash
pnpm env:check     # every required variable present?
pnpm env:sync      # .env.local -> .env.convex
pnpm convex:env    # push to the client's Convex deployment
```

The AWS credentials are **site** variables since 2026-08-28: they are this
client's own, and they are required — a deployment does not boot without them.

## Step 6 — prove it works

- Upload an image in the CMS media library, and confirm it renders. That
  exercises the presigned PUT, the CORS rule and the `/api/files` proxy in one
  go. A CORS failure here means the origin: re-run step 2 with `SITE_ORIGIN`
  set to the client's real domain.
- Send a real password reset **to an address outside the verified set**. In the
  sandbox it will not arrive — which is exactly the check. It arriving is what
  proves production access landed.

## What blocks what

| If this is not done | Then this cannot happen |
|---|---|
| Client's AWS account | anything |
| `setup-aws.sh` | no bucket, no uploads, no DKIM tokens to publish |
| DNS records | domain never verifies, production access gets bounced |
| SES production access | **no customer receives any email** — orders, resets, prizes |
| `pnpm convex:env` | the deployment holds no credentials and refuses to boot |

## Traps

- **Provisioning into the wrong account.** Set `EXPECTED_ACCOUNT_ID`. Without
  it the script uses the default profile and says nothing.
- **Treating the sandbox as "good enough to open".** 200 messages a day, only
  to verified addresses. A restaurant that opens in the sandbox looks like a
  restaurant whose email is broken, because it is.
- **Re-running the script to "fix" a key.** In legacy shared mode it offers to
  delete the existing access keys and create new ones, which invalidates the
  credentials of **every** deployed client at once. Per-client accounts remove
  that risk; the shared account still has it.
- **Assuming the bucket is public.** It is private by design. Media reaches the
  browser through `/api/files`, or a CDN with an origin access control — see
  [`s3-bucket-policy.md`](../apps/docs/deployment/s3-bucket-policy.md).

## Sign-off

- [ ] Client's AWS account exists, account id recorded
- [ ] `setup-aws.sh` run with `SITE_SLUG`, `DOMAIN`, `EXPECTED_ACCOUNT_ID`
- [ ] DKIM CNAMEs and MAIL FROM records published
- [ ] `DkimAttributes.Status` reads `SUCCESS`
- [ ] **SES production access requested — date filed: ____________**
- [ ] SES production access **granted**
- [ ] `pnpm env:check` clean, `env:sync` + `convex:env` done
- [ ] Media upload renders; password reset reaches an unverified address
