# AWS — one account per client

> **Decision: every client site gets its own AWS account.** Its S3 bucket, its
> SES identity and its IAM user live in an account the restaurant owns, and they
> follow it if it leaves — the same rule that already governs its Convex
> deployment, its Sentry project and its Stripe account.

Decided 2026-08-28, and implemented the same day. The credentials are site
variables, and `setup-aws.sh` provisions one client at a time. What is **not**
done is the migration of clients already on the shared bucket — see
"What is still owed" at the bottom.

## Why this had to be settled

**The product already promises it.** The admin console tells the restaurant
"Votre site vous appartient : vous pouvez à tout moment demander sa migration
complète vers le serveur et l'équipe de votre choix"
(`packages/admin/src/pages/system/maintenance-section.tsx:565`), and
`packages/convex-functions/src/maintenance.ts:38-45` accepts migration scopes
`["code", "database", "assets", "domain", "emails"]`.

Two of those five were not deliverable. The client's media sat in a bucket
BeYours owned, its mail left through an SES identity BeYours owned, and the
backup export is explicit that it does not carry the objects:
`packages/admin/src/pages/system/backup-section.tsx:154` — *"Les images S3 ne
sont pas incluses — seules les references/URLs sont sauvegardees."* So `assets`
and `emails` are promises the infrastructure could not keep.

**And isolation was not structural.** `apps/themes/scripts/env.mjs` copies the
AWS credentials into *every* client's Convex deployment. While those were one
fleet-wide key, any client's backend could reach every other client's media,
and an offboarded deployment kept working credentials that nothing rotated
(#199). The copy is still there and is now correct: each client's deployment
receives its own account's key. Per-account ownership makes the isolation a
property of the architecture rather than a matter of discipline — the same
argument that settled Sentry in [`sentry.md`](./sentry.md).

## What changed

| Where | Before | Now |
|---|---|---|
| `packages/core/src/env/schemas.ts` | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in **`packageEnvSchema`** | in the **required site** shape. Still required, still without `opt()` — only the tier changed |
| `packages/core/src/aws/ses/adapter.ts` | `getSESConfig()` read them off `getPackageEnv()` | reads them off `getSiteEnv()`, and names the missing one instead of handing `undefined` to the SDK |
| `setup-aws.sh` (both copies) | hardcoded one bucket, one IAM user, one SES identity; **no arguments** | `SITE_SLUG=<slug> DOMAIN=<domain>` names every resource for that client. With no `SITE_SLUG` it keeps the legacy fleet-wide names, because those designate resources that already exist |
| `setup-aws.sh` preflight | used whatever AWS profile was default, silently | prints the account, refuses on `EXPECTED_ACCOUNT_ID` mismatch, and says which mode it is in |
| SES configuration set | hardcoded `beindigital-engine` | `$SES_CONFIG_SET`, per client |
| `.env.example` (themes, reference) | AWS under *"BeYours platform credentials (shared infra)"* | under the per-restaurant section, with its bucket and sender |

The IAM policy name still differs between the two copies (`BeInDigitalEnginePolicy`
in themes, `BeYoursEnginePolicy` in reference) in **legacy mode only**. Both name
policies that may already exist in the shared account, so reconciling them means
renaming an AWS resource, not editing a string. Per-client mode derives one name
from the slug and the question does not arise.

## The cost, stated plainly

This decision is the right one for exit and isolation, and it is not free.

**SES production access is granted per AWS account.** A new client therefore
cannot send a single order confirmation, password reset or winning-ticket email
until AWS has reviewed and approved *their* account's request. That review is
not instant. It has to be sequenced early in onboarding, not discovered on
go-live day — otherwise the restaurant opens with silent email.

Also to accept:

- **Billing moves to the client.** Their card, their bill, their spending
  surprises. Whoever operates the site needs delegated access to act on it —
  the same bus-factor question settled for Convex in
  [`convex-spending-cap-runbook.md`](../../../tasks/convex-spending-cap-runbook.md) §4.
- **Onboarding gains an account-creation step**, and creating an AWS account is
  a credential action: the client does it, or it is created on an address the
  client controls.

The ordering this forces on an onboarding is the subject of
[`client-aws-onboarding-runbook.md`](../../../tasks/client-aws-onboarding-runbook.md).

## What is still owed

The decision is implemented for **new** clients. Two things it does not do:

- **Existing clients are still on the shared model.** Any site provisioned
  before this holds the fleet-wide key and stores its media in the shared
  bucket. Moving one means copying its S3 objects into its own bucket, creating
  and verifying its SES identity, re-pointing stored URLs, and rotating the
  shared key afterwards — a migration, not a config change. Until that is done
  those deployments still carry credentials to other clients' data (#199).
- **SES production access is per account**, so each new client needs its own
  request. Nothing in the tooling can do that for you.

## What stays shared

The decision changes AWS only. Unchanged, and still BeYours-level:

OpenAI, Uber Eats, Deliveroo (BeYours is the *partner app* on those platforms —
the credentials are BeYours', the restaurant only supplies its `brandId` /
`siteId`), plus Unsplash, Yousign, Calendly, Resend, Vercel and GitHub, which
serve the commercial site and the fleet rather than one restaurant.

Vercel in particular stays mutualised by design: one project per client inside
one BeYours account. It is consequently the part of an exit that is *not*
one-click, and the migration workflow's `domain` scope is where that surfaces.

## Related

- [`client-aws-onboarding-runbook.md`](../../../tasks/client-aws-onboarding-runbook.md)
  — **the setup procedure. Start it on day one**: it ends in an AWS review queue
  that nothing can hurry, and until it clears the client emails nobody
- [`client-offboarding-runbook.md`](../../../tasks/client-offboarding-runbook.md)
  — the other end of the same lifecycle
- [`sentry.md`](./sentry.md) — the same rule, already implemented
- [`s3-bucket-policy.md`](./s3-bucket-policy.md) — the bucket is **private**, and
  since #198 `setup-aws.sh` enforces that instead of contradicting it
- `tasks/production-accounts-checklist.md` — the ownership table
- `tasks/convex-spending-cap-runbook.md` — the per-team billing blast radius
