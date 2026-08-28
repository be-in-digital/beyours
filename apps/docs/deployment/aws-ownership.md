# AWS — one account per client

> **Decision: every client site gets its own AWS account.** Its S3 bucket, its
> SES identity and its IAM user live in an account the restaurant owns, and they
> follow it if it leaves — the same rule that already governs its Convex
> deployment, its Sentry project and its Stripe account.

Decided 2026-08-28. This page records the decision and, honestly, how far the
code still is from it. **Nothing here is implemented yet** — read
"What contradicts this today" before assuming any of it is live.

## Why this had to be settled

**The product already promises it.** The admin console tells the restaurant
"Votre site vous appartient : vous pouvez à tout moment demander sa migration
complète vers le serveur et l'équipe de votre choix"
(`packages/admin/src/pages/system/maintenance-section.tsx:565`), and
`packages/convex-functions/src/maintenance.ts:38-45` accepts migration scopes
`["code", "database", "assets", "domain", "emails"]`.

Two of those five cannot be honoured today. The client's media sit in a bucket
BeYours owns, its mail leaves through an SES identity BeYours owns, and the
backup export is explicit that it does not carry the objects:
`packages/admin/src/pages/system/backup-section.tsx:154` — *"Les images S3 ne
sont pas incluses — seules les references/URLs sont sauvegardees."* So `assets`
and `emails` are promises the infrastructure cannot keep.

**And isolation is not currently structural.**
`apps/themes/scripts/env.mjs:66-68` copies `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` into *every* client's Convex deployment. Those are the
fleet-wide root credentials for the shared bucket. Any one client's backend can
therefore reach every other client's media, and an offboarded deployment keeps
working credentials that nothing rotates. Per-account ownership makes that a
property of the architecture rather than a matter of discipline — the same
argument that settled Sentry in [`sentry.md`](./sentry.md).

## What contradicts this today

Every row is the current state of `main`, verified. None of it has been changed
by this decision — that is the work it creates.

| Where | Today | Required by the decision |
|---|---|---|
| `packages/core/src/env/schemas.ts:21-23` | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` sit in **`packageEnvSchema`** — the shared tier | They move to the **site** tier, one set per client |
| `_project/ENVIRONMENT_VARIABLES.md:40-46` | documents them as *"the BeYours account"*, *"BeYours IAM access key"*, "shared across every deployed restaurant" | rewritten as per-client |
| `apps/themes/scripts/setup-aws.sh:38-42` | hardcodes `BUCKET_NAME="beindigital-engine-assets"`, `IAM_USER="beindigital-engine-app"`, `DOMAIN="beindigital.fr"`, and takes **no arguments** | parameterised per client, run against the client's own account |
| same script, folders | shared prefixes `products/ branding/ stores/ cms/ blog/` — **no per-client namespacing** | irrelevant once the bucket itself is per client |
| `apps/reference/scripts/setup-aws.sh` | a near-duplicate that differs only in the IAM policy name (`BeYoursEnginePolicy` vs `BeInDigitalEnginePolicy`), creating a second policy on the same shared user | one script, or an explicit reason for two |
| SES sandbox | one exit for the whole fleet, which is what issue #177 assumes | **one exit per client account** — see the cost below |

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
- **Existing clients are on the old model.** Any site already provisioned holds
  the fleet-wide keys and stores its media in the shared bucket. Moving them is
  a migration, not a config change, and it is the only way those deployments
  stop carrying credentials to other clients' data.

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

- [`sentry.md`](./sentry.md) — the same rule, already implemented
- [`s3-bucket-policy.md`](./s3-bucket-policy.md) — the bucket is **private**; note
  that `setup-aws.sh` currently attaches a public-read policy, contradicting it
- `tasks/production-accounts-checklist.md` — the ownership table
- `tasks/convex-spending-cap-runbook.md` — the per-team billing blast radius
